import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'ocs-ai-secret-key-change-in-production';
const SALT_ROUNDS = 10;
const INITIAL_ADMIN_USERNAME = 'admin';
const INITIAL_ADMIN_PASSWORD = 'admin123';

const ADMIN_FILE = join(__dirname, '../../data/admin.json');
const API_KEY_FILE = join(__dirname, '../../data/api-keys.json');

function ensureDataDir() {
  const dataDir = join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function initAdmin() {
  ensureDataDir();
  try {
    if (fs.existsSync(ADMIN_FILE)) {
      const data = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf-8'));
      return data;
    }
  } catch (error) {
    console.error('❌ 加载管理员数据失败:', error.message);
  }
  
  const hashedPassword = bcrypt.hashSync(INITIAL_ADMIN_PASSWORD, SALT_ROUNDS);
  const adminData = {
    username: INITIAL_ADMIN_USERNAME,
    password: hashedPassword,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
    lastLogin: null
  };
  
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminData, null, 2), 'utf-8');
  console.log('✅ 已创建初始管理员账户');
  console.log(`   用户名: ${INITIAL_ADMIN_USERNAME}`);
  console.log(`   密码: ${INITIAL_ADMIN_PASSWORD}`);
  console.log('   ⚠️  首次登录后必须修改密码！');
  
  return adminData;
}

function saveAdmin(adminData) {
  ensureDataDir();
  try {
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminData, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('❌ 保存管理员数据失败:', error.message);
    return false;
  }
}

export async function login(username, password) {
  const adminData = initAdmin();
  
  if (adminData.username !== username) {
    return { success: false, msg: '用户名或密码错误' };
  }
  
  const passwordMatch = await bcrypt.compare(password, adminData.password);
  if (!passwordMatch) {
    return { success: false, msg: '用户名或密码错误' };
  }
  
  adminData.lastLogin = new Date().toISOString();
  saveAdmin(adminData);
  
  const token = jwt.sign(
    { 
      username: adminData.username,
      type: 'admin',
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  return {
    success: true,
    token,
    mustChangePassword: adminData.mustChangePassword,
    username: adminData.username
  };
}

export function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const decoded = verifyToken(req);
  if (!decoded) {
    res.status(401).json({ code: 0, msg: '未授权，请先登录' });
    return;
  }
  req.admin = decoded;
  next();
}

export async function changePassword(username, oldPassword, newPassword) {
  const adminData = initAdmin();
  
  if (adminData.username !== username) {
    return { success: false, msg: '用户不存在' };
  }
  
  if (adminData.mustChangePassword && oldPassword === INITIAL_ADMIN_PASSWORD) {
    const hashedPassword = bcrypt.hashSync(newPassword, SALT_ROUNDS);
    adminData.password = hashedPassword;
    adminData.mustChangePassword = false;
    saveAdmin(adminData);
    return { success: true, msg: '密码修改成功' };
  }
  
  const passwordMatch = await bcrypt.compare(oldPassword, adminData.password);
  if (!passwordMatch) {
    return { success: false, msg: '原密码错误' };
  }
  
  const hashedPassword = bcrypt.hashSync(newPassword, SALT_ROUNDS);
  adminData.password = hashedPassword;
  adminData.mustChangePassword = false;
  saveAdmin(adminData);
  
  return { success: true, msg: '密码修改成功' };
}

export function getAdminStatus() {
  const adminData = initAdmin();
  return {
    username: adminData.username,
    mustChangePassword: adminData.mustChangePassword,
    lastLogin: adminData.lastLogin,
    createdAt: adminData.createdAt
  };
}

export function initApiKeys() {
  ensureDataDir();
  try {
    if (fs.existsSync(API_KEY_FILE)) {
      const data = JSON.parse(fs.readFileSync(API_KEY_FILE, 'utf-8'));
      return data.keys || [];
    }
  } catch (error) {
    console.error('❌ 加载API Key数据失败:', error.message);
  }
  return [];
}

function saveApiKeys(keys) {
  ensureDataDir();
  try {
    fs.writeFileSync(API_KEY_FILE, JSON.stringify({ keys }, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('❌ 保存API Key数据失败:', error.message);
    return false;
  }
}

let apiKeys = initApiKeys();

export function generateApiKey(name = '未命名') {
  const key = `ocs_${crypto.randomBytes(24).toString('hex')}`;
  const apiKeyData = {
    key,
    name,
    createdAt: new Date().toISOString(),
    callCount: 0,
    lastCallAt: null,
    enabled: true
  };
  
  apiKeys.push(apiKeyData);
  saveApiKeys(apiKeys);
  
  console.log(`✅ 已生成API Key: ${key.substring(0, 20)}... (${name})`);
  
  return apiKeyData;
}

export function verifyApiKey(key) {
  if (!key) return null;
  
  const apiKeyData = apiKeys.find(k => k.key === key);
  if (!apiKeyData || !apiKeyData.enabled) {
    return null;
  }
  
  apiKeyData.callCount++;
  apiKeyData.lastCallAt = new Date().toISOString();
  saveApiKeys(apiKeys);
  
  return apiKeyData;
}

export function requireApiKey(req, res, next) {
  const key = req.body?.apiKey || req.query?.apiKey || req.headers['x-api-key'];
  
  if (!key) {
    res.json({ code: 0, msg: '缺少API Key' });
    return;
  }
  
  const apiKeyData = verifyApiKey(key);
  if (!apiKeyData) {
    res.json({ code: 0, msg: '无效的API Key' });
    return;
  }
  
  req.apiKey = apiKeyData;
  next();
}

export function getApiKeys() {
  return apiKeys.map(k => ({
    key: k.key,
    name: k.name,
    createdAt: k.createdAt,
    callCount: k.callCount,
    lastCallAt: k.lastCallAt,
    enabled: k.enabled
  }));
}

export function deleteApiKey(key) {
  const index = apiKeys.findIndex(k => k.key === key);
  if (index === -1) {
    return { success: false, msg: 'API Key不存在' };
  }
  
  apiKeys.splice(index, 1);
  saveApiKeys(apiKeys);
  
  return { success: true, msg: 'API Key已删除' };
}

export function toggleApiKey(key) {
  const apiKeyData = apiKeys.find(k => k.key === key);
  if (!apiKeyData) {
    return { success: false, msg: 'API Key不存在' };
  }
  
  apiKeyData.enabled = !apiKeyData.enabled;
  saveApiKeys(apiKeys);
  
  return { success: true, msg: apiKeyData.enabled ? 'API Key已启用' : 'API Key已禁用' };
}

export function resetApiKeyCount(key) {
  const apiKeyData = apiKeys.find(k => k.key === key);
  if (!apiKeyData) {
    return { success: false, msg: 'API Key不存在' };
  }
  
  apiKeyData.callCount = 0;
  saveApiKeys(apiKeys);
  
  return { success: true, msg: '调用次数已重置' };
}

export function getStats() {
  const totalCalls = apiKeys.reduce((sum, k) => sum + k.callCount, 0);
  return {
    totalApiKeys: apiKeys.length,
    totalCalls,
    activeKeys: apiKeys.filter(k => k.enabled).length,
    keys: apiKeys.map(k => ({
      name: k.name,
      callCount: k.callCount,
      lastCallAt: k.lastCallAt,
      enabled: k.enabled
    }))
  };
}
