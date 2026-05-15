# OCS AI 搜题后端 - 领域模型

## 术语表

### 管理员 (Admin)
- 拥有 Web 管理界面的访问权限
- 可以管理 AI 配置、API Keys
- 需要登录认证

### API Key
- 用于 OCS 客户端调用搜题接口的身份凭证
- 由管理员生成和管理
- 包含别名（易识别）和完整 Key 值
- 支持过期时间和使用次数限制

### 会话 Token
- 管理员登录后获得的访问凭证
- 存储在客户端 localStorage
- 用于验证管理员操作

## 约束规则

### API Key 校验规则
1. 请求必须包含 `apiKey` 字段
2. API Key 必须存在且未被禁用
3. API Key 未过期（或无过期时间）
4. API Key 剩余次数 > 0（或无次数限制）

### 管理员登录规则
1. 首次登录必须修改密码
2. 密码存储为明文
3. 登录成功后获取会话 Token

## 数据模型

### 管理员账户
```
Admin {
  id: string,
  username: string,
  password: string,
  mustChangePassword: boolean,
  createdAt: timestamp
}
```

### API Key
```
ApiKey {
  id: string,
  alias: string,           // 简短别名
  key: string,            // 完整 Key（sk_xxx）
  callCount: number,       // 调用次数
  maxCalls: number|null,   // 最大次数限制（null = 无限制）
  expiresAt: timestamp|null, // 过期时间（null = 永不过期）
  disabled: boolean,      // 是否禁用
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 调用统计
```
Stats {
  apiKeyId: string,
  callCount: number,
  lastCallAt: timestamp
}
```
