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
        echo -e "${RED}err: package.json not found${NC}"
        exit 1
    fi
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}installing deps...${NC}"
        npm install
    fi
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo -e "${YELLOW}created .env, please edit it${NC}"
    fi
}

start_server() {
    check_dependencies
    echo -e "${GREEN}starting...${NC}"
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}port 3000 in use${NC}"
        read -p "kill existing process? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            lsof -Pi :3000 -sTCP:LISTEN -t | xargs kill -9
            sleep 1
        else
            PORT=3001 npm start &
            sleep 2
            echo -e "${GREEN}started on port 3001${NC}"
            return
        fi
    fi
    npm start &
    SERVER_PID=$!
    sleep 2
    if ps -p $SERVER_PID > /dev/null; then
        echo -e "${GREEN}ok${NC} http://localhost:3000"
        wait $SERVER_PID
    else
        echo -e "${RED}err: start failed${NC}"
        exit 1
    fi
}

stop_server() {
    pkill -f "node src/index.js" || true
    sleep 1
    if ! pgrep -f "node src/index.js" > /dev/null; then
        echo -e "${GREEN}ok${NC} stopped"
    else
        echo -e "${RED}err: cannot stop${NC}"
    fi
}

restart_server() {
    stop_server
    sleep 2
    start_server
}

update_server() {
    echo ""
    echo -e "${BLUE}=== Stop -> Pull -> Install -> Start ===${NC}"
    echo ""

    echo -e "${YELLOW}[1/4]${NC} stopping..."
    pkill -f "node src/index.js" || true
    sleep 1
    if ! pgrep -f "node src/index.js" > /dev/null; then
        echo -e "      ${GREEN}ok${NC} stopped"
    else
        echo -e "      ${RED}err${NC} stop failed"
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
    check_dependencies
    npm start &
    SERVER_PID=$!
    sleep 2
    if ps -p $SERVER_PID > /dev/null; then
        echo -e "      ${GREEN}ok${NC} started"
    else
        echo -e "      ${RED}err${NC} start failed"
    fi

    echo ""
    echo -e "${GREEN}=== Update done ===${NC}"
}

check_status() {
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}ok${NC} running"
        curl -s http://localhost:3000/api/health | python3 -m json.tool 2>/dev/null || true
    else
        echo -e "${RED}off${NC} not running"
    fi
}

open_web() {
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    elif command -v open &> /dev/null; then
        open http://localhost:3000
    else
        echo "open http://localhost:3000"
    fi
}

view_logs() {
    if [ -f "ocs-ai-backend.log" ]; then
        tail -f ocs-ai-backend.log
    else
        echo "no log file"
    fi
}

show_help() {
    cat << EOF
OCS AI Answer Backend - Manager

Usage: $0 [command]

Commands:
    start       Start service
    stop        Stop service
    restart     Restart service
    status      Check status
    web         Open web UI
    logs        View logs
    config      Generate OCS config
    update      Update (pull+install+restart)
    help        This help

Examples:
    $0 start
    $0 update
    $0 status
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
    *) echo -e "${RED}unknown: $1${NC}"; show_help; exit 1 ;;
esac
