#!/bin/bash

# OCS AI搜题后端 - 启动脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   OCS AI搜题后端启动脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到Node.js，请先安装Node.js${NC}"
    echo "访问 https://nodejs.org/ 下载安装"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js版本: $(node -v)"
echo -e "${GREEN}✓${NC} npm版本: $(npm -v)"

# 检查.env文件
if [ ! -f ".env" ]; then
    echo ""
    echo -e "${YELLOW}提示: .env文件不存在，正在创建...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓${NC} 已创建.env文件"
        echo -e "${YELLOW}请编辑.env文件配置API密钥${NC}"
    else
        echo "PORT=3000" > .env
        echo "HOST=0.0.0.0" > .env
        echo -e "${GREEN}✓${NC} 已创建基础.env文件"
    fi
fi

# 检查node_modules
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${YELLOW}正在安装依赖...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}错误: 依赖安装失败${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} 依赖安装完成"
fi

# 检查端口是否被占用
PORT=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2)
PORT=${PORT:-3000}

if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}警告: 端口 $PORT 已被占用${NC}"

    # 尝试找到并停止旧进程
    PID=$(lsof -ti:$PORT)
    if [ ! -z "$PID" ]; then
        read -p "是否停止旧进程 (PID: $PID)? [Y/n] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            echo -e "正在停止进程 $PID..."
            kill $PID 2>/dev/null
            sleep 1
            echo -e "${GREEN}✓${NC} 进程已停止"
        else
            echo -e "${YELLOW}取消启动${NC}"
            exit 0
        fi
    fi
fi

# 启动服务
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   正在启动服务...${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 创建logs目录
mkdir -p logs

# 启动Node服务
node src/index.js > logs/stdout.log 2>&1 &
SERVER_PID=$!

# 等待服务启动
sleep 2

# 检查进程是否存活
if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} 服务启动成功!"
    echo -e "${GREEN}✓${NC} 进程ID: $SERVER_PID"
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   服务地址: http://localhost:$PORT${NC}"
    echo -e "${GREEN}   管理界面: http://localhost:$PORT${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "日志文件: logs/stdout.log"
    echo ""

    # 保存PID到文件
    echo $SERVER_PID > .server.pid
else
    echo -e "${RED}错误: 服务启动失败${NC}"
    echo "请查看日志: logs/stdout.log"
    exit 1
fi

# 捕获退出信号
trap "echo '正在停止服务...'; kill $SERVER_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# 保持脚本运行
wait $SERVER_PID
