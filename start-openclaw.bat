@echo off
REM ─── NailVista OpenClaw Gateway 启动脚本 ───
REM 使用项目级配置 openclaw/openclaw.json
REM 启动前请确保已在 openclaw/openclaw.json 中填入 MiMo API Key

set OPENCLAW_CONFIG_PATH=openclaw\openclaw.json
set MIMO_API_KEY=your-token-plan-key

echo ============================================
echo   NailVista OpenClaw Gateway
echo   Config: %OPENCLAW_CONFIG_PATH%
echo   Port:   18789
echo   先修改 openclaw\openclaw.json 中的 apiKey!
echo ============================================

openclaw gateway run --port 18789 --force --verbose
