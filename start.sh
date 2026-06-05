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

check_deps() {
    if [ ! -d "node_modules" ]; then
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
    echo "   OCS AI Answer Backend - Manager"
    echo "============================================"
    echo -e "${NC}"
}

show_status() {
    echo -e "${CYAN}--------------------------------------------${NC}"
    if is_running; then
        local pid=$(get_pid)
        local port=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2)
        port=${port:-3000}
        echo -e "${GREEN}ok${NC} Status: ${GREEN}Running${NC}"
        echo -e "  PID: ${YELLOW}$pid${NC}"
        echo -e "  URL: ${BLUE}http://localhost:$port${NC}"
    else
        echo -e "${RED}off${NC} Status: ${RED}Not Running${NC}"
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
        echo -e "${YELLOW}already running (PID: $pid)${NC}"
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
            echo -e "${GREEN}ok${NC} started PID:$SERVER_PID port:$port"
        else
            echo -e "${RED}err: start failed, see $LOG_FILE${NC}"
        fi
    else
        node src/index.js
    fi
}

stop_service() {
    if is_running; then
        local pid=$(get_pid)
        echo -e "${YELLOW}stopping PID:$pid...${NC}"
        kill $pid 2>/dev/null
        sleep 1
        if is_running; then
            kill -9 $pid 2>/dev/null
            sleep 1
        fi
        rm -f "$PID_FILE"
        echo -e "${GREEN}ok${NC} stopped"
    else
        echo -e "${YELLOW}not running${NC}"
    fi
}

restart_service() {
    stop_service
    sleep 1
    start_service "background"
}

update_service() {
    echo ""
    echo -e "${BLUE}=== Stop -> Pull -> Install -> Start ===${NC}"
    echo ""

    echo -e "${YELLOW}[1/4]${NC} stopping..."
    if is_running; then
        local pid=$(get_pid)
        kill $pid 2>/dev/null
        sleep 1
        if is_running; then
            kill -9 $pid 2>/dev/null
            sleep 1
        fi
        rm -f "$PID_FILE"
        echo -e "      ${GREEN}ok${NC} stopped"
    else
        echo -e "      ${GREEN}ok${NC} was not running"
    fi

    echo -e "${YELLOW}[2/4]${NC} pulling code..."
    if git rev-parse --git-dir > /dev/null 2>&1; then
        before=$(git rev-parse HEAD 2>/dev/null)
        git pull
        after=$(git rev-parse HEAD 2>/dev/null)
        if [ "$before" != "$after" ]; then
            echo -e "      ${GREEN}ok${NC} updated"
        else
            echo -e "      ${GREEN}ok${NC} already latest"
        fi
    else
        echo -e "      ${YELLOW}skip${NC} not a git repo"
    fi

    echo -e "${YELLOW}[3/4]${NC} installing deps..."
    npm install
    if [ $? -eq 0 ]; then
        echo -e "      ${GREEN}ok${NC} deps OK"
    else
        echo -e "      ${RED}err${NC} npm install failed"
    fi

    echo -e "${YELLOW}[4/4]${NC} starting..."
    start_service "background"

    echo ""
    echo -e "${GREEN}=== Update done ===${NC}"
}

show_log() {
    if [ -f "$LOG_FILE" ]; then
        tail -50 "$LOG_FILE"
    else
        echo -e "${YELLOW}no log file${NC}"
    fi
}

show_menu() {
    echo -e "${CYAN}Actions:${NC}"
    echo ""
    echo -e "  ${GREEN}[1]${NC} Start (background)"
    echo -e "  ${GREEN}[2]${NC} Stop"
    echo -e "  ${GREEN}[3]${NC} Restart"
    echo -e "  ${GREEN}[4]${NC} Status"
    echo -e "  ${GREEN}[5]${NC} Logs (tail 50)"
    echo -e "  ${GREEN}[6]${NC} Start (foreground)"
    echo -e "  ${YELLOW}[7]${NC} Update (pull+install+restart)"
    echo -e "  ${RED}[0]${NC} Exit"
    echo ""
    echo -n "Choose: "
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
            0|q|quit) echo "Bye!"; exit 0 ;;
            *) echo -e "${RED}unknown: $1${NC}" ;;
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
            0|q|quit) echo "Bye!"; exit 0 ;;
            *) echo -e "${RED}invalid${NC}" ;;
        esac
        echo ""
    done
}

main "$@"
