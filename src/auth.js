import crypto from 'crypto';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ADMIN_FILE = join(__dirname, '../data/admin.json');
const API_KEY_FILE = join(__dirname, '../data/api-keys.json');

const INITIAL_ADMIN_USERNAME = 'admin';
const INITIAL_ADMIN_PASSWORD = 'admin123';

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

  const adminData = {
    username: INITIAL_ADMIN_USERNAME,
    password: INITIAL_ADMIN_PASSWORD,
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

export function login(username, password) {
  const adminData = initAdmin();

  if (adminData.username !== username) {
    return { success: false, msg: '用户名或密码错误' };
  }

  if (adminData.password !== password) {
    return { success: false, msg: '用户名或密码错误' };
  }

  const token = crypto.randomBytes(32).toString('hex');

  adminData.lastLogin = new Date().toISOString();
  adminData.token = token;
  saveAdmin(adminData);

  return {
    success: true,
    token,
    mustChangePassword: adminData.mustChangePassword,
    username: adminData.username
  };
}

export function verifyToken(req) {
  const token = req.headers['x-admin-token'] || req.query.adminToken;

  if (!token) {
    return null;
  }

  const adminData = initAdmin();
  if (adminData.token !== token) {
    return null;
  }

  return { username: adminData.username };
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

export function changePassword(username, oldPassword, newPassword) {
  const adminData = initAdmin();

  if (adminData.username !== username) {
    return { success: false, msg: '用户不存在' };
  }

  if (adminData.mustChangePassword) {
    if (oldPassword !== INITIAL_ADMIN_PASSWORD && oldPassword !== adminData.password) {
      return { success: false, msg: '原密码错误' };
    }
    adminData.password = newPassword;
    adminData.mustChangePassword = false;
    saveAdmin(adminData);
    return { success: true, msg: '密码修改成功' };
  }

  if (adminData.password !== oldPassword) {
    return { success: false, msg: '原密码错误' };
  }

  adminData.password = newPassword;
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

let apiKeys = [];

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

export function initApiKeys() {
  ensureDataDir();
  try {
    if (fs.existsSync(API_KEY_FILE)) {
      const data = JSON.parse(fs.readFileSync(API_KEY_FILE, 'utf-8'));
      apiKeys = data.keys || [];
      return apiKeys;
    }
  } catch (error) {
    console.error('❌ 加载API Key数据失败:', error.message);
  }
  
  apiKeys = [];
  saveApiKeys(apiKeys);
  console.log('📦 首次启动，已创建空的 API Key 列表，请在管理后台创建');
  return [];
}

export function generateApiKey(alias = '未命名', options = {}) {
  const key = `ocs_${crypto.randomBytes(24).toString('hex')}`;
  const apiKeyData = {
    id: Date.now().toString(),
    alias,
    key,
    createdAt: new Date().toISOString(),
    callCount: 0,
    lastCallAt: null,
    enabled: true,
    expiresAt: options.expiresAt || null,
    maxCalls: options.maxCalls || null
  };

  apiKeys.push(apiKeyData);
  saveApiKeys(apiKeys);

  console.log(`✅ 已生成API Key: ${key.substring(0, 20)}... (${alias})`);

  return apiKeyData;
}

export function verifyApiKey(key) {
  if (!key) return null;

  const apiKeyData = apiKeys.find(k => k.key === key);
  if (!apiKeyData) {
    return null;
  }

  if (!apiKeyData.enabled) {
    return null;
  }

  if (apiKeyData.expiresAt) {
    const expiresAt = new Date(apiKeyData.expiresAt);
    if (expiresAt < new Date()) {
      return null;
    }
  }

  if (apiKeyData.maxCalls !== null && apiKeyData.callCount >= apiKeyData.maxCalls) {
    return null;
  }

  apiKeyData.callCount++;
  apiKeyData.lastCallAt = new Date().toISOString();
  saveApiKeys(apiKeys);

  return apiKeyData;
}

export function requireApiKey(req, res, next) {
  const key = req.body?.apiKey || req.query?.apiKey;

  if (!key) {
    res.json({ code: 401, msg: 'API Key 无效或已过期' });
    return;
  }

  const apiKeyData = verifyApiKey(key);
  if (!apiKeyData) {
    res.json({ code: 401, msg: 'API Key 无效或已过期' });
    return;
  }

  req.apiKey = apiKeyData;
  next();
}

export function getApiKeys() {
  return apiKeys.map(k => ({
    id: k.id,
    alias: k.alias,
    key: k.key,
    createdAt: k.createdAt,
    callCount: k.callCount,
    lastCallAt: k.lastCallAt,
    enabled: k.enabled,
    expiresAt: k.expiresAt,
    maxCalls: k.maxCalls,
    remainingCalls: k.maxCalls ? k.maxCalls - k.callCount : null,
    isExpired: k.expiresAt ? new Date(k.expiresAt) < new Date() : false
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

export function updateApiKey(key, updates) {
  const apiKeyData = apiKeys.find(k => k.key === key);
  if (!apiKeyData) {
    return { success: false, msg: 'API Key不存在' };
  }

  if (updates.alias !== undefined) {
    apiKeyData.alias = updates.alias;
  }
  if (updates.expiresAt !== undefined) {
    apiKeyData.expiresAt = updates.expiresAt;
  }
  if (updates.maxCalls !== undefined) {
    apiKeyData.maxCalls = updates.maxCalls;
  }

  saveApiKeys(apiKeys);
  return { success: true, msg: 'API Key已更新' };
}

export function regenerateApiKey(key) {
  const apiKeyData = apiKeys.find(k => k.key === key);
  if (!apiKeyData) {
    return { success: false, msg: 'API Key不存在' };
  }

  const newKey = `ocs_${crypto.randomBytes(24).toString('hex')}`;
  apiKeyData.key = newKey;
  saveApiKeys(apiKeys);

  return { success: true, msg: 'API Key已重新生成', key: newKey };
}

export function getStats() {
  const totalCalls = apiKeys.reduce((sum, k) => sum + k.callCount, 0);
  return {
    totalApiKeys: apiKeys.length,
    totalCalls,
    activeKeys: apiKeys.filter(k => k.enabled).length,
    keys: apiKeys.map(k => ({
      alias: k.alias,
      callCount: k.callCount,
      lastCallAt: k.lastCallAt,
      enabled: k.enabled
    }))
  };
}

export { apiKeys };
