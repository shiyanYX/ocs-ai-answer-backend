# OCS AI 搜题后端

基于 AI 的智能搜题后端服务，为 OCS 刷题脚本提供 AI 答题功能。支持 DeepSeek、阿里云百炼、OpenAI 等多种 AI 提供商。

## 功能特性

- 🤖 **多 AI 提供商支持** - DeepSeek、阿里云百炼、OpenAI 等
- ⚡ **一键启用配置** - 从配置列表中选择启用，外部调用自动使用
- 🎯 **智能答题** - 支持单选、多选、判断、填空等题型
- 🌐 **跨平台兼容** - 适配 OCS 刷题脚本、Tampermonkey 等
- 📊 **可视化配置** - Web 管理界面，简洁易用
- 🔧 **灵活部署** - 支持 PM2、Docker、Systemd 等多种方式

## 项目结构

```
ocs-ai-answer-backend/
├── src/
│   └── index.js          # 服务端主程序
├── public/
│   └── index.html        # Web 配置界面
├── data/
│   ├── configs.json       # 配置存储
│   └── enabled-config.json # 启用的配置
├── logs/                  # 日志目录
├── manage.sh             # 服务管理脚本
├── start.sh              # 启动脚本
├── package.json
└── README.md
```

## 快速开始

### 1. 安装

```bash
git clone https://github.com/shiyanYX/ocs-ai-answer-backend.git
cd ocs-ai-answer-backend
npm install
```

### 2. 启动服务

```bash
npm start
# 或使用管理脚本
./manage.sh start
```

服务启动后访问 http://localhost:3000

### 3. 配置 AI

1. 打开 Web 界面 http://localhost:3000
2. 点击「新增配置」
3. 填写 API Key、Base URL
4. 点击「获取模型列表」选择模型
5. 点击「保存修改」
6. 在配置列表中点击 ✓ 启用该配置

### 4. 配置 OCS 脚本

在 OCS 刷题脚本的题库配置中添加：

```javascript
{
  name: "AI智能搜题",
  homepage: "http://你的服务器地址:3000",
  url: "http://你的服务器地址:3000/api/answer",
  method: "post",
  type: "GM_xmlhttpRequest",
  contentType: "json",
  data: {
    title: "${title}",
    options: "${options}",
    type: "${type}"
  },
  handler: "return (res)=> res.code === 1 ? [res.title, res.answer] : undefined"
}
```

## API 接口

### 健康检查

```
GET /api/health
```

### 搜题接口（POST）

```
POST /api/answer
Content-Type: application/json

{
  "title": "题目内容",
  "options": "A. 选项1\nB. 选项2\nC. 选项3\nD. 选项4",
  "type": "single"
}
```

响应示例：

```json
{
  "code": 1,
  "title": "题目内容",
  "answer": "B",
  "type": "single"
}
```

### 搜题接口（GET）

```
GET /api/answer?title=题目内容&options=选项内容&type=single
```

## 配置管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/configs | 获取所有配置 |
| GET | /api/configs/enabled | 获取启用的配置 |
| POST | /api/configs | 创建新配置 |
| GET | /api/configs/:id | 获取单个配置 |
| PUT | /api/configs/:id | 更新配置 |
| DELETE | /api/configs/:id | 删除配置 |
| POST | /api/configs/:id/enable | 启用配置 |
| POST | /api/configs/:id/disable | 禁用配置 |

## 支持的 AI 提供商

### DeepSeek

- Base URL: `https://api.deepseek.com`
- 推荐模型: `deepseek-v4-flash`（高性价比）

### 阿里云百炼

- Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- 推荐模型: `qwen-plus`、`qwen-turbo`

### OpenAI

- Base URL: `https://api.openai.com/v1`
- 推荐模型: `gpt-4o-mini`

## 部署指南

详细部署说明请查看 [DEPLOY.md](DEPLOY.md)

### PM2 部署

```bash
npm install -g pm2
pm2 start src/index.js --name ocs-ai-backend
pm2 save
pm2 startup
```

### Docker 部署

```bash
docker build -t ocs-ai-backend .
docker run -d -p 3000:3000 ocs-ai-backend
```

### Systemd 部署

```bash
sudo cp ocs-ai-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ocs-ai-backend
sudo systemctl start ocs-ai-backend
```

## 常见问题

### Q: AI 功能不可用？

1. 检查是否已添加配置并启用
2. 确认 API Key 正确
3. 检查网络是否可以访问 AI 服务商

### Q: 如何查看日志？

```bash
# PM2 日志
pm2 logs ocs-ai-backend

# Systemd 日志
journalctl -u ocs-ai-backend -f
```

### Q: 支持哪些题目类型？

- `single` - 单选题
- `multiple` - 多选题
- `judgement` - 判断题
- `completion` - 填空题

## 管理命令

```bash
./manage.sh start    # 启动服务
./manage.sh stop      # 停止服务
./manage.sh restart   # 重启服务
./manage.sh status    # 查看状态
./manage.sh logs      # 查看日志
```

## License

MIT
