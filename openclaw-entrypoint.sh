#!/bin/sh
# ============================================================
# OpenClaw Gateway 容器入口脚本
# 1. 从模板生成 openclaw.json（替换 API Key 占位符）
# 2. 确保运行时目录存在
# 3. 启动 Gateway（端口 18789，bind any）
# ============================================================
set -e

echo "========================================="
echo "  OpenClaw Gateway 容器启动"
echo "========================================="

# 生成 openclaw.json
if [ -f "/openclaw.json.template" ]; then
    echo "[步骤 1/3] 从模板生成 openclaw.json..."
    cp /openclaw.json.template .openclaw/openclaw.json

    # 替换 API Key 占位符
    if [ -n "$MIMO_API_KEY" ]; then
        echo "  替换 MIMO_API_KEY..."
        sed -i "s|MIMO_API_KEY_PLACEHOLDER|${MIMO_API_KEY}|g" .openclaw/openclaw.json
    else
        echo "  ⚠ MIMO_API_KEY 未设置，AI 对话功能将不可用"
    fi

    # 替换 Gateway Token
    if [ -n "$OPENCLAW_GATEWAY_TOKEN" ]; then
        echo "  替换 OPENCLAW_GATEWAY_TOKEN..."
        sed -i "s|nailvista-dev-token|${OPENCLAW_GATEWAY_TOKEN}|g" .openclaw/openclaw.json
    fi
else
    echo "⚠ openclaw.json.template 不存在，使用已有配置"
fi

# 确保运行时目录
echo "[步骤 2/3] 创建运行时目录..."
mkdir -p .openclaw/logs
mkdir -p .openclaw/plugin-skills
mkdir -p .openclaw/workspace
mkdir -p .openclaw/memory
mkdir -p .openclaw/tasks
for agent_dir in .openclaw/agents/*/state; do
    mkdir -p "$agent_dir"
done

# 启动 Gateway
echo "[步骤 3/3] 启动 OpenClaw Gateway (端口 18789)..."
export OPENCLAW_HOME=/app
export HOME=/app
exec openclaw gateway run --port 18789
