# OCS AI 搜题配置指南

本文档说明如何在 OCS 刷题脚本中配置使用 AI 搜题功能。

## 前置条件

1. 已部署 OCS AI 搜题后端服务
2. 已在后端生成 API Key
3. 已在后端配置并启用 AI 模型
4. 已安装 OCS 刷题脚本

## 配置步骤

### 1. 获取服务器地址

确定你的后端服务地址，例如：
- 本地开发：`http://localhost:3000`
- 服务器部署：`http://你的服务器IP:45419`

### 2. 在管理后台生成 API Key

1. 访问管理后台：http://你的服务器地址:3000/admin.html
2. 登录后进入「API Key 管理」页面
3. 点击「生成新 Key」
4. 填写别名（用于识别，如 "OCS刷题"）
5. 点击「生成」
6. **复制生成的 API Key**

### 3. 在 Web 界面配置 OCS

1. 打开后端 Web 界面
2. 在「OCS 题库配置代码」区域：
   - 填入服务器地址
   - 填入刚才复制的 API Key
3. 点击「复制配置代码」按钮

### 4. 配置 OCS 脚本

将复制的配置代码添加到 OCS 刷题脚本的题库配置中。

## 配置示例

### POST 请求配置

```javascript
{
  name: "AI智能搜题",
  homepage: "http://localhost:3000",
  url: "http://localhost:3000/api/answer",
  method: "post",
  type: "GM_xmlhttpRequest",
  contentType: "json",
  data: {
    apiKey: "ocs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    title: "${title}",
    options: "${options}",
    type: "${type}"
  },
  handler: "return (res)=> res.code === 1 ? [res.title, res.answer] : undefined"
}
```

### GET 请求配置

```javascript
{
  name: "AI智能搜题",
  homepage: "http://localhost:3000",
  url: "http://localhost:3000/api/answer",
  method: "get",
  type: "GM_xmlhttpRequest",
  contentType: "json",
  data: {
    apiKey: "ocs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    title: "${title}",
    options: "${options}",
    type: "${type}"
  },
  handler: "return (res)=> res.code === 1 ? [res.title, res.answer] : undefined"
}
```

## 字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| name | 题库名称（显示在脚本中） | "AI智能搜题" |
| homepage | 题库首页 | "http://localhost:3000" |
| url | 搜题接口地址 | "http://localhost:3000/api/answer" |
| method | 请求方法 | "post" 或 "get" |
| type | 请求类型 | "GM_xmlhttpRequest" |
| contentType | 响应数据格式 | "json" |
| data | 发送到接口的参数 | 见下方说明 |
| handler | 处理响应数据的函数 | 见下方说明 |

## data 字段

传递给 API 的参数：

| 字段 | 说明 | 示例 |
|------|------|------|
| apiKey | API Key（必须） | "ocs_xxxxxxxx..." |
| title | 题目标题（必须） | "以下哪个是中国的首都？" |
| options | 题目选项（可选） | "A. 上海\nB. 北京\nC. 广州\nD. 深圳" |
| type | 题目类型（可选） | "single" |

## handler 函数

handler 函数负责解析 API 响应并返回答案：

```javascript
handler: "return (res)=> res.code === 1 ? [res.title, res.answer] : undefined"
```

解析逻辑：
- `res.code === 1` 表示成功响应
- 返回 `[题目, 答案]` 数组
- 返回 `undefined` 表示未找到答案

## 题目类型

| 类型 | 说明 | 示例 |
|------|------|------|
| single | 单选题 | 选择一个正确答案 |
| multiple | 多选题 | 选择多个正确答案 |
| judgement | 判断题 | 正确/错误 |
| completion | 填空题 | 填写答案 |

## API Key 说明

### 获取 API Key

1. 登录管理后台
2. 进入「API Key 管理」页面
3. 点击「生成新 Key」
4. 设置别名和限制（可选）
5. 点击「生成」
6. **立即复制并妥善保管**

### API Key 格式

```
ocs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

以 `ocs_` 开头，后跟 48 位随机字符。

### API Key 限制

生成 API Key 时可以设置：
- **有效期**：设置过期时间，到期后 Key 自动失效
- **次数限制**：设置最大调用次数，达到后 Key 自动失效

### API Key 校验失败

如果返回 `code: 401`，检查：
1. API Key 是否正确填写
2. API Key 是否被禁用
3. API Key 是否过期
4. API Key 是否达到调用次数上限

## 多题库配置

支持同时配置多个题库，按顺序尝试：

```javascript
const answerWrappers = [
  {
    name: "AI智能搜题",
    url: "http://localhost:3000/api/answer",
    data: {
      apiKey: "ocs_xxx",
      // ... 其他配置
    },
    handler: "..."
  },
  {
    name: "本地题库",
    url: "http://localhost:8080/search",
    // ... 其他配置
  }
];
```

## 注意事项

### 1. 跨域配置

如果 OCS 脚本部署在不同域名，需要在脚本头部添加：

```javascript
// ==UserScript==
// @connect localhost
// @connect 你的服务器域名
// ==/UserScript==
```

### 2. CORS 配置

后端已配置 CORS 允许跨域请求，无需额外配置。

### 3. API 响应格式

- 成功：`{ code: 1, title: "题目", answer: "答案" }`
- 失败：`{ code: 0, msg: "错误信息" }`
- 未授权：`{ code: 401, msg: "API Key 无效或已过期" }`

### 4. 网络超时

AI 生成答案通常需要 3-10 秒，请确保 OCS 脚本的超时设置足够长。

## 故障排查

### 问题：返回 undefined

1. 检查服务器是否正常运行：`curl http://localhost:3000/api/health`
2. 检查 API Key 是否正确
3. 检查 API 是否返回正确格式
4. 查看服务器日志排查问题

### 问题：CORS 错误

1. 确认服务器已启动
2. 检查 `@connect` 指令是否包含服务器域名

### 问题：返回 "API Key 无效或已过期"

1. 确认 API Key 填写正确
2. 确认 API Key 未被禁用
3. 确认 API Key 未过期
4. 确认 API Key 未达到调用次数上限

### 问题：AI 未返回答案

1. 确认已在 Web 界面启用配置
2. 检查 API Key 是否有效
3. 查看服务器日志中的 AI 调用记录
