#!/bin/bash
# ============================================================
# NailVista OpenClaw Gateway Launcher (Linux / macOS)
# ============================================================
# 以项目根目录为 OPENCLAW_HOME，强制 OpenClaw 读取 .openclaw/ 下的配置。
# 所有配置（含 API Key）均在 .openclaw/openclaw.json 中管理，无需设置额外环境变量。

set -e

PORT="${1:-18789}"

# ── 1. 自动定位项目根目录（脚本所在目录） ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "========================================"
echo "  NailVista OpenClaw Gateway Launcher"
echo "========================================"
echo "项目根目录 : $SCRIPT_DIR"

# ── 2. 设置 OPENCLAW_HOME（强制指向项目根目录） ──
export OPENCLAW_HOME="$SCRIPT_DIR"
echo "OPENCLAW_HOME: $OPENCLAW_HOME"

# ── 3. 确保运行时目录结构存在（不覆盖已有配置） ──
OPENCLAW_DIR="$SCRIPT_DIR/.openclaw"
mkdir -p "$OPENCLAW_DIR/workspace/xiaomei"
mkdir -p "$OPENCLAW_DIR/workspace/ops"
mkdir -p "$OPENCLAW_DIR/logs"
mkdir -p "$OPENCLAW_DIR/plugin-skills"

# ── 4. 启动 OpenClaw Gateway ──
echo ""
echo "正在启动 OpenClaw Gateway (端口 $PORT)..."
echo "配置来源 : $OPENCLAW_DIR/openclaw.json"
echo ""

openclaw gateway run --port "$PORT"
