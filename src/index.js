import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

import {
  login,
  verifyToken,
  requireAuth,
  changePassword,
  getAdminStatus,
  generateApiKey,
  verifyApiKey,
  requireApiKey,
  getApiKeys,
  deleteApiKey,
  toggleApiKey,
  updateApiKey,
  regenerateApiKey,
  getStats,
  initAdmin,
  initApiKeys
} from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());

app.use(express.text({ type: 'text/plain', limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(join(__dirname, '../public')));

let openai = null;
let currentConfig = null;

function initOpenAI(config = null) {
  let apiKey, baseURL;
  
  if (config && config.apiKey && config.baseUrl) {
    apiKey = config.apiKey;
    baseURL = config.baseUrl;
    currentConfig = config;
    console.log(`📡 使用配置初始化AI: ${config.name} (${config.model})`);
  } else {
    apiKey = process.env.OPENAI_API_KEY;
    baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  }
  
  if (!apiKey || apiKey === 'your-api-key-here') {
    if (config) {
      openai = { apiKey, baseURL };
      console.log('✅ AI客户端初始化成功（使用配置）');
      return openai;
    } else {
      console.warn('⚠️  未找到可用配置，AI功能暂时不可用');
      return null;
    }
  }
  
  openai = { apiKey, baseURL };
  console.log('✅ AI客户端初始化成功');
  return openai;
}

async function generateAnswer(question, options = '', questionType = '') {
  if (!openai) {
    throw new Error('AI服务未初始化，请检查API配置');
  }
  
  let systemPrompt = `你是一个专业的题库助手，专门帮助用户解答各类考试题目。你的任务是根据提供的题目内容，给出准确、简洁的答案。

重要规则：
1. 如果是单选题，只返回答案选项（如：A、B、C、D），不要解释
2. 如果是多选题，返回所有正确的选项（如：ABD），使用#分隔（如：A#B#D）
3. 如果是判断题，返回"正确"或"错误"
4. 如果是填空题，只返回答案内容
5. 只返回答案，不要额外的解释或说明`;

  if (questionType === 'judgement' || questionType === '判断题') {
    systemPrompt = `你是一个专业的判断题助手。题目只有"正确"或"错误"两个选项。
根据题目内容判断对错，只返回"正确"或"错误"，不要任何其他内容。`;
  } else if (questionType === 'multiple' || questionType === '多选题') {
    systemPrompt = `你是一个专业的多选题助手。
根据题目内容选择所有正确的答案选项，返回格式如：A#B#D（用#分隔）
只返回选项，不要解释。`;
  } else if (questionType === 'completion' || questionType === '填空题') {
    systemPrompt = `你是一个专业的填空题助手。
根据题目内容填写正确答案。
只返回答案，不要任何其他内容。`;
  }

  let userContent = `题目：${question}`;
  if (options) {
    userContent += `\n\n选项：\n${options}`;
  }
  
  try {
    const response = await fetch(`${openai.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openai.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });
    
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new Error('AI未能生成有效答案');
    }
    return answer;
  } catch (error) {
    console.error('❌ AI生成答案失败:', error.message);
    throw error;
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    code: 1,
    status: 'ok',
    ai_enabled: !!openai,
    timestamp: new Date().toISOString()
  });
});

async function safeJsonParse(response) {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      throw new Error('API返回空响应');
    }
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`解析失败: ${error.message}`);
  }
}

function generateSystemPrompt(questionType) {
  let systemPrompt = `你是一个专业的题库助手，专门帮助用户解答各类考试题目。你的任务是根据提供的题目内容，给出准确、简洁的答案。

重要规则：
1. 如果是单选题，只返回答案选项（如：A、B、C、D），不要解释
2. 如果是多选题，返回所有正确的选项（如：ABD），使用#分隔（如：A#B#D）
3. 如果是判断题，返回"正确"或"错误"
4. 如果是填空题，只返回答案内容
5. 只返回答案，不要额外的解释或说明`;

  if (questionType === 'judgement' || questionType === '判断题') {
    systemPrompt = `你是一个专业的判断题助手。题目只有"正确"或"错误"两个选项。
根据题目内容判断对错，只返回"正确"或"错误"，不要任何其他内容。`;
  } else if (questionType === 'multiple' || questionType === '多选题') {
    systemPrompt = `你是一个专业的多选题助手。
根据题目内容选择所有正确的答案选项，返回格式如：A#B#D（用#分隔）
只返回选项，不要解释。`;
  } else if (questionType === 'completion' || questionType === '填空题') {
    systemPrompt = `你是一个专业的填空题助手。
根据题目内容填写正确答案。
只返回答案，不要任何其他内容。`;
  }
  
  return systemPrompt;
}

app.post('/api/answer', requireApiKey, async (req, res) => {
  try {
    const body = req.body;
    let title = '';
    let options = '';
    let type = '';

    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        title = parsed.title || parsed.Title || parsed.question || parsed.query || '';
        options = parsed.options || parsed.choices || parsed.items || '';
        type = parsed.type || parsed.questionType || parsed.category || '';
      } catch (e) {
        return res.json({ code: 0, msg: '请求体JSON解析失败' });
      }
    } else {
      title = body.title || body.Title || body.question || body.query || '';
      options = body.options || body.choices || body.items || '';
      type = body.type || body.questionType || body.category || '';
    }
    
    console.log(`📥 POST请求 (${req.apiKey?.alias || '未知Key'}) - title长度: ${title.length}`);
    
    if (!title) {
      return res.json({ code: 0, msg: '题目不能为空' });
    }

    let answer;
    let effectiveBaseUrl = '';
    let effectiveApiKey = '';
    let effectiveModel = '';
    
    if (enabledConfigId) {
      const enabledConfig = configStorage.find(c => c.id === enabledConfigId);
      if (enabledConfig) {
        effectiveBaseUrl = enabledConfig.baseUrl;
        effectiveApiKey = enabledConfig.apiKey;
        effectiveModel = enabledConfig.model;
        console.log(`✅ 使用启用配置: ${enabledConfig.name} (${effectiveModel})`);
      }
    }
    
    if (effectiveBaseUrl && effectiveApiKey && effectiveModel) {
      console.log(`📡 使用动态配置: ${effectiveModel} @ ${effectiveBaseUrl}`);

      const systemPrompt = generateSystemPrompt(type);
      const userContent = `题目：${title}${options ? '\n\n选项：\n' + options : ''}`;

      let lastError = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`🔄 第${attempt}次尝试...`);

          const chatUrl = effectiveBaseUrl.replace(/\/$/, '') + '/chat/completions';
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          const response = await fetch(chatUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${effectiveApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: effectiveModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
              ],
              temperature: 0.3,
              max_tokens: 500
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            try {
              const errorJson = JSON.parse(errorText);
              throw new Error(errorJson.error?.message || errorJson.message || `HTTP ${response.status}`);
            } catch (parseError) {
              if (parseError.message.startsWith('HTTP')) {
                throw parseError;
              }
              throw new Error(`API错误: ${errorText.substring(0, 200)}`);
            }
          }

          const data = await response.json();
          answer = data.choices?.[0]?.message?.content?.trim();

          if (!answer) {
            throw new Error('AI未返回有效答案');
          }

          console.log(`✅ AI响应成功: ${answer?.substring(0, 50)}...`);
          break;
        } catch (apiError) {
          lastError = apiError;
          console.error(`❌ 第${attempt}次尝试失败:`, apiError.message);

          if (attempt < 2 && (
            apiError.name === 'AbortError' ||
            apiError.message.includes('timeout') ||
            apiError.message.includes('upstream') ||
            apiError.message.includes('ETIMEDOUT') ||
            apiError.message.includes('ECONNRESET')
          )) {
            console.log(`⏳ 等待2秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          if (attempt === 2) {
            throw new Error(apiError.message);
          }
        }
      }

      if (!answer && lastError) {
        throw lastError;
      }
    } else {
      throw new Error('AI服务未初始化，请先配置API');
    }
    
    console.log(`✅ 生成答案: ${answer?.substring(0, 50)}...`);
    
    res.json({
      code: 1,
      title,
      answer,
      type: type || 'single'
    });
    
  } catch (error) {
    console.error('❌ 搜题失败:', error.message);
    res.json({
      code: 0,
      msg: error.message || '服务器内部错误'
    });
  }
});

app.get('/api/answer', requireApiKey, async (req, res) => {
  try {
    const { title, options, type } = req.query;
    
    if (!title) {
      return res.json({ code: 0, msg: '题目不能为空' });
    }

    console.log(`📥 GET请求 (${req.apiKey?.alias || '未知Key'}) - title: ${title.substring(0, 50)}...`);

    let answer;
    let effectiveBaseUrl = '';
    let effectiveApiKey = '';
    let effectiveModel = '';
    
    if (enabledConfigId) {
      const enabledConfig = configStorage.find(c => c.id === enabledConfigId);
      if (enabledConfig) {
        effectiveBaseUrl = enabledConfig.baseUrl;
        effectiveApiKey = enabledConfig.apiKey;
        effectiveModel = enabledConfig.model;
      }
    }
    
    if (effectiveBaseUrl && effectiveApiKey && effectiveModel) {
      const systemPrompt = generateSystemPrompt(type);
      const userContent = `题目：${title}${options ? '\n\n选项：\n' + options : ''}`;

      let lastError = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const chatUrl = effectiveBaseUrl.replace(/\/$/, '') + '/chat/completions';
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          const response = await fetch(chatUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${effectiveApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: effectiveModel,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
              ],
              temperature: 0.3,
              max_tokens: 500
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            try {
              const errorJson = JSON.parse(errorText);
              throw new Error(errorJson.error?.message || errorJson.message || `HTTP ${response.status}`);
            } catch (parseError) {
              if (parseError.message.startsWith('HTTP')) {
                throw parseError;
              }
              throw new Error(`API错误: ${errorText.substring(0, 200)}`);
            }
          }

          const data = await response.json();
          answer = data.choices?.[0]?.message?.content?.trim();

          if (!answer) {
            throw new Error('AI未返回有效答案');
          }

          break;
        } catch (apiError) {
          lastError = apiError;

          if (attempt < 2 && (
            apiError.name === 'AbortError' ||
            apiError.message.includes('timeout') ||
            apiError.message.includes('upstream')
          )) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          if (attempt === 2) {
            throw new Error(apiError.message);
          }
        }
      }

      if (!answer && lastError) {
        throw lastError;
      }
    } else {
      throw new Error('AI服务未初始化，请先配置API');
    }

    res.json({
      code: 1,
      results: [{ question: title, answer }]
    });

  } catch (error) {
    console.error('❌ GET搜题失败:', error.message);
    res.json({
      code: 0,
      msg: error.message || '服务器内部错误'
    });
  }
});

app.get('/api/models', async (req, res) => {
  try {
    const { baseUrl, apiKey } = req.query;
    
    if (!baseUrl) {
      return res.json({ code: 0, msg: 'Base URL 不能为空' });
    }

    const isAliyun = baseUrl.includes('dashscope') || baseUrl.includes('aliyun');
    const isDeepSeek = baseUrl.includes('deepseek');

    if (isDeepSeek) {
      try {
        const modelsUrl = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1`;
        
        const response = await fetch(`${modelsUrl}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const responseBody = await response.text().catch(() => '');
          res.status(200).json({
            code: 0,
            msg: responseBody.substring(0, 200),
            hint: '请检查API Key是否正确',
            httpStatus: response.status
          });
          return;
        }

        const data = await safeJsonParse(response);
        
        const modelList = (data.data || []).map(model => ({
          id: model.id,
          description: model.id,
          owned_by: model.owned_by,
          object: model.object
        }));

        res.json({
          code: 1,
          models: modelList,
          count: modelList.length,
          provider: 'deepseek',
          source: 'deepseek-api'
        });
      } catch (deepseekError) {
        res.status(200).json({
          code: 0,
          msg: deepseekError.message,
          hint: '网络连接失败，请检查网络'
        });
      }
    } else if (isAliyun) {
      try {
        const deploymentsUrl = baseUrl.includes('/compatible-mode/v1') 
          ? baseUrl.replace('/compatible-mode/v1', '/api/v1')
          : baseUrl.endsWith('/v1') 
            ? baseUrl.replace('/v1', '/api/v1')
            : baseUrl + '/api/v1';
        
        let allModels = [];
        
        for (const modelSource of ['base', 'qwen', 'chat']) {
          let pageNo = 1;
          const pageSize = 100;
          let hasMore = true;
          
          while (hasMore) {
            const apiUrl = `${deploymentsUrl}/deployments/models?page_no=${pageNo}&page_size=${pageSize}&version=v1.0&model_source=${modelSource}`;
            
            const response = await fetch(apiUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            });

            if (!response.ok) break;

            let data;
            try {
              data = await safeJsonParse(response);
            } catch (parseError) {
              break;
            }

            const models = data?.output?.models || [];
            
            if (models.length === 0) {
              hasMore = false;
              break;
            }
            
            allModels = allModels.concat(models);
            
            if (models.length < pageSize || pageNo >= 5) {
              hasMore = false;
            } else {
              pageNo++;
            }
          }
        }
        
        const uniqueModels = [];
        const seen = new Set();
        for (const model of allModels) {
          if (!seen.has(model.model_name)) {
            seen.add(model.model_name);
            uniqueModels.push(model);
          }
        }
        
        const modelList = uniqueModels.map(model => ({
          id: model.model_name,
          description: model.model_name,
          model_source: model.model_source || 'unknown',
          object: 'model'
        }));

        res.json({
          code: 1,
          models: modelList,
          count: modelList.length,
          provider: 'aliyun-bailian',
          source: 'deployments'
        });
      } catch (aliyunError) {
        res.status(200).json({
          code: 0,
          msg: aliyunError.message,
          hint: '网络连接失败，请检查网络'
        });
      }
    } else {
      res.status(200).json({
        code: 0,
        msg: '不支持该API服务提供商',
        hint: '支持 DeepSeek 和阿里云百炼'
      });
    }
  } catch (error) {
    console.error('❌ 获取模型列表失败:', error.message);
    res.json({
      code: 0,
      msg: error.message || '获取模型列表失败'
    });
  }
});

app.get('/api/models/preselected', (req, res) => {
  const models = [
    { id: 'deepseek-v4-pro', provider: 'deepseek', type: 'DeepSeek', description: 'DeepSeek V4 Pro - 最高能力版', pricing: '$2.8/1M输入, $9/1M输出' },
    { id: 'deepseek-v4-flash', provider: 'deepseek', type: 'DeepSeek', description: 'DeepSeek V4 Flash - 高性价比版', pricing: '$0.55/1M输入, $2.13/1M输出' },
    { id: 'deepseek-chat', provider: 'deepseek', type: 'DeepSeek', description: 'DeepSeek Chat (V3) - 非思考模式', pricing: '$0.27/1M输入, $1.1/1M输出' },
    { id: 'qwen-plus', provider: 'aliyun', type: '阿里云', description: '千问Plus - 增强版，128K上下文', pricing: '¥0.02/千tokens' },
    { id: 'qwen-turbo', provider: 'aliyun', type: '阿里云', description: '千问Turbo - 超快响应，高性价比', pricing: '¥0.002/千tokens' },
    { id: 'qwen-flash', provider: 'aliyun', type: '阿里云', description: '千问Flash - 高性价比', pricing: '¥0.002/千tokens' },
    { id: 'gpt-4o', provider: 'openai', type: 'OpenAI', description: 'GPT-4o - 全能型', pricing: '$5/1M输入, $15/1M输出' },
    { id: 'gpt-4o-mini', provider: 'openai', type: 'OpenAI', description: 'GPT-4o Mini - 轻量高性价比', pricing: '$0.15/1M输入, $0.6/1M输出' }
  ];

  res.json({
    code: 1,
    models,
    count: models.length
  });
});

app.get('/api/config', (req, res) => {
  const configData = {
    name: 'OCS-AI题库',
    homepage: process.env.BASE_URL || 'http://localhost:3000',
    version: '1.0.0',
    description: '基于AI的智能搜题服务'
  };
  
  res.json({
    code: 1,
    config: configData
  });
});

app.use((err, req, res, next) => {
  console.error('❌ 未处理的错误:', err);
  res.status(500).json({
    code: 0,
    msg: '服务器内部错误'
  });
});

const CONFIG_FILE = join(__dirname, '../data/configs.json');
const ENABLED_CONFIG_FILE = join(__dirname, '../data/enabled-config.json');

function ensureDataDir() {
  const dataDir = join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadConfigs() {
  ensureDataDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ 加载配置失败:', error.message);
  }
  
  const sampleConfig = {
    id: Date.now().toString(),
    name: '示例配置',
    provider: 'deepseek',
    apiKey: 'your-api-key-here',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  saveConfigs([sampleConfig]);
  enabledConfigId = sampleConfig.id;
  saveEnabledConfigId(sampleConfig.id);
  console.log('📦 首次启动，已自动创建示例 AI 配置');
  console.log('⚠️  请在管理后台修改配置，填入您的 API Key');
  
  return [sampleConfig];
}

function saveConfigs(configs) {
  ensureDataDir();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('❌ 保存配置失败:', error.message);
    return false;
  }
}

function loadEnabledConfigId() {
  try {
    if (fs.existsSync(ENABLED_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(ENABLED_CONFIG_FILE, 'utf-8'));
      return data.enabledConfigId || null;
    }
  } catch (error) {
    console.error('❌ 加载启用配置失败:', error.message);
  }
  return null;
}

function saveEnabledConfigId(id) {
  try {
    fs.writeFileSync(ENABLED_CONFIG_FILE, JSON.stringify({ enabledConfigId: id }), 'utf-8');
    return true;
  } catch (error) {
    console.error('❌ 保存启用配置失败:', error.message);
    return false;
  }
}

let enabledConfigId = null;
let configStorage = loadConfigs();
enabledConfigId = loadEnabledConfigId();
initAdmin();
initApiKeys();
console.log(`📦 已加载 ${configStorage.length} 个配置`);
console.log(`📦 启用的配置: ${enabledConfigId || '无'}`);

app.get('/api/configs', requireAuth, (req, res) => {
  const configsWithStatus = configStorage.map(c => ({
    ...c,
    enabled: c.id === enabledConfigId
  }));
  res.json({
    code: 1,
    configs: configsWithStatus
  });
});

app.get('/api/configs/enabled', (req, res) => {
  if (!enabledConfigId) {
    return res.json({
      code: 0,
      msg: '没有启用的配置'
    });
  }
  
  const config = configStorage.find(c => c.id === enabledConfigId);
  
  if (config) {
    res.json({
      code: 1,
      config
    });
  } else {
    return res.json({
      code: 0,
      msg: '启用的配置不存在'
    });
  }
});

app.post('/api/configs', requireAuth, (req, res) => {
  const config = {
    id: Date.now().toString(),
    name: req.body.name || '未命名配置',
    provider: req.body.provider,
    apiKey: req.body.apiKey,
    baseUrl: req.body.baseUrl,
    model: req.body.model,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  configStorage.push(config);
  
  if (saveConfigs(configStorage)) {
    console.log(`✅ 配置已保存: ${config.name}`);
    res.json({
      code: 1,
      msg: '配置保存成功',
      config
    });
  } else {
    res.json({
      code: 0,
      msg: '配置保存失败'
    });
  }
});

app.get('/api/configs/:id', requireAuth, (req, res) => {
  const config = configStorage.find(c => c.id === req.params.id);
  
  if (config) {
    res.json({
      code: 1,
      config
    });
  } else {
    res.json({
      code: 0,
      msg: '配置不存在'
    });
  }
});

app.post('/api/configs/:id/enable', requireAuth, (req, res) => {
  const config = configStorage.find(c => c.id === req.params.id);
  
  if (!config) {
    return res.json({
      code: 0,
      msg: '配置不存在'
    });
  }
  
  enabledConfigId = req.params.id;
  
  if (saveEnabledConfigId(enabledConfigId)) {
    console.log(`✅ 已启用配置: ${config.name} (${config.model})`);
    res.json({
      code: 1,
      msg: '配置已启用',
      config
    });
  } else {
    res.json({
      code: 0,
      msg: '启用配置保存失败'
    });
  }
});

app.post('/api/configs/:id/disable', requireAuth, (req, res) => {
  const config = configStorage.find(c => c.id === req.params.id);
  
  if (!config) {
    return res.json({
      code: 0,
      msg: '配置不存在'
    });
  }
  
  if (enabledConfigId !== req.params.id) {
    return res.json({
      code: 0,
      msg: '该配置未启用'
    });
  }
  
  enabledConfigId = null;
  
  if (saveEnabledConfigId(null)) {
    console.log(`✅ 已禁用配置: ${config.name}`);
    res.json({
      code: 1,
      msg: '配置已禁用'
    });
  } else {
    res.json({
      code: 0,
      msg: '禁用配置保存失败'
    });
  }
});

app.post('/api/configs/:id/test-latency', requireAuth, async (req, res) => {
  try {
    const config = configStorage.find(c => c.id === req.params.id);

    if (!config) {
      return res.json({
        code: 0,
        msg: '配置不存在'
      });
    }

    const startTime = Date.now();
    const testUrl = `${config.baseUrl.replace(/\/$/, '')}/v1/models`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeout);
      const latency = Date.now() - startTime;

      res.json({
        code: 1,
        latency,
        status: 'success',
        message: `延迟 ${latency}ms`
      });
    } catch (fetchError) {
      const latency = Date.now() - startTime;

      if (fetchError.name === 'AbortError') {
        return res.json({
          code: 0,
          latency,
          status: 'timeout',
          message: `请求超时 (${latency}ms)`
        });
      }

      res.json({
        code: 1,
        latency,
        status: 'error',
        message: `连接失败: ${fetchError.message.substring(0, 50)}`
      });
    }
  } catch (error) {
    res.json({
      code: 0,
      msg: error.message
    });
  }
});

app.put('/api/configs/:id', requireAuth, (req, res) => {
  const index = configStorage.findIndex(c => c.id === req.params.id);
  
  if (index !== -1) {
    configStorage[index] = {
      ...configStorage[index],
      name: req.body.name || configStorage[index].name,
      provider: req.body.provider || configStorage[index].provider,
      apiKey: req.body.apiKey || configStorage[index].apiKey,
      baseUrl: req.body.baseUrl || configStorage[index].baseUrl,
      model: req.body.model || configStorage[index].model,
      updatedAt: new Date().toISOString()
    };
    
    if (saveConfigs(configStorage)) {
      res.json({
        code: 1,
        msg: '配置更新成功',
        config: configStorage[index]
      });
    } else {
      res.json({
        code: 0,
        msg: '配置更新失败'
      });
    }
  } else {
    res.json({
      code: 0,
      msg: '配置不存在'
    });
  }
});

app.delete('/api/configs/:id', requireAuth, (req, res) => {
  const index = configStorage.findIndex(c => c.id === req.params.id);
  
  if (index !== -1) {
    const deleted = configStorage.splice(index, 1)[0];
    
    if (saveConfigs(configStorage)) {
      console.log(`✅ 配置已删除: ${deleted.name}`);
      res.json({
        code: 1,
        msg: '配置删除成功',
        config: deleted
      });
    } else {
      res.json({
        code: 0,
        msg: '配置删除失败'
      });
    }
  } else {
    res.json({
      code: 0,
      msg: '配置不存在'
    });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await login(username, password);
    res.json(result);
  } catch (error) {
    res.json({ success: false, msg: '登录失败' });
  }
});

app.post('/api/admin/change-password', async (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;
    const result = changePassword(username, oldPassword, newPassword);
    res.json(result);
  } catch (error) {
    console.error('修改密码失败:', error);
    res.json({ success: false, msg: '修改失败' });
  }
});

app.get('/api/admin/status', requireAuth, (req, res) => {
  const status = getAdminStatus();
  res.json(status);
});

app.get('/api/admin/stats', requireAuth, (req, res) => {
  const stats = getStats();
  res.json(stats);
});

app.get('/api/admin/apikeys', requireAuth, (req, res) => {
  res.json({ success: true, keys: getApiKeys() });
});

app.post('/api/admin/apikeys', requireAuth, (req, res) => {
  try {
    const { alias, expiresAt, maxCalls } = req.body;
    const apiKeyData = generateApiKey(alias || '未命名', { expiresAt, maxCalls });
    res.json({
      success: true,
      msg: 'API Key生成成功',
      key: apiKeyData
    });
  } catch (error) {
    res.json({ success: false, msg: '生成失败' });
  }
});

app.put('/api/admin/apikeys/:key', requireAuth, (req, res) => {
  try {
    const decodedKey = decodeURIComponent(req.params.key);
    const { alias, expiresAt, maxCalls } = req.body;
    const result = updateApiKey(decodedKey, { alias, expiresAt, maxCalls });
    res.json(result);
  } catch (error) {
    res.json({ success: false, msg: '更新失败' });
  }
});

app.post('/api/admin/apikeys/:key/toggle', requireAuth, (req, res) => {
  try {
    const decodedKey = decodeURIComponent(req.params.key);
    const result = toggleApiKey(decodedKey);
    res.json(result);
  } catch (error) {
    res.json({ success: false, msg: '操作失败' });
  }
});

app.post('/api/admin/apikeys/:key/regenerate', requireAuth, (req, res) => {
  try {
    const decodedKey = decodeURIComponent(req.params.key);
    const result = regenerateApiKey(decodedKey);
    res.json(result);
  } catch (error) {
    res.json({ success: false, msg: '重新生成失败' });
  }
});

app.delete('/api/admin/apikeys/:key', requireAuth, (req, res) => {
  try {
    const decodedKey = decodeURIComponent(req.params.key);
    const result = deleteApiKey(decodedKey);
    res.json(result);
  } catch (error) {
    res.json({ success: false, msg: '删除失败' });
  }
});

function startServer() {
  if (configStorage.length > 0) {
    const primaryConfig = configStorage[0];
    console.log(`📦 找到 ${configStorage.length} 个配置，使用 "${primaryConfig.name}" 初始化AI`);
    initOpenAI(primaryConfig);
  } else {
    initOpenAI();
  }
  
  app.listen(PORT, HOST, () => {
    console.log('='.repeat(50));
    console.log(`🚀 OCS AI搜题后端服务已启动`);
    console.log(`📡 服务地址: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`🔍 搜题接口: POST /api/answer`);
    console.log(`🔍 搜题接口: GET /api/search`);
    console.log(`❤️  健康检查: GET /api/health`);
    console.log(`🔐 管理后台: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/login.html`);
    console.log('='.repeat(50));
    
    if (!openai) {
      console.warn('⚠️  警告: AI功能未启用，请先在管理后台配置AI模型');
    }
  });
}

startServer();

export { app };
