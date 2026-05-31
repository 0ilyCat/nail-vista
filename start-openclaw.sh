#!/bin/bash
# ─── NailVista OpenClaw Launcher (Linux/macOS) ───
# 使用 OPENCLAW_HOME 指定项目目录，让 OpenClaw 读取项目内的配置
# 队友使用前：编辑 .openclaw/openclaw.json，替换 MIMO_API_KEY 为你的 Key

set -e

# 1. 脚本所在目录 = 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "项目根目录: $SCRIPT_DIR"

# 2. 设置 OPENCLAW_HOME 为项目根目录
export OPENCLAW_HOME="$SCRIPT_DIR"
echo "OPENCLAW_HOME = $OPENCLAW_HOME"

# 3. 确保 .openclaw 目录存在
OPENCLAW_DIR="$SCRIPT_DIR/.openclaw"
if [ ! -d "$OPENCLAW_DIR" ]; then
    mkdir -p "$OPENCLAW_DIR/workspace"
    echo "已创建: $OPENCLAW_DIR"
fi

# 4. 启动 OpenClaw Gateway
openclaw gateway run --port 18789
