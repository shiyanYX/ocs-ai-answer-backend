#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
PID_FILE="$SCRIPT_DIR/.server.pid"
LOG_FILE="$SCRIPT_DIR/logs/stdout.log"

create_shortcut() {
    if [ ! -L "$SCRIPT_DIR/ocs" ]; then
        ln -sf start.sh "$SCRIPT_DIR/ocs"
        echo -e "${GREEN}ok${NC} shortcut ${CYAN}ocs${NC} created"
    fi
}

check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}err: node not found${NC}"
        exit 1
    fi
}

check_env() {
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}.env not found, creating...${NC}"
        cp .env.example .env 2>/dev/null || {
            echo "PORT=3000" > .env
            echo "HOST=0.0.0.0" > .env
        }
        echo -e "${GREEN}ok${NC} .env created"
    fi
}

check_deps() {
    if [ ! -d "node_modules" ]; then
        echo ""
        echo -e "${YELLOW}installing deps...${NC}"
        npm install
        if [ $? -ne 0 ]; then
            echo -e "${RED}err: npm install failed${NC}"
            exit 1
        fi
        echo -e "${GREEN}ok${NC} deps installed"
    fi
}

get_pid() {
    [ -f "$PID_FILE" ] && cat "$PID_FILE"
}

is_running() {
    local pid=$(get_pid)
    [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1
}

show_banner() {
    echo -e "${GREEN}"
    echo "============================================"
    echo "   OCS AI搜题后端 - 服务管理脚本"
    echo "============================================"
    echo -e "${NC}"
}

show_status() {
    echo -e "${CYAN}--------------------------------------------${NC}"
    if is_running; then
        local pid=$(get_pid)
        local port=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2)
        port=${port:-3000}
        echo -e "${GREEN}ok${NC} 服务状态: ${GREEN}运行中${NC}"
        echo -e "  PID: ${YELLOW}$pid${NC}"
        echo -e "  地址: ${BLUE}http://localhost:$port${NC}"
    else
        echo -e "${RED}off${NC} 服务状态: ${RED}未运行${NC}"
    fi
    echo -e "${CYAN}--------------------------------------------${NC}"
    echo ""
}

start_service() {
    local mode=$1
    local port=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2)
    port=${port:-3000}

    if is_running; then
        local pid=$(get_pid)
        echo -e "${YELLOW}服务已在运行 (PID: $pid)${NC}"
        echo "使用选项 [2] 停止后再启动"
        return
    fi

    check_node
    check_deps

    mkdir -p logs

    if [ "$mode" = "background" ]; then
        nohup node src/index.js > "$LOG_FILE" 2>&1 &
        SERVER_PID=$!
        echo $SERVER_PID > "$PID_FILE"
        sleep 2

        if is_running; then
            echo ""
            echo -e "${GREEN}ok${NC} 服务启动成功!"
            echo -e "  ${GREEN}PID${NC}: $SERVER_PID"
            echo -e "  ${GREEN}地址${NC}: http://localhost:$port"
            echo ""
            echo "后台运行中"
            echo "使用选项 [2] 停止服务"
        else
            echo -e "${RED}err: 服务启动失败${NC}"
            echo "查看日志: $LOG_FILE"
        fi
    else
        echo ""
        echo -e "${GREEN}正在启动服务...${NC}"
        node src/index.js
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
        echo -e "${GREEN}ok${NC} 服务已停止"
    else
        echo -e "${YELLOW}服务未运行${NC}"
    fi
}

restart_service() {
    echo -e "${BLUE}重启服务...${NC}"
    stop_service
    sleep 1
    start_service "background"
}

update_service() {
    echo ""
    echo -e "${BLUE}=== 停止进程 → 拉取代码 → 安装依赖 → 启动 ===${NC}"
    echo ""

    echo -e "${YELLOW}[1/4]${NC} 停止服务..."
    if is_running; then
        local pid=$(get_pid)
        kill $pid 2>/dev/null
        sleep 1
        if is_running; then
            kill -9 $pid 2>/dev/null
            sleep 1
        fi
        rm -f "$PID_FILE"
        echo -e "      ${GREEN}ok${NC} 服务已停止"
    else
        echo -e "      ${GREEN}ok${NC} 服务未在运行"
    fi

    echo -e "${YELLOW}[2/4]${NC} 拉取最新代码..."
    if git rev-parse --git-dir > /dev/null 2>&1; then
        before=$(git rev-parse HEAD 2>/dev/null)
        git pull
        after=$(git rev-parse HEAD 2>/dev/null)
        if [ "$before" != "$after" ]; then
            echo -e "      ${GREEN}ok${NC} 代码已更新"
        else
            echo -e "      ${GREEN}ok${NC} 已是最新版本"
        fi
    else
        echo -e "      ${YELLOW}skip${NC} 非 git 仓库，跳过拉取"
    fi

    echo -e "${YELLOW}[3/4]${NC} 检查并安装依赖..."
    npm install
    if [ $? -eq 0 ]; then
        echo -e "      ${GREEN}ok${NC} 依赖安装完成"
    else
        echo -e "      ${RED}err${NC} 依赖安装失败"
    fi

    echo -e "${YELLOW}[4/4]${NC} 启动服务..."
    check_node
    start_service "background"

    echo ""
    echo -e "${GREEN}=== 更新流程完成 ===${NC}"
}

show_log() {
    if [ -f "$LOG_FILE" ]; then
        echo -e "${CYAN}--- 最近50行日志 ---${NC}"
        tail -50 "$LOG_FILE"
    else
        echo -e "${YELLOW}日志文件不存在${NC}"
    fi
}

show_menu() {
    echo -e "${CYAN}请选择操作:${NC}"
    echo ""
    echo -e "  ${GREEN}[1]${NC} 启动服务 (后台运行)"
    echo -e "  ${GREEN}[2]${NC} 停止服务"
    echo -e "  ${GREEN}[3]${NC} 重启服务"
    echo -e "  ${GREEN}[4]${NC} 查看状态"
    echo -e "  ${GREEN}[5]${NC} 查看日志"
    echo -e "  ${GREEN}[6]${NC} 前台运行 (调试模式)"
    echo -e "  ${YELLOW}[7]${NC} 更新代码 (停止→拉取→安装→启动)"
    echo -e "  ${RED}[0]${NC} 退出"
    echo ""
    echo -n "请输入选项: "
}

main() {
    create_shortcut
    show_banner
    show_status

    if [ -n "$1" ]; then
        case "$1" in
            1|d|daemon) start_service "background" ;;
            2|s|stop) stop_service ;;
            3|r|restart) restart_service ;;
            4|st|status) show_status ;;
            5|l|log) show_log ;;
            6|f|foreground) start_service "foreground" ;;
            7|u|update) update_service ;;
            0|q|quit) echo "再见!"; exit 0 ;;
            *) echo -e "${RED}未知选项: $1${NC}" ;;
        esac
        return
    fi

    while true; do
        show_menu
        read choice
        case "$choice" in
            1|d|daemon|"") start_service "background" ;;
            2|s|stop) stop_service ;;
            3|r|restart) restart_service ;;
            4|st|status) show_status ;;
            5|l|log) show_log ;;
            6|f|foreground) start_service "foreground" ;;
            7|u|update) update_service ;;
            0|q|quit) echo "再见!"; exit 0 ;;
            *) echo -e "${RED}无效选项，请重试${NC}" ;;
        esac
        echo ""
    done
}

main "$@"
