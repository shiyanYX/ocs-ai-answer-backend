#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

check_dependencies() {
    if [ ! -f "package.json" ]; then
        echo -e "${RED}错误: package.json 不存在${NC}"
        exit 1
    fi
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}正在安装依赖...${NC}"
        npm install
    fi
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo -e "${YELLOW}.env 已创建, 请编辑配置${NC}"
    fi
}

start_server() {
    check_dependencies
    echo -e "${GREEN}启动 OCS AI 搜题后端服务...${NC}"
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}警告: 端口 3000 已被占用${NC}"
        read -p "是否停止占用端口的进程? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            lsof -Pi :3000 -sTCP:LISTEN -t | xargs kill -9
            sleep 1
        else
            PORT=3001 npm start &
            sleep 2
            echo -e "${GREEN}服务已启动: http://localhost:3001${NC}"
            return
        fi
    fi
    npm start &
    SERVER_PID=$!
    sleep 2
    if ps -p $SERVER_PID > /dev/null; then
        echo -e "${GREEN}ok${NC} 服务启动成功！"
        echo -e "${BLUE}========================================${NC}"
        echo -e "  Web 管理界面: ${GREEN}http://localhost:3000${NC}"
        echo -e "  API 接口: ${GREEN}http://localhost:3000/api${NC}"
        echo -e "  健康检查: ${GREEN}http://localhost:3000/api/health${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo ""
        echo "按 Ctrl+C 停止服务"
        wait $SERVER_PID
    else
        echo -e "${RED}err: 服务启动失败${NC}"
        exit 1
    fi
}

stop_server() {
    echo -e "${YELLOW}正在停止服务...${NC}"
    pkill -f "node src/index.js" || true
    sleep 1
    if ! pgrep -f "node src/index.js" > /dev/null; then
        echo -e "${GREEN}ok${NC} 服务已停止"
    else
        echo -e "${RED}err: 无法停止服务${NC}"
    fi
}

restart_server() {
    echo -e "${BLUE}重启服务...${NC}"
    stop_server
    sleep 2
    start_server
}

update_server() {
    echo ""
    echo -e "${BLUE}=== 停止进程 → 拉取代码 → 安装依赖 → 启动 ===${NC}"
    echo ""

    echo -e "${YELLOW}[1/4]${NC} 停止服务..."
    pkill -f "node src/index.js" || true
    sleep 1
    if ! pgrep -f "node src/index.js" > /dev/null; then
        echo -e "      ${GREEN}ok${NC} 已停止"
    else
        echo -e "      ${RED}err${NC} 停止失败"
    fi

    echo -e "${YELLOW}[2/4]${NC} 拉取代码..."
    if git rev-parse --git-dir > /dev/null 2>&1; then
        before=$(git rev-parse HEAD 2>/dev/null)
        git pull
        after=$(git rev-parse HEAD 2>/dev/null)
        if [ "$before" != "$after" ]; then
            echo -e "      ${GREEN}ok${NC} 已更新"
        else
            echo -e "      ${GREEN}ok${NC} 已是最新"
        fi
    else
        echo -e "      ${YELLOW}skip${NC} 非 git 仓库"
    fi

    echo -e "${YELLOW}[3/4]${NC} 安装依赖..."
    npm install
    if [ $? -eq 0 ]; then
        echo -e "      ${GREEN}ok${NC} 依赖 OK"
    else
        echo -e "      ${RED}err${NC} 安装失败"
    fi

    echo -e "${YELLOW}[4/4]${NC} 启动服务..."
    check_dependencies
    npm start &
    SERVER_PID=$!
    sleep 2
    if ps -p $SERVER_PID > /dev/null; then
        echo -e "      ${GREEN}ok${NC} 启动成功"
    else
        echo -e "      ${RED}err${NC} 启动失败"
    fi

    echo ""
    echo -e "${GREEN}=== 更新完成 ===${NC}"
}

check_status() {
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}ok${NC} 服务正在运行"
        curl -s http://localhost:3000/api/health | python3 -m json.tool 2>/dev/null || true
    else
        echo -e "${RED}off${NC} 服务未运行"
    fi
}

open_web() {
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    elif command -v open &> /dev/null; then
        open http://localhost:3000
    else
        echo "请手动访问 http://localhost:3000"
    fi
}

view_logs() {
    if [ -f "ocs-ai-backend.log" ]; then
        tail -f ocs-ai-backend.log
    else
        echo "日志文件不存在"
    fi
}

show_help() {
    cat << EOF
OCS AI 搜题后端管理脚本

用法: $0 [命令]

命令:
    start       启动服务
    stop        停止服务
    restart     重启服务
    status      检查状态
    web         打开 Web 管理界面
    logs        查看日志
    update      更新代码 (停止→拉取→安装→启动)
    help        显示帮助

示例:
    $0 start        # 启动服务
    $0 status       # 检查状态
    $0 update       # 更新代码并重启
    $0 web          # 打开管理界面
EOF
}

case "${1:-start}" in
    start) start_server ;;
    stop) stop_server ;;
    restart) restart_server ;;
    status) check_status ;;
    web) check_status; open_web ;;
    logs) view_logs ;;
    update) update_server ;;
    help|--help|-h) show_help ;;
    *) echo -e "${RED}未知命令: $1${NC}"; echo ""; show_help; exit 1 ;;
esac
