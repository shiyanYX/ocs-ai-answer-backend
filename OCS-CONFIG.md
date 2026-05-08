# OCS AI搜题配置

## 后端服务配置

在OCS脚本中配置以下题库设置：

```javascript
{
  // 题库名称
  name: "AI智能搜题",
  
  // 题库首页（必填）
  homepage: "http://你的服务器地址:3000",
  
  // 请求地址
  url: "http://你的服务器地址:3000/api/search",
  
  // 请求方法
  method: "get",
  
  // 返回数据格式
  contentType: "json",
  
  // 传递的参数
  data: {
    title: "${title}",
    options: "${options}",
    type: "${type}"
  },
  
  // 响应处理函数
  handler: `
    return (res) => {
      if (res.code === 1 && res.results && res.results.length > 0) {
        const result = res.results[0];
        return [result.question, result.answer];
      }
      return undefined;
    }
  `
}
```

## 完整配置示例

```javascript
const aiSearchConfig = [
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
];
```

## POST请求配置示例

如果后端使用POST接口：

```javascript
{
  url: "http://localhost:3000/api/answer",
  name: "AI智能搜题(POST)",
  homepage: "http://localhost:3000",
  method: "post",
  contentType: "json",
  data: {
    title: "${title}",
    options: "${options}",
    type: "${type}"
  },
  handler: `
    return (res) => {
      if (res.code === 1) {
        return [res.title, res.answer];
      }
      return undefined;
    }
  `
}
```

## 多题库配置示例

支持同时配置多个题库，按顺序尝试：

```javascript
const answerWrappers = [
  {
    // AI题库
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
  },
  {
    // 其他题库...
  }
];
```

## 占位符说明

| 占位符 | 说明 |
|--------|------|
| `${title}` | 题目标题 |
| `${options}` | 题目选项 |
| `${type}` | 题目类型（single/multiple/judgement/completion）|

## 注意事项

1. **跨域配置**: 如果OCS脚本部署在不同域名，需要在脚本头部添加：
   ```javascript
   // @connect localhost
   // @connect 你的服务器域名
   ```

2. **CORS配置**: 后端已配置CORS，允许跨域请求

3. **API响应格式**:
   - 成功: `{ code: 1, results: [{ question: "题目", answer: "答案" }] }`
   - 失败: `{ code: 0, msg: "错误信息" }`
