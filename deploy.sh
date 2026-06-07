#!/bin/bash
# ============================================================
# NailVista 一键部署脚本 (Ubuntu 24 / Tencent Cloud)
# ============================================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  NailVista 一键部署脚本${NC}"
echo -e "${GREEN}  目标: Ubuntu 24 / Tencent Cloud${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

# ── 1. 检查 Docker ──
echo -e "${YELLOW}[1/5] 检查 Docker 环境...${NC}"
if ! command -v docker &>/dev/null; then
    echo "Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com | sudo bash
    sudo systemctl enable docker --now
    echo -e "${GREEN}Docker 安装完成${NC}"
else
    echo -e "${GREEN}Docker 已安装: $(docker --version)${NC}"
fi

# ── 2. 检查 Docker Compose ──
echo -e "${YELLOW}[2/5] 检查 Docker Compose...${NC}"
if ! docker compose version &>/dev/null; then
    echo "Docker Compose Plugin 未安装，正在安装..."
    sudo apt update && sudo apt install -y docker-compose-plugin
    echo -e "${GREEN}Docker Compose 安装完成${NC}"
else
    echo -e "${GREEN}Docker Compose 已安装: $(docker compose version)${NC}"
fi

# ── 3. 配置环境变量 ──
echo -e "${YELLOW}[3/5] 配置环境变量...${NC}"
if [ ! -f .env ]; then
    cp .env.deploy .env
    echo -e "${GREEN}已创建 .env 文件（从 .env.deploy 模板）${NC}"
    echo -e "${RED}>>> 请编辑 .env 文件，修改以下必填项：${NC}"
    echo -e "${RED}    - DASHSCOPE_API_KEY（AI试戴必填）${NC}"
    echo -e "${RED}    - MIMO_API_KEY（AI对话必填）${NC}"
    echo -e "${RED}    - JWT_SECRET_KEY（改为随机字符串）${NC}"
    echo -e "${RED}    - DB_PASSWORD（数据库密码）${NC}"
    echo -e "${RED}    - CORS_ORIGINS（替换 YOUR_SERVER_IP 为服务器公网IP）${NC}"
    echo ""
    read -p "已编辑好 .env 文件？按 Enter 继续..."
else
    echo -e "${GREEN}.env 文件已存在${NC}"
fi

# 加载 .env
set -a
source .env 2>/dev/null || true
set +a

# ── 4. 构建并启动 ──
echo -e "${YELLOW}[4/5] 构建镜像并启动服务...${NC}"
docker compose up -d --build

echo ""
echo -e "${YELLOW}等待服务就绪...${NC}"
sleep 5

# ── 5. 验证部署 ──
echo -e "${YELLOW}[5/5] 验证部署...${NC}"
echo ""

# 检查容器状态
echo "容器状态:"
docker compose ps
echo ""

# 检查后端健康
echo "后端健康检查:"
if curl -sf http://localhost:8190/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}  后端: OK${NC}"
    curl -s http://localhost:8190/api/health | python3 -m json.tool 2>/dev/null || true
else
    echo -e "${RED}  后端: 未就绪，查看日志: docker compose logs backend${NC}"
fi
echo ""

# 检查 OpenClaw
echo "OpenClaw Gateway 检查:"
if curl -sf http://localhost:18789/ >/dev/null 2>&1; then
    echo -e "${GREEN}  OpenClaw: OK${NC}"
else
    echo -e "${YELLOW}  OpenClaw: 未就绪（启动较慢，稍后可用）${NC}"
fi
echo ""

# 检查前端
echo "前端检查:"
if curl -sf http://localhost:80/ >/dev/null 2>&1; then
    echo -e "${GREEN}  前端: OK${NC}"
else
    echo -e "${RED}  前端: 未就绪，查看日志: docker compose logs frontend${NC}"
fi
echo ""

# ── 完成 ──
SERVER_IP=$(curl -sf ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "访问地址:"
echo -e "  前端页面:  ${GREEN}http://${SERVER_IP}${NC}"
echo -e "  后端 API:  ${GREEN}http://${SERVER_IP}:8190/api/health${NC}"
echo -e "  Swagger:   ${GREEN}http://${SERVER_IP}:8190/docs${NC}"
echo ""
echo -e "测试账号:  xiaomei / 123456（用户）"
echo -e "           merchant01 / 123456（商家）"
echo ""
echo -e "常用命令:"
echo -e "  查看日志:  ${YELLOW}docker compose logs -f${NC}"
echo -e "  重启服务:  ${YELLOW}docker compose restart${NC}"
echo -e "  停止服务:  ${YELLOW}docker compose down${NC}"
echo -e "  重新构建:  ${YELLOW}docker compose up -d --build${NC}"
echo ""
echo -e "${RED}重要提醒:${NC}"
echo -e "  1. 确保腾讯云安全组已开放 80、8190 端口"
echo -e "  2. AI试戴功能需要有效的 DASHSCOPE_API_KEY"
echo -e "  3. AI对话功能需要有效的 MIMO_API_KEY"
echo -e "  4. OpenClaw Gateway 首次启动需下载 npm 包，约1-2分钟"
echo ""
