#!/bin/bash

# OCS AI 搜题后端管理脚本
# ================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目目录
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 检查依赖
check_dependencies() {
    echo -e "${BLUE}检查依赖...${NC}"
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}错误: package.json 文件不存在${NC}"
        exit 1
    fi
    
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}正在安装依赖...${NC}"
        npm install
    fi
    
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}警告: .env 文件不存在，正在创建...${NC}"
        cp .env.example .env
        echo -e "${YELLOW}请编辑 .env 文件配置您的 API Key${NC}"
    fi
}

# 启动服务
start_server() {
    check_dependencies
    
    echo -e "${GREEN}启动 OCS AI 搜题后端服务...${NC}"
    
    # 检查端口是否被占用
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}警告: 端口 3000 已被占用${NC}"
        read -p "是否要停止占用端口的进程? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            lsof -Pi :3000 -sTCP:LISTEN -t | xargs kill -9
            sleep 1
        else
            echo -e "${YELLOW}使用端口 3001 启动...${NC}"
            PORT=3001 npm start &
            sleep 2
            echo -e "${GREEN}服务已启动: http://localhost:3001${NC}"
            return
        fi
    fi
    
    # 启动服务
    npm start &
    SERVER_PID=$!
    
    sleep 2
    
    if ps -p $SERVER_PID > /dev/null; then
        echo -e "${GREEN}✓ 服务启动成功！${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo -e "🌐 Web 配置界面: ${GREEN}http://localhost:3000${NC}"
        echo -e "📡 API 接口地址: ${GREEN}http://localhost:3000/api${NC}"
        echo -e "❤️  健康检查: ${GREEN}http://localhost:3000/api/health${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo -e ""
        echo -e "按 Ctrl+C 停止服务"
        
        # 保持脚本运行
        wait $SERVER_PID
    else
        echo -e "${RED}✗ 服务启动失败${NC}"
        exit 1
    fi
}

# 停止服务
stop_server() {
    echo -e "${YELLOW}正在停止服务...${NC}"
    
    # 查找并停止进程
    pkill -f "node src/index.js" || true
    
    sleep 1
    
    if ! pgrep -f "node src/index.js" > /dev/null; then
        echo -e "${GREEN}✓ 服务已停止${NC}"
    else
        echo -e "${RED}✗ 无法停止服务，请手动处理${NC}"
    fi
}

# 重启服务
restart_server() {
    echo -e "${BLUE}重启服务...${NC}"
    stop_server
    sleep 2
    start_server
}

# 检查状态
check_status() {
    echo -e "${BLUE}检查服务状态...${NC}"
    
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 服务正在运行${NC}"
        curl -s http://localhost:3000/api/health | python3 -m json.tool 2>/dev/null || echo "无法解析 JSON"
    else
        echo -e "${RED}✗ 服务未运行${NC}"
        echo -e "${YELLOW}运行 '$0 start' 启动服务${NC}"
    fi
}

# 打开 Web 界面
open_web() {
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000
    elif command -v open &> /dev/null; then
        open http://localhost:3000
    else
        echo -e "${YELLOW}请手动打开浏览器访问: http://localhost:3000${NC}"
    fi
}

# 查看日志
view_logs() {
    if [ -f "ocs-ai-backend.log" ]; then
        tail -f ocs-ai-backend.log
    else
        echo -e "${YELLOW}日志文件不存在${NC}"
    fi
}

# 生成 OCS 配置
generate_ocs_config() {
    echo -e "${BLUE}生成 OCS 配置...${NC}"
    
    cat > ocs-config-example.js << 'EOF'
// OCS AI 搜题配置
// ================================

// 基础配置（GET 请求）
const aiSearchConfig = {
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
};

// POST 请求配置
const aiSearchConfigPost = {
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
};

// 导出配置
module.exports = {
  aiSearchConfig,
  aiSearchConfigPost
};
EOF

    echo -e "${GREEN}✓ OCS 配置已生成: ocs-config-example.js${NC}"
    echo -e "${YELLOW}查看配置: cat ocs-config-example.js${NC}"
}

# 显示帮助
show_help() {
    cat << EOF
OCS AI 搜题后端管理脚本
============================

用法: $0 [命令]

命令:
    start       启动服务
    stop        停止服务
    restart     重启服务
    status      检查服务状态
    web         打开 Web 配置界面
    logs        查看日志
    config      生成 OCS 配置代码
    help        显示帮助信息

示例:
    $0 start        # 启动服务
    $0 status       # 检查状态
    $0 web          # 打开 Web 界面

详细文档:
    README.md        # 完整使用说明
    OCS-CONFIG.md   # OCS 配置教程

EOF
}

# 主程序
case "${1:-start}" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        check_status
        ;;
    web)
        check_status
        if [ $? -eq 0 ]; then
            open_web
        fi
        ;;
    logs)
        view_logs
        ;;
    config)
        generate_ocs_config
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}错误: 未知命令 '$1'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
