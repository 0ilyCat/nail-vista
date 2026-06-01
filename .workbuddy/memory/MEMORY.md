# NailVista 项目长期记忆

## 项目路径
- 根目录: `D:\projects\myproject\meituan-hackathon`
- 前端: `frontend/` (React + Vite, 端口 4180)
- 后端: `backend/` (FastAPI, 端口 8190)

## 运行环境
- **Conda 环境**: `meituan-hackathon` (`D:\anaconda3\envs\meituan-hackathon`)
- **Python 版本**: 3.12.13
- **Node 版本**: 22.19.0
- **系统**: Windows, Shell: Git Bash
- 启动后端: `D:/anaconda3/envs/meituan-hackathon/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8190 --reload`

## 技术栈
- 前端: React 19 + TypeScript + Vite 6 + Ant Design 5 + react-router-dom v7 + recharts
- 后端: FastAPI + SQLAlchemy (async) + SQLite + httpx
- AI: OpenClaw Gateway (MiMo Token Plan, xiaomi-coding provider)

## 数据库
- SQLite: `backend/nail_tryon.db`
- 初始化: `backend/app/core/database.py`

## 项目约定
- 分支: `feat/ui-overhaul` (当前活跃)
- 端口 4180 (前端), 8190 (后端), 18789 (OpenClaw)
- 中文交流, 先方案不实施, 表格式呈现
- 非标准端口避冲突, AI主动检查环境状态

## OpenClaw（项目内自包含配置）
- 配置根目录: `.openclaw/`（提交到仓库，不依赖用户目录或 OS 环境变量）
- 主配置: `.openclaw/openclaw.json`（`env` 段自包含 MIMO_API_KEY + Gateway Token，通过 `${VAR}` 内部引用）
- 配置模板: `.openclaw/openclaw.json.example`
- Agent 定义: `.openclaw/agents/xiaomei/`（小美，4 skills）、`.openclaw/agents/ops/`（运营助手，5 skills）
- 启动: `.\start-openclaw.ps1` 或 `bash start-openclaw.sh`（仅设 OPENCLAW_HOME + 创建目录 + 启动，无需额外环境变量）
- Agent: nailvista-xiaomei（小美）, nailvista-ops（运营助手）
- 模型: xiaomi-coding/mimo-v2.5-pro（主力）、xiaomi-coding/mimo-v2.5（视觉）；mimo-v2-omni 已弃用
- Gateway token: `nailvista-dev-token`（env 段自包含）
- 运行时目录（全部 gitignore）: workspace/、logs/、identity/、devices/、tasks/、plugins/、agents/*/state/
- 配置目录（提交）: agents/、plugin-skills/、openclaw.json、openclaw.json.example
- 仅 DASHSCOPE_API_KEY 需在 backend/.env 中设置

## 前端开发
- 安装依赖: `cd frontend && npm install`
- 启动: `cd frontend && npx vite --port 4180`
- TypeScript: `npx tsc --noEmit`
