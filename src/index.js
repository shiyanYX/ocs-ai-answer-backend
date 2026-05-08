import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());
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
      openai = new OpenAI({
        apiKey,
        baseURL
      });
      console.log('✅ AI客户端初始化成功（使用配置）');
      return openai;
    } else {
      console.warn('⚠️  未找到可用配置，AI功能暂时不可用');
      return null;
    }
  }
  
  openai = new OpenAI({
    apiKey,
    baseURL
  });
  
  console.log('✅ AI客户端初始化成功');
  return openai;
}

async function generateAnswer(question, options = '', questionType = '') {
  if (!openai) {
    throw new Error('AI服务未初始化，请检查API配置');
  }
  
  const model = process.env.AI_MODEL || 'gpt-3.5-turbo';
  
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
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.3,
      max_tokens: 500
    });
    
    const answer = response.choices[0]?.message?.content?.trim();
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

// 安全地解析JSON响应
async function safeJsonParse(response) {
  try {
    const text = await response.text();
    console.log(`📤 API响应内容: ${text.substring(0, 500)}...`);
    
    if (!text || text.trim() === '') {
      throw new Error('API返回空响应');
    }
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error('❌ JSON解析失败:', parseError.message);
      throw new Error(`API返回的内容不是有效的JSON: ${text.substring(0, 200)}...`);
    }
  } catch (error) {
    console.error('❌ 读取响应失败:', error.message);
    throw error;
  }
}

app.post('/api/answer', async (req, res) => {
  try {
    const { title, options, type, baseUrl, apiKey, model } = req.body;
    
    console.log(`📥 POST请求: title=${title?.substring(0, 50)}...`);
    console.log(`📋 配置: baseUrl=${baseUrl?.substring(0, 60)} model=${model}`);
    
    if (!title) {
      return res.json({
        code: 0,
        msg: '题目不能为空'
      });
    }

    let answer;
    
    if (baseUrl && apiKey && model) {
      console.log(`📡 使用动态配置: ${model} @ ${baseUrl}`);

      const systemPrompt = generateSystemPrompt(type);
      const userContent = `题目：${title}${options ? '\n\n选项：\n' + options : ''}`;

      console.log(`📝 发送请求到AI API...`);

      let lastError = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          console.log(`🔄 第${attempt}次尝试...`);

          const chatUrl = baseUrl.replace(/\/$/, '') + '/chat/completions';
          console.log(`📡 请求URL: ${chatUrl}`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          const response = await fetch(chatUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: model,
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
            console.error(`❌ API错误 (${response.status}):`, errorText.substring(0, 200));

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
    } else if (openai) {
      answer = await generateAnswer(title, options || '', type || '');
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

app.get('/api/answer', async (req, res) => {
  try {
    const { title, options, type, baseUrl, apiKey, model } = req.query;
    
    if (!title) {
      return res.json({
        code: 0,
        msg: '题目不能为空'
      });
    }

    let answer;
    
    if (baseUrl && apiKey && model) {
      const dynamicOpenAI = new OpenAI({
        apiKey: apiKey,
        baseURL: baseUrl
      });
      
      const systemPrompt = generateSystemPrompt(type);
      const userContent = `题目：${title}${options ? '\n\n选项：\n' + options : ''}`;
      
      const response = await dynamicOpenAI.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        max_tokens: 500
      });
      
      answer = response.choices[0]?.message?.content?.trim();
    } else if (openai) {
      answer = await generateAnswer(title, options || '', type || '');
    } else {
      throw new Error('AI服务未初始化，请先配置API');
    }
    
    console.log(`✅ GET请求生成答案: ${answer}`);
    
    res.json({
      code: 1,
      results: [
        {
          question: title,
          answer
        }
      ]
    });
    
  } catch (error) {
    console.error('❌ GET搜题失败:', error.message);
    res.json({
      code: 0,
      msg: error.message || '服务器内部错误'
    });
  }
});

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

app.get('/api/search', async (req, res) => {
  try {
    const { title, options, type } = req.query;
    
    if (!title) {
      return res.json({
        code: 0,
        msg: '题目不能为空'
      });
    }
    
    console.log(`🔍 GET请求搜题 - 题目: ${title.substring(0, 50)}...`);
    
    const answer = await generateAnswer(title, options || '', type || '');
    
    res.json({
      code: 1,
      results: [
        {
          question: title,
          answer
        }
      ]
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
      return res.json({
        code: 0,
        msg: 'Base URL 不能为空'
      });
    }

    console.log(`🔍 获取模型列表 - Base URL: ${baseUrl}`);

    const isAliyun = baseUrl.includes('dashscope') || baseUrl.includes('aliyun');
    const isDeepSeek = baseUrl.includes('deepseek');

    if (isDeepSeek) {
      try {
        const modelsUrl = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1`;
        
        console.log(`🔍 调用DeepSeek API: ${modelsUrl}/models`);
        
        const response = await fetch(`${modelsUrl}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const responseBody = await response.text().catch(() => '');
          const errorMessage = responseBody.substring(0, 200);
          console.error('❌ DeepSeek API错误:', errorMessage);
          
          res.status(200).json({
            code: 0,
            msg: errorMessage,
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

        console.log(`✅ 成功从DeepSeek获取 ${modelList.length} 个模型`);

        res.json({
          code: 1,
          models: modelList,
          count: modelList.length,
          provider: 'deepseek',
          source: 'deepseek-api'
        });
      } catch (deepseekError) {
        console.error('❌ DeepSeek模型列表获取失败:', deepseekError.message);
        
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
        
        let pageNo = 1;
        const pageSize = 100;
        let hasMore = true;
        
        while (hasMore) {
          const apiUrl = `${deploymentsUrl}/deployments/models?page_no=${pageNo}&page_size=${pageSize}&version=v1.0`;
          
          console.log(`🔍 调用阿里云百炼API (page ${pageNo}): ${apiUrl}`);
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            console.warn(`⚠️ 获取模型失败，HTTP状态: ${response.status}`);
            break;
          }

          let data;
          try {
            data = await safeJsonParse(response);
          } catch (parseError) {
            console.warn(`⚠️ JSON解析失败: ${parseError.message}`);
            break;
          }

          const models = data?.output?.models || [];
          
          if (models.length === 0) {
            hasMore = false;
            break;
          }
          
          allModels = allModels.concat(models);
          console.log(`✅ 第${pageNo}页获取 ${models.length} 个模型，累计: ${allModels.length}`);
          
          if (models.length < pageSize || pageNo >= 10) {
            hasMore = false;
          } else {
            pageNo++;
          }
        }
        
        const modelSources = ['base', 'qwen', 'chat', 'embedding', 'image', 'video', 'audio'];
        
        for (const modelSource of modelSources) {
          let pageNo = 1;
          const pageSize = 100;
          let hasMore = true;
          
          while (hasMore) {
            const apiUrl = `${deploymentsUrl}/deployments/models?page_no=${pageNo}&page_size=${pageSize}&version=v1.0&model_source=${modelSource}`;
            
            console.log(`🔍 调用阿里云百炼API (${modelSource}, page ${pageNo}): ${apiUrl}`);
            
            const response = await fetch(apiUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            });

            if (!response.ok) {
              console.warn(`⚠️ 获取${modelSource}模型失败`);
              break;
            }

            let data;
            try {
              data = await safeJsonParse(response);
            } catch (parseError) {
              console.warn(`⚠️ JSON解析失败: ${parseError.message}`);
              break;
            }

            const models = data?.output?.models || [];
            
            if (models.length === 0) {
              hasMore = false;
              break;
            }
            
            allModels = allModels.concat(models);
            console.log(`✅ 第${pageNo}页获取 ${models.length} 个${modelSource}模型，累计: ${allModels.length}`);
            
            if (models.length < pageSize || pageNo >= 10) {
              hasMore = false;
            } else {
              pageNo++;
            }
          }
        }
        
        try {
          const openAiUrl = baseUrl.includes('/v1') ? baseUrl : `${baseUrl}/v1`;
          const response = await fetch(`${openAiUrl}/models`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await safeJsonParse(response);
            const models = data?.data || [];
            if (models.length > 0) {
              allModels = allModels.concat(models.map(m => ({
                model_name: m.id,
                model_source: 'openai-compatible'
              })));
              console.log(`✅ 从OpenAI兼容接口获取 ${models.length} 个模型`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ OpenAI兼容接口获取失败: ${error.message}`);
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
          plans: model.plans?.length || 0,
          object: 'model'
        }));

        console.log(`✅ 成功从阿里云百炼获取 ${modelList.length} 个模型（去重后）`);

        res.json({
          code: 1,
          models: modelList,
          count: modelList.length,
          provider: 'aliyun-bailian',
          source: 'deployments'
        });
      } catch (aliyunError) {
        console.error('❌ 阿里云百炼模型列表获取失败');
        console.error('错误消息:', aliyunError.message);
        
        res.status(200).json({
          code: 0,
          msg: aliyunError.message,
          hint: '网络连接失败，请检查网络'
        });
      }
    } else {
      try {
        const tempOpenAI = new OpenAI({
          apiKey: apiKey || 'dummy-key',
          baseURL: baseUrl
        });

        const models = await tempOpenAI.models.list();
        
        const modelList = models.data.map(model => ({
          id: model.id,
          description: model.id,
          created: model.created,
          object: model.object
        }));

        console.log(`✅ 成功获取 ${modelList.length} 个模型`);

        res.json({
          code: 1,
          models: modelList,
          count: modelList.length,
          provider: 'openai',
          source: 'openai-compatible'
        });
      } catch (apiError) {
        console.error('❌ 获取模型列表失败:', apiError.message);
        
        let errorMsg = '获取模型列表失败';
        if (apiError.response?.data) {
          if (typeof apiError.response.data === 'object') {
            errorMsg = apiError.response.data.message || apiError.response.data.error || JSON.stringify(apiError.response.data);
          } else if (typeof apiError.response.data === 'string') {
            errorMsg = apiError.response.data;
          }
        } else if (apiError.message) {
          errorMsg = apiError.message;
        }
        
        res.status(200).json({
          code: 0,
          msg: errorMsg,
          hint: 'API可能不支持模型列表查询'
        });
      }
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
    { id: 'deepseek-reasoner', provider: 'deepseek', type: 'DeepSeek', description: 'DeepSeek Reasoner (R1) - 思考推理模式', pricing: '$0.55/1M输入, $2.13/1M输出' },
    { id: 'deepseek-v3-0324', provider: 'deepseek', type: 'DeepSeek', description: 'DeepSeek V3 (0324) - 通用对话', pricing: '$0.27/1M输入, $1.1/1M输出' },
    { id: 'deepseek-r1-distill-qwen-14b', provider: 'deepseek', type: 'DeepSeek', description: 'DeepSeek R1蒸馏版(Qwen-14B) - 轻量推理', pricing: '$0.14/1M输入, $0.28/1M输出' },
    { id: 'deepseek-r1-distill-qwen-32b', provider: 'deepseek', type: 'DeepSeek', description: 'DeepSeek R1蒸馏版(Qwen-32B) - 增强推理', pricing: '$0.28/1M输入, $0.56/1M输出' },
    { id: 'deepseek-r1-distill-llama-8b', provider: 'deepseek', type: 'DeepSeek', description: 'DeepSeek R1蒸馏版(Llama-8B) - 轻量推理', pricing: '$0.07/1M输入, $0.14/1M输出' },
    { id: 'deepseek-r1-distill-llama-70b', provider: 'deepseek', type: 'DeepSeek', description: 'DeepSeek R1蒸馏版(Llama-70B) - 强推理', pricing: '$0.35/1M输入, $0.7/1M输出' },
    { id: 'qwen3-max', provider: 'aliyun', type: '阿里云', description: '千问3 Max - 最新最强能力', pricing: '¥0.04/千tokens' },
    { id: 'qwen3-max-preview', provider: 'aliyun', type: '阿里云', description: '千问3 Max 预览版', pricing: '¥0.04/千tokens' },
    { id: 'qwen-max', provider: 'aliyun', type: '阿里云', description: '千问Max - 最强文本生成能力', pricing: '¥0.04/千tokens' },
    { id: 'qwen-max-latest', provider: 'aliyun', type: '阿里云', description: '千问Max 最新版', pricing: '¥0.04/千tokens' },
    { id: 'qwen3.6-plus', provider: 'aliyun', type: '阿里云', description: '千问3.6 Plus - 最新增强版', pricing: '¥0.02/千tokens' },
    { id: 'qwen-plus', provider: 'aliyun', type: '阿里云', description: '千问Plus - 增强版，128K上下文', pricing: '¥0.02/千tokens' },
    { id: 'qwen-plus-latest', provider: 'aliyun', type: '阿里云', description: '千问Plus 最新版', pricing: '¥0.02/千tokens' },
    { id: 'qwen3.6-flash', provider: 'aliyun', type: '阿里云', description: '千问3.6 Flash - 极速响应', pricing: '¥0.001/千tokens' },
    { id: 'qwen3.5-flash', provider: 'aliyun', type: '阿里云', description: '千问3.5 Flash - 快速响应', pricing: '¥0.001/千tokens' },
    { id: 'qwen-flash', provider: 'aliyun', type: '阿里云', description: '千问Flash - 高性价比', pricing: '¥0.002/千tokens' },
    { id: 'qwen-turbo', provider: 'aliyun', type: '阿里云', description: '千问Turbo - 超快响应，高性价比', pricing: '¥0.002/千tokens' },
    { id: 'qwen-turbo-latest', provider: 'aliyun', type: '阿里云', description: '千问Turbo 最新版', pricing: '¥0.002/千tokens' },
    { id: 'qwq-plus', provider: 'aliyun', type: '阿里云', description: 'QwQ Plus - 推理增强版', pricing: '¥0.02/千tokens' },
    { id: 'qwen3-coder-plus', provider: 'aliyun', type: '阿里云', description: '千问3 Coder Plus - 代码专家', pricing: '¥0.02/千tokens' },
    { id: 'qwen3-coder-flash', provider: 'aliyun', type: '阿里云', description: '千问3 Coder Flash - 快速代码', pricing: '¥0.001/千tokens' },
    { id: 'qwen-coder-plus', provider: 'aliyun', type: '阿里云', description: '千问Coder Plus - 代码助手', pricing: '¥0.02/千tokens' },
    { id: 'qwen-coder-turbo', provider: 'aliyun', type: '阿里云', description: '千问Coder Turbo - 快速代码', pricing: '¥0.002/千tokens' },
    { id: 'qwen-long', provider: 'aliyun', type: '阿里云', description: '千问Long - 超长上下文（百万字）', pricing: '¥0.01/千tokens' },
    { id: 'qwen-math-plus', provider: 'aliyun', type: '阿里云', description: '千问Math Plus - 数学专家', pricing: '¥0.02/千tokens' },
    { id: 'qwen-math-turbo', provider: 'aliyun', type: '阿里云', description: '千问Math Turbo - 数学快速', pricing: '¥0.002/千tokens' },
    { id: 'gpt-4o', provider: 'openai', type: 'OpenAI', description: 'GPT-4o - 全能型', pricing: '$5/1M输入, $15/1M输出' },
    { id: 'gpt-4o-mini', provider: 'openai', type: 'OpenAI', description: 'GPT-4o Mini - 轻量高性价比', pricing: '$0.15/1M输入, $0.6/1M输出' },
    { id: 'gpt-4-turbo', provider: 'openai', type: 'OpenAI', description: 'GPT-4 Turbo - 高性能版', pricing: '$10/1M输入, $30/1M输出' },
    { id: 'gpt-3.5-turbo', provider: 'openai', type: 'OpenAI', description: 'GPT-3.5 Turbo - 快速响应，高性价比', pricing: '$0.5/1M输入, $1.5/1M输出' }
  ];

  res.json({
    code: 1,
    models,
    count: models.length,
    note: '完整模型列表（DeepSeek + 通义千问 + OpenAI）'
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
  return [];
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

let configStorage = loadConfigs();
console.log(`📦 已加载 ${configStorage.length} 个配置`);

app.get('/api/configs', (req, res) => {
  res.json({
    code: 1,
    configs: configStorage
  });
});

app.post('/api/configs', (req, res) => {
  const config = {
    id: Date.now().toString(),
    name: req.body.name || '未命名配置',
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

app.get('/api/configs/:id', (req, res) => {
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

app.post('/api/configs/:id/test-latency', async (req, res) => {
  try {
    const config = configStorage.find(c => c.id === req.params.id);

    if (!config) {
      return res.json({
        code: 0,
        msg: '配置不存在'
      });
    }

    console.log(`🔍 测试延迟: ${config.name} @ ${config.baseUrl}`);

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

      console.log(`✅ 延迟测试成功: ${latency}ms`);

      res.json({
        code: 1,
        latency,
        status: 'success',
        message: `延迟 ${latency}ms`
      });
    } catch (fetchError) {
      const latency = Date.now() - startTime;

      if (fetchError.name === 'AbortError') {
        console.error(`❌ 延迟测试超时: ${latency}ms`);
        return res.json({
          code: 0,
          latency,
          status: 'timeout',
          message: `请求超时 (${latency}ms)`
        });
      }

      console.error(`❌ 延迟测试失败:`, fetchError.message);
      res.json({
        code: 1,
        latency,
        status: 'error',
        message: `连接失败: ${fetchError.message.substring(0, 50)}`
      });
    }
  } catch (error) {
    console.error('❌ 延迟测试异常:', error.message);
    res.json({
      code: 0,
      msg: error.message
    });
  }
});

app.put('/api/configs/:id', (req, res) => {
  const index = configStorage.findIndex(c => c.id === req.params.id);
  
  if (index !== -1) {
    configStorage[index] = {
      ...configStorage[index],
      name: req.body.name || configStorage[index].name,
      apiKey: req.body.apiKey || configStorage[index].apiKey,
      baseUrl: req.body.baseUrl || configStorage[index].baseUrl,
      model: req.body.model || configStorage[index].model,
      updatedAt: new Date().toISOString()
    };
    
    if (saveConfigs(configStorage)) {
      console.log(`✅ 配置已更新: ${configStorage[index].name}`);
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

app.delete('/api/configs/:id', (req, res) => {
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
    console.log('='.repeat(50));
    
    if (!openai) {
      console.warn('⚠️  警告: AI功能未启用，请先在配置管理中添加配置');
    }
  });
}

startServer();

export { app, generateAnswer };
