# OCS AI 搜题后端

基于 AI 的智能搜题后端服务，为 OCS 刷题脚本提供 AI 答题功能。支持 DeepSeek、阿里云百炼、OpenAI 等多种 AI 提供商。

## 功能特性

- 🔐 **安全认证** - 管理员账户 + API Key 双重验证
- 🤖 **多 AI 提供商支持** - DeepSeek、阿里云百炼、OpenAI 等
- ⚡ **一键启用配置** - 从配置列表中选择启用，外部调用自动使用
- 🎯 **智能答题** - 支持单选、多选、判断、填空等题型
- 📊 **API Key 管理** - 生成、编辑、禁用、调用统计
- 🌐 **跨平台兼容** - 适配 OCS 刷题脚本、Tampermonkey 等
- 📊 **可视化配置** - Web 管理界面，简洁易用
- 🔧 **灵活部署** - 支持 PM2、Docker、Systemd 等多种方式

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

### 3. 首次登录（必须改密码）

1. 访问 http://localhost:3000/login.html
2. 使用默认账户登录：
   - 用户名：`admin`
   - 密码：`admin123`
3. **首次登录必须修改密码**，新密码至少 6 位

### 4. 配置 AI 并生成 API Key

1. 打开 Web 界面 http://localhost:3000
2. 点击右上角「管理后台」进入管理页面
3. 在左侧添加 AI 配置（API Key、Base URL、模型）
4. 点击「获取模型列表」选择模型并保存
5. 在配置列表中点击 ✓ 启用该配置
6. 在「API Key 管理」页面点击「生成新 Key」创建 API Key

### 5. 配置 OCS 脚本

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
    apiKey: "你的APIKey",
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
  "apiKey": "ocs_xxxxxxxxxxxx",
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
GET /api/answer?apiKey=xxx&title=题目内容&options=选项&type=single
```

### 错误响应

API Key 无效或过期时返回：

```json
{
  "code": 401,
  "msg": "API Key 无效或已过期"
}
```

## 管理员 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | /api/admin/login | 管理员登录 | 无 |
| POST | /api/admin/change-password | 修改密码 | 可选 |
| GET | /api/admin/status | 获取管理员状态 | Token |
| GET | /api/admin/stats | 获取统计信息 | Token |
| GET | /api/admin/apikeys | 获取所有 API Key | Token |
| POST | /api/admin/apikeys | 创建 API Key | Token |
| PUT | /api/admin/apikeys/:key | 更新 API Key | Token |
| POST | /api/admin/apikeys/:key/toggle | 启用/禁用 | Token |
| POST | /api/admin/apikeys/:key/regenerate | 重新生成 | Token |
| DELETE | /api/admin/apikeys/:key | 删除 API Key | Token |

### 认证方式

管理员操作需要携带 Token：

```http
X-Admin-Token: your-admin-token
```

## 配置管理 API

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | /api/configs | 获取所有配置 | Token |
| GET | /api/configs/enabled | 获取启用的配置 | 无 |
| POST | /api/configs | 创建新配置 | Token |
| GET | /api/configs/:id | 获取单个配置 | Token |
| PUT | /api/configs/:id | 更新配置 | Token |
| DELETE | /api/configs/:id | 删除配置 | Token |
| POST | /api/configs/:id/enable | 启用配置 | Token |
| POST | /api/configs/:id/disable | 禁用配置 | Token |

## API Key 管理

### 创建 API Key

在管理后台可以设置：
- **别名**：用于识别的名称（如 "OCS刷题脚本"）
- **有效期**：设置过期时间（可选）
- **次数限制**：设置最大调用次数（可选）

### 校验规则

API Key 必须满足以下条件：
1. 存在且未被禁用
2. 未过期（或无过期时间）
3. 剩余次数 > 0（或无次数限制）

### 统计

每个 API Key 记录：
- 调用次数
- 最后调用时间
- 启用/禁用状态

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

### Q: 首次登录需要做什么？

A: 首次登录必须修改密码。使用默认账户 `admin` / `admin123` 登录后，系统会强制要求设置新密码。

### Q: 如何获取 API Key？

A: 登录管理后台（http://localhost:3000/admin.html），在「API Key 管理」页面点击「生成新 Key」。

### Q: API Key 校验失败？

A: 检查以下几点：
1. API Key 是否正确填写
2. API Key 是否被禁用
3. API Key 是否过期
4. API Key 是否达到调用次数上限

### Q: 如何查看 API 调用统计？

A: 登录管理后台，在「API Key 管理」页面可以看到每个 Key 的调用次数。

### Q: AI 功能不可用？

A: 检查是否已添加配置并启用。配置列表中显示「已启用」标签表示该配置已启用。

### Q: 如何更新服务器？

A: `git pull` 后重启服务即可。数据文件保存在 `data/` 目录，重启后不会丢失。

## 目录结构

```
ocs-ai-answer-backend/
├── src/
│   ├── index.js          # 服务端主程序
│   └── auth.js           # 认证模块
├── public/
│   ├── index.html        # Web 配置界面
│   ├── login.html        # 管理员登录
│   └── admin.html        # 管理后台
├── data/
│   ├── configs.json       # AI 配置存储
│   ├── enabled-config.json # 启用的配置
│   ├── admin.json         # 管理员账户
│   └── api-keys.json      # API Keys
├── docs/
│   └── adr/               # 架构决策记录
├── logs/                  # 日志目录
├── manage.sh             # 服务管理脚本
├── start.sh              # 启动脚本
├── package.json
└── README.md
```

## License

MIT
