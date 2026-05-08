#!/bin/bash

# OCS AI搜题后端 - 启动脚本
# 支持前台启动、后台启动、停止、重启等功能

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
PID_FILE="$SCRIPT_DIR/.server.pid"
LOG_FILE="$SCRIPT_DIR/logs/stdout.log"

show_help() {
    echo -e "${GREEN}OCS AI搜题后端 - 启动脚本${NC}"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  (无参数)     前台启动服务"
    echo "  daemon, d    后台启动服务"
    echo "  stop, s      停止服务"
    echo "  restart, r   重启服务"
    echo "  status, st   查看服务状态"
    echo "  log, l       查看服务日志"
    echo "  help, h      显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0            # 前台启动"
    echo "  $0 d          # 后台启动"
    echo "  $0 stop       # 停止服务"
    echo "  $0 restart    # 重启服务"
}

check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}错误: 未找到Node.js，请先安装${NC}"
        echo "访问 https://nodejs.org/ 下载安装"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Node.js: $(node -v)"
    echo -e "${GREEN}✓${NC} npm: $(npm -v)"
}

check_env() {
    if [ ! -f ".env" ]; then
        echo ""
        echo -e "${YELLOW}提示: .env文件不存在，正在创建...${NC}"
        cp .env.example .env 2>/dev/null || echo -e "${GREEN}✓${NC} 已创建.env文件"
    fi
}

check_deps() {
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
}

get_pid() {
    if [ -f "$PID_FILE" ]; then
        cat "$PID_FILE"
    else
        echo ""
    fi
}

is_running() {
    local pid=$(get_pid)
    if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

start_foreground() {
    check_node
    check_env
    check_deps

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   前台模式启动 - 按 Ctrl+C 停止${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    mkdir -p logs
    node src/index.js
}

start_daemon() {
    check_node
    check_env
    check_deps

    if is_running; then
        local pid=$(get_pid)
        echo -e "${YELLOW}服务已在运行 (PID: $pid)${NC}"
        echo "使用 '$0 stop' 停止服务"
        exit 0
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   后台启动服务...${NC}"
    echo -e "${GREEN}========================================${NC}"

    mkdir -p logs
    nohup node src/index.js > "$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > "$PID_FILE"

    sleep 2

    if is_running; then
        PORT=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2)
        PORT=${PORT:-3000}
        echo -e "${GREEN}✓${NC} 服务启动成功!"
        echo -e "${GREEN}✓${NC} 进程ID: $SERVER_PID"
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}   服务地址: http://localhost:$PORT${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo "后台运行，日志: $LOG_FILE"
        echo "使用 '$0 stop' 停止服务"
        echo "使用 '$0 log' 查看日志"
    else
        echo -e "${RED}错误: 服务启动失败${NC}"
        echo "请查看日志: $LOG_FILE"
        exit 1
    fi
}

stop_service() {
    if is_running; then
        local pid=$(get_pid)
        echo -e "${YELLOW}正在停止服务 (PID: $pid)...${NC}"
        kill $pid 2>/dev/null
        sleep 1

        if is_running; then
            echo -e "${YELLOW}强制停止...${NC}"
            kill -9 $pid 2>/dev/null
            sleep 1
        fi

        rm -f "$PID_FILE"
        echo -e "${GREEN}✓${NC} 服务已停止"
    else
        echo -e "${YELLOW}服务未运行${NC}"
    fi
}

restart_service() {
    echo -e "${BLUE}重启服务...${NC}"
    stop_service
    sleep 1
    start_daemon
}

show_status() {
    if is_running; then
        local pid=$(get_pid)
        PORT=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2)
        PORT=${PORT:-3000}
        echo -e "${GREEN}✓${NC} 服务运行中 (PID: $pid)"
        echo -e "${GREEN}   地址: http://localhost:$PORT${NC}"
    else
        echo -e "${RED}✗${NC} 服务未运行"
        echo "使用 '$0 d' 启动服务"
    fi
}

show_log() {
    if [ -f "$LOG_FILE" ]; then
        tail -50 "$LOG_FILE"
    else
        echo -e "${YELLOW}日志文件不存在${NC}"
    fi
}

case "${1:-}" in
    daemon|d)
        start_daemon
        ;;
    stop|s)
        stop_service
        ;;
    restart|r)
        restart_service
        ;;
    status|st)
        show_status
        ;;
    log|l)
        show_log
        ;;
    help|h|"")
        if [ -z "$1" ]; then
            start_foreground
        else
            show_help
        fi
        ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        show_help
        exit 1
        ;;
esac
