# OCS AI搜题后端 - 服务器部署指南

## 📋 前提条件

- Linux服务器（Ubuntu 20.04+ / CentOS 7+）
- Node.js 18+ 已安装
- Nginx（用于反向代理）
- 已安装Git（可选）

## 🚀 快速部署

### 方法1：使用Git克隆（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/shiyanYX/ocs-ai-answer-backend.git
cd ocs-ai-answer-backend

# 2. 安装依赖
npm install

# 3. 启动服务
chmod +x start.sh
./start.sh
```

### 方法2：手动上传部署

```bash
# 1. 上传压缩包到服务器
scp ocs-ai-answer-backend-v1.0.tar.gz user@your-server:/home/user/

# 2. 解压
ssh user@your-server
cd /home/user
tar -xzvf ocs-ai-answer-backend-v1.0.tar.gz
cd ocs-ai-answer-backend

# 3. 安装依赖
npm install

# 4. 启动服务
chmod +x start.sh
./start.sh
```

## ⚙️ 生产环境配置

### 方式1：使用PM2（推荐）

```bash
# 1. 全局安装PM2
npm install -g pm2

# 2. 创建PM2配置文件 ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'ocs-ai-backend',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# 3. 启动服务
pm2 start ecosystem.config.js

# 4. 保存PM2进程列表（开机自启）
pm2 save

# 5. 设置PM2开机自启
pm2 startup
```

**常用PM2命令：**
```bash
pm2 status              # 查看状态
pm2 logs                # 查看日志
pm2 restart ocs-ai-backend   # 重启服务
pm2 stop ocs-ai-backend      # 停止服务
pm2 delete ocs-ai-backend    # 删除服务
pm2 monit               # 实时监控
```

### 方式2：使用Systemd服务

```bash
# 1. 创建服务文件
sudo nano /etc/systemd/system/ocs-ai-backend.service
```

复制以下内容：
```ini
[Unit]
Description=OCS AI Backend Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/ocs-ai-answer-backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/ocs-ai-backend.log
StandardError=append:/var/log/ocs-ai-backend-error.log
Environment=NODE_ENV=production PORT=3000 HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
```

```bash
# 2. 重新加载systemd
sudo systemctl daemon-reload

# 3. 启动服务
sudo systemctl start ocs-ai-backend

# 4. 设置开机自启
sudo systemctl enable ocs-ai-backend

# 5. 查看状态
sudo systemctl status ocs-ai-backend
```

**常用systemd命令：**
```bash
sudo systemctl start ocs-ai-backend    # 启动
sudo systemctl stop ocs-ai-backend     # 停止
sudo systemctl restart ocs-ai-backend   # 重启
sudo systemctl status ocs-ai-backend    # 状态
sudo journalctl -u ocs-ai-backend -f    # 查看日志
```

## 🌐 Nginx反向代理配置

```bash
# 1. 创建Nginx配置文件
sudo nano /etc/nginx/sites-available/ocs-ai-backend
```

复制以下内容（根据需要修改域名）：
```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或IP

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
    }
}
```

```bash
# 2. 启用站点配置
sudo ln -s /etc/nginx/sites-available/ocs-ai-backend /etc/nginx/sites-enabled/

# 3. 测试Nginx配置
sudo nginx -t

# 4. 重启Nginx
sudo systemctl restart nginx
```

## 🔒 配置HTTPS（使用Let's Encrypt）

```bash
# 1. 安装Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# 2. 获取SSL证书（自动配置）
sudo certbot --nginx -d your-domain.com

# 3. 自动续期测试
sudo certbot renew --dry-run
```

## 🔥 防火墙配置

```bash
# 使用UFW（Ubuntu）
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status

# 或使用firewalld（CentOS）
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

## 📊 查看日志

```bash
# PM2日志
pm2 logs ocs-ai-backend

# Systemd日志
sudo journalctl -u ocs-ai-backend -f

# Nginx日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🔄 更新部署

```bash
# 1. 进入项目目录
cd /path/to/ocs-ai-answer-backend

# 2. 拉取最新代码
git pull origin main

# 3. 安装新依赖（如果有）
npm install

# 4. 重启服务
pm2 restart ocs-ai-backend
# 或
sudo systemctl restart ocs-ai-backend
```

## 🛠️ 常见问题排查

### 1. 端口被占用
```bash
# 查看端口占用
lsof -i :3000
# 或
netstat -tlnp | grep 3000

# 杀死占用进程
kill -9 <PID>
```

### 2. 权限问题
```bash
# 创建专门的用户运行服务
sudo useradd -r -s /bin/false ocs
sudo chown -R ocs:ocs /path/to/ocs-ai-answer-backend
```

### 3. 内存不足
```bash
# 增加交换空间
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 4. Node版本问题
```bash
# 检查Node版本
node -v

# 如果版本过低，使用n升级
npm install -g n
n 18
```

## 📝 环境变量配置（可选）

创建 `.env` 文件：
```bash
nano /path/to/ocs-ai-answer-backend/.env
```

内容：
```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
```

## 🎯 最终检查清单

- [ ] Node.js已安装（v18+）
- [ ] 依赖已安装
- [ ] PM2或Systemd服务已配置
- [ ] Nginx反向代理已配置
- [ ] SSL证书已配置（可选）
- [ ] 防火墙已开放80/443端口
- [ ] 服务已启动并运行
- [ ] 日志正常记录
- [ ] 开机自启已配置

## 🌟 推荐：使用Docker部署（可选）

创建 `Dockerfile`：
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "src/index.js"]
```

```bash
# 构建镜像
docker build -t ocs-ai-backend .

# 运行容器
docker run -d \
  --name ocs-backend \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  ocs-ai-backend
```

创建 `docker-compose.yml`：
```yaml
version: '3.8'
services:
  app:
    build: .
    container_name: ocs-backend
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

```bash
# 启动
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

---

## 📞 技术支持

如遇问题，请检查：
1. 服务日志：`pm2 logs` 或 `journalctl -u ocs-ai-backend`
2. Nginx日志：`/var/log/nginx/error.log`
3. 系统日志：`dmesg | tail`

祝你部署顺利！🚀
