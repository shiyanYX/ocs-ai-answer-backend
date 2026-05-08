# OCS AI搜题后端

基于AI的智能搜题后端服务，为OCS刷题脚本提供AI答题功能。

## 功能特性

- 🚀 支持GET和POST两种请求方式
- 🤖 集成OpenAI API进行AI答题
- 📝 支持多种题型（单选、多选、判断、填空）
- 🔧 支持自定义AI模型和API配置
- 🌐 支持跨域访问

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# OpenAI API配置
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1

# 服务器配置
PORT=3000
HOST=0.0.0.0

# AI模型配置
AI_MODEL=gpt-3.5-turbo
```

### 3. 启动服务

```bash
npm start
```

服务启动后访问 http://localhost:3000

## API接口

### 健康检查

```
GET /api/health
```

响应示例：
```json
{
  "code": 1,
  "status": "ok",
  "ai_enabled": true,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 搜题接口（POST）

```
POST /api/answer
Content-Type: application/json

{
  "title": "以下哪个是中国的首都？",
  "options": "A. 上海\nB. 北京\nC. 广州\nD. 深圳",
  "type": "single"
}
```

响应示例：
```json
{
  "code": 1,
  "title": "以下哪个是中国的首都？",
  "answer": "B",
  "type": "single"
}
```

### 搜题接口（GET）

```
GET /api/search?title=题目内容&options=选项内容&type=题目类型
```

响应示例：
```json
{
  "code": 1,
  "results": [
    {
      "question": "题目内容",
      "answer": "答案"
    }
  ]
}
```

### 题库配置查询

```
GET /api/config
```

## OCS脚本配置

详细配置说明请查看 [OCS-CONFIG.md](OCS-CONFIG.md)

### 基础配置示例

```javascript
{
  url: "http://localhost:3000/api/search",
  name: "AI智能搜题",
  homepage: "http://localhost:3000",
  method: "get",
  contentType: "json",
  data: {
    title: "${title}",
    options: "${options}",
    type: "${type}"
  },
  handler: `
    return (res) => {
      if (res.code === 1 && res.results && res.results.length > 0) {
        return [res.results[0].question, res.results[0].answer];
      }
      return undefined;
    }
  `
}
```

## 部署说明

### Docker部署

创建 `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

构建和运行：

```bash
docker build -t ocs-ai-backend .
docker run -d -p 3000:3000 --env-file .env ocs-ai-backend
```

### PM2部署

```bash
npm install -g pm2
pm2 start src/index.js --name ocs-ai-backend
pm2 save
pm2 startup
```

### Nginx反向代理配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 支持的AI服务商

### OpenAI

```env
OPENAI_API_KEY=sk-xxxxx
OPENAI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-3.5-turbo
```

### Azure OpenAI

```env
OPENAI_API_KEY=your-azure-key
OPENAI_BASE_URL=https://your-resource.openai.azure.com
AI_MODEL=gpt-35-turbo
```

### 其他兼容API

支持任何兼容OpenAI API格式的服务，如：

- Vercel AI SDK
- FastChat
- LocalAI
- 等

## 常见问题

### Q: AI功能不可用？

检查 `.env` 文件中的 `OPENAI_API_KEY` 是否正确配置。

### Q: 跨域请求被阻止？

后端已配置CORS，如仍有问题请检查浏览器控制台。

### Q: 如何修改AI的回答风格？

编辑 `src/index.js` 中的 `systemPrompt` 变量。

### Q: 支持哪些题目类型？

- `single` - 单选题
- `multiple` - 多选题
- `judgement` - 判断题
- `completion` - 填空题

## License

MIT
