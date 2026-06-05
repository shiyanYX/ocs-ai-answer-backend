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
        echo -e "${GREEN}✓${NC} 快捷命令 ${CYAN}ocs${NC} 已创建"
    fi
}

check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ 错误: 未找到Node.js，请先安装${NC}"
        echo "访问 https://nodejs.org/ 下载安装"
        exit 1
    fi
}

check_env() {
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}提示: .env文件不存在，正在创建...${NC}"
        cp .env.example .env 2>/dev/null || {
            echo "PORT=3000" > .env
            echo "HOST=0.0.0.0" > .env
        }
        echo -e "${GREEN}✓${NC} .env文件已创建"
    fi
}

check_deps() {
    if [ ! -d "node_modules" ]; then
        echo ""
        echo -e "${YELLOW}正在安装依赖...${NC}"
        npm install
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗ 错误: 依赖安装失败${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓${NC} 依赖安装完成"
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
    echo "╔════════════════════════════════════════════╗"
    echo "║     OCS AI搜题后端 - 服务管理脚本          ║"
    echo "╚════════════════════════════════════════════╝"
    echo -e "${NC}"
}

show_status() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    if is_running; then
        local pid=$(get_pid)
        local port=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2)
        port=${port:-3000}
        echo -e "${GREEN}✓${NC} 服务状态: ${GREEN}运行中${NC}"
        echo -e "  PID: ${YELLOW}$pid${NC}"
        echo -e "  地址: ${BLUE}http://localhost:$port${NC}"
    else
        echo -e "${RED}✗${NC} 服务状态: ${RED}未运行${NC}"
    fi
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

start_service() {
    local mode=$1
    local port=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2)
    port=${port:-3000}

    if is_running; then
        local pid=$(get_pid)
        echo -e "${YELLOW}⚠ 服务已在运行 (PID: $pid)${NC}"
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
            echo -e "${GREEN}✓${NC} 服务启动成功!"
            echo -e "  ${GREEN}PID${NC}: $SERVER_PID"
            echo -e "  ${GREEN}地址${NC}: http://localhost:$port"
            echo ""
            echo "后台运行中"
            echo "使用选项 [2] 停止服务"
        else
            echo -e "${RED}✗ 服务启动失败${NC}"
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
        echo -e "${GREEN}✓${NC} 服务已停止"
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
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  停止进程 → 拉取代码 → 安装依赖 → 启动${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # 1. 停止服务
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
        echo -e "      ${GREEN}✓${NC} 服务已停止"
    else
        echo -e "      ${GREEN}✓${NC} 服务未在运行"
    fi

    # 2. 拉取最新代码
    echo -e "${YELLOW}[2/4]${NC} 拉取最新代码..."
    if git rev-parse --git-dir > /dev/null 2>&1; then
        local before=$(git rev-parse HEAD 2>/dev/null)
        git pull 2>&1 | while IFS= read -r line; do echo "      $line"; done
        local after=$(git rev-parse HEAD 2>/dev/null)
        if [ "$before" != "$after" ]; then
            echo -e "      ${GREEN}✓${NC} 代码已更新"
        else
            echo -e "      ${GREEN}✓${NC} 已是最新版本"
        fi
    else
        echo -e "      ${YELLOW}⚠${NC} 非 git 仓库，跳过拉取"
    fi

    # 3. 安装依赖
    echo -e "${YELLOW}[3/4]${NC} 检查并安装依赖..."
    npm install
    if [ $? -eq 0 ]; then
        echo -e "      ${GREEN}✓${NC} 依赖安装完成"
    else
        echo -e "      ${RED}✗${NC} 依赖安装失败"
    fi

    # 4. 启动服务
    echo -e "${YELLOW}[4/4]${NC} 启动服务..."
    check_node
    start_service "background"

    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  更新流程完成${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

show_log() {
    if [ -f "$LOG_FILE" ]; then
        echo -e "${CYAN}�