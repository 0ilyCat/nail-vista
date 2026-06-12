<div align="center">

<img src="https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/MediaPipe-0.10-FF6F00?style=flat-square&logo=google&logoColor=white" />
<img src="https://img.shields.io/badge/AI-MiMo_V2.5-FF69B4?style=flat-square&logo=openai&logoColor=white" />
<img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />

</div>

# 💅 NailVista — 美甲AI虚拟试戴与智能运营

> 让用户「所见即所得」，让运营「实时感知趋势」

智能体开发大赛 · 智能体应用赛道

---

## ✨ 项目简介
<img width="1920" height="968" alt="image" src="https://github.com/user-attachments/assets/450819a7-75dd-4cbf-af5f-feb1b5d9315f" />

NailVista 是一个**美甲AI虚拟试戴 × 智能运营分析**双引擎平台。

- 💅 **AI虚拟试戴**：上传手部照片 → 选择美甲款式 → 秒级查看试戴效果
- 📊 **智能运营看板**：实时热度排行、7日趋势图表、AI自动生成运营日报
- 🤖 **OpenClaw AI助手**：自然语言问答、自动生成运营策略、趋势分析报告

---

## 🎬 演示视频(旧版前端)
https://github.com/user-attachments/assets/5f4a19a7-d686-4eb8-b89b-99793e3dfc71

---

## 🏗️ 系统架构

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│   React 19 + Vite   │────▶│   FastAPI (端口 8190)     │────▶│   SQLite        │
│   端口 4180          │     │                          │     └─────────────────┘
│                     │     │  /api/styles   款式管理    │
│  首页               │     │  /api/tryon    试戴引擎    │     ┌─────────────────┐
│  AI试戴             │     │  /api/analytics 数据分析   │────▶│  OpenClaw       │
│  款式浏览           │     │  /api/operations AI运营    │     │  MiMo V2.5     │
│  运营看板           │     │                          │     └─────────────────┘
└─────────────────────┘     │  MediaPipe + OpenCV       │
                            │  百炼 qwen-image-2.0     │
                            └──────────────────────────┘
```

### AI试戴流程

```
上传手部照片 → MediaPipe 21点手部关键点检测 → 指甲区域定位
                                                  ↓
              款式图（透视变换）              →  OpenCV 叠加 + 边缘羽化
                                                  ↓
              百炼 qwen-image-2.0-pro       →  AI生成结果（自动缓存）
```

---

## 🚀 快速开始

### 环境要求

- Python 3.12+（推荐 conda）
- Node.js 22.16+
- OpenClaw（本地 AI 引擎）：`npm install -g openclaw`

### 第一步：配置 API Key

**1. OpenClaw LLM API Key（必填，用于 AI 对话）**

编辑 `.openclaw/openclaw.json`，替换 `env.MIMO_API_KEY` 为你的 MiMo Token Plan Key：

```json
{
  "env": {
    "MIMO_API_KEY": "YOUR_TOKEN_PLAN_KEY_HERE"
  }
}
```

> 获取 Key：https://token-plan-cn.xiaomimimo.com

**2. 百炼图生模型（可选，用于 AI 试戴图生成）**

编辑 `backend/.env`（从 `.env.example` 复制）：
```env
# 阿里百炼图生模型 API Key（可选）— https://dashscope.console.aliyun.com/
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
```

**3. OpenClaw Gateway Token（无需配置）**

`.openclaw/openclaw.json` 中 `gateway.auth.token` 通过 `${OPENCLAW_GATEWAY_TOKEN}` 引用 `env` 段的 `nailvista-dev-token`，本地开发无需修改。

---

### 第二步：启动服务

#### 1. 后端启动

```bash
# 克隆仓库后，进入后端目录
cd meituan-hackathon/backend

# 从模板复制环境变量文件（仅含 DASHSCOPE_API_KEY）
cp .env.example .env
# 编辑 .env，填入你的 DASHSCOPE_API_KEY（可选）

# 安装依赖
pip install -r requirements.txt

# 导入种子数据（25款美甲 + 运营指标）
python import_data.py

# 启动后端（端口 8190）
uvicorn app.main:app --port 8190 --reload
```

> **关于静态资源**：`backend/static/` 和 `backend/uploads/` 已提交到仓库，包含 25 款美甲样式图、13 张示例手图、2 张用户上传示例。clone 后无需额外下载图片资源。运行 `import_data.py` 后数据库即关联这些图片路径，接口即可正常返回图片 URL（如 `/static/styles/style_01.png`）。

> **AI 试戴结果图**：`backend/results/` 目录存放 AI 生成的试戴效果图，已加入 `.gitignore`。首次试戴某组合时会实时生成（调用百炼/MediaPipe），后续命中缓存直接返回。

#### 2. 前端启动（新终端）

```bash
# 进入前端目录
cd meituan-hackathon/frontend

# 安装依赖
npm install

# 启动前端（端口 4180）
npm run dev
```

#### 3. OpenClaw Gateway 启动（新终端）

**Windows（PowerShell）：**
```powershell
cd meituan-hackathon
.\start-openclaw.ps1
```

**Linux / macOS（Bash）：**
```bash
cd meituan-hackathon
bash start-openclaw.sh
```

**手动启动（任意平台）：**
```bash
# 1. 设置项目目录（让 OpenClaw 读取 .openclaw/ 下的配置）
# Windows PowerShell:
$env:OPENCLAW_HOME = 'C:\path\to\meituan-hackathon'
# Linux / macOS:
export OPENCLAW_HOME=/path/to/meituan-hackathon

# 2. 启动 OpenClaw Gateway（端口 18789）
openclaw gateway run --port 18789
```

---

### 第三步：验证启动成功

```bash
# 后端健康检查
curl http://localhost:8190/api/styles   # 返回款式列表

# 前端页面
# 浏览器访问 http://localhost:4180

# OpenClaw 状态
curl http://localhost:18789/health        # 返回 {"ok":true,"status":"live"}
```

---

### 配置说明（项目内自包含，无隐式依赖）

| 配置项 | 存放位置 | 说明 |
|---------|----------|------|
| OpenClaw 配置（模型、Agent、Gateway、API Key） | `.openclaw/openclaw.json` | 提交到仓库，`env` 段自包含 API Key；直接用文本编辑器修改 |
| OpenClaw Agent 定义（小美/运营助手） | `.openclaw/agents/` | 提交到仓库，含 SOUL.md、SKILL.md 等 |
| OpenClaw 配置模板 | `.openclaw/openclaw.json.example` | 提交到仓库，队友可参考 |
| 百炼 API Key（图像生成） | `backend/.env` | `.env` 不提交，从 `.env.example` 复制后填写 |
| 数据库配置 | `backend/.env` | 可选，默认 SQLite 零配置 |

> OpenClaw 的所有配置（含 API Key）均在 `.openclaw/openclaw.json` 的 `env` 段中自包含管理，通过 `${MIMO_API_KEY}` 内部引用，不依赖操作系统环境变量。仅 DASHSCOPE_API_KEY 需要从 `backend/.env` 读取。

#### OpenClaw 项目目录结构（`.openclaw/`）

```
.openclaw/
├─ agents/                   ← Agent 定义（提交，也是 agent 的 workspace）
│  ├─ xiaomei/               ← 小美：SOUL.md + 4 skills（workspace 指向此处）
│  └─ ops/                   ← 运营助手：SOUL.md + 5 skills（workspace 指向此处）
├─ plugin-skills/            ← 共享插件技能（提交）
├─ openclaw.json             ← 主配置（提交，env 段自包含密钥）
├─ openclaw.json.example     ← 配置模板（提交）
│
├─ workspace/                ← 全局运行时目录（忽略，agent 不再使用）
├─ logs/                     ← 运行时日志（忽略）
├─ identity/                 ← 设备身份（忽略，每人独有）
├─ devices/                  ← 设备配对（忽略）
├─ tasks/                    ← 任务调度数据库（忽略）
├─ plugins/                  ← 插件缓存（忽略）
└─ openclaw.json.last-good   ← 自动备份（忽略）
```

| 类别 | 文件/目录 | 是否提交 |
|------|-----------|----------|
| 提交 | `.openclaw/openclaw.json` | 是 — 主配置，`env` 段自包含 API Key + Gateway Token |
| 提交 | `.openclaw/openclaw.json.example` | 是 — 配置参考模板 |
| 提交 | `.openclaw/agents/*/AGENTS.md` `SOUL.md` `IDENTITY.md` `TOOLS.md` `USER.md` `HEARTBEAT.md` `skills/` | 是 — Agent 定义与技能 |
| 提交 | `.openclaw/plugin-skills/` | 是 — 共享插件技能 |
| 忽略 | `.openclaw/agents/*/state/` | 否 — 运行时模型状态 |
| 忽略 | `.openclaw/agents/*/sessions/` | 否 — Agent 会话记录 |
| 忽略 | `.openclaw/workspace/` | 否 — Agent 运行时工作目录 |
| 忽略 | `.openclaw/logs/` | 否 — 运行时日志 |
| 忽略 | `.openclaw/identity/` | 否 — 设备身份（私密） |
| 忽略 | `.openclaw/devices/` | 否 — 设备配对信息（私密） |
| 忽略 | `.openclaw/tasks/` | 否 — 任务调度数据库 |
| 忽略 | `.openclaw/plugins/` | 否 — 插件安装缓存 |
| 忽略 | `.openclaw/openclaw.json.last-good` | 否 — 运行时自动备份，非源文件 |
| 提交 | `backend/static/` | 是 — 25 款美甲样式图 + 13 张示例手图 + 2 张用户上传示例 |
| 提交 | `backend/uploads/` | 是 — 用户上传图片示例（含上传计数器） |
| 忽略 | `backend/results/` | 否 — AI 生成的试戴结果图，运行时产生 |

#### 如何配置其他语言模型？

编辑 `.openclaw/openclaw.json` 中的 `models.providers`，添加对应模型：
```json
"models": {
  "mode": "merge",
  "providers": {
    "openai": {
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "your-openai-key",
      "models": [{"id": "gpt-4", "name": "GPT-4"}]
    }
  }
}
```

---

### 批量生成AI试戴图（可选）

```bash
cd backend
python batch_generate.py --check     # 查看待生成数量
python batch_generate.py --sample 3  # 测试3张
python batch_generate.py             # 生成全部 325 张
```

### Docker 部署（可选）

```bash
docker compose up -d --build
# 前端：http://localhost:4180
# API文档：http://localhost:8190/docs
```

---

## 📡 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/tryon/hand-images` | 手图列表（上传历史 + 示例） |
| `POST` | `/api/tryon/upload-hand` | 上传手部照片 |
| `POST` | `/api/tryon/try-on` | 执行AI试戴（缓存优先，缺失时实时生成） |
| `GET` | `/api/tryon/history` | 试戴历史记录 |
| `GET` | `/api/styles` | 款式列表（支持分类/搜索/排序/分页） |
| `GET` | `/api/styles/{id}` | 款式详情（含统计数据） |
| `GET` | `/api/styles/hot/ranking` | 热门排行（按热度分） |
| `GET` | `/api/analytics/overview` | 运营总览数据 |
| `GET` | `/api/analytics/trends` | N日趋势数据 |
| `POST` | `/api/operations/chat` | AI助手对话（OpenClaw + MiMo） |
| `POST` | `/api/operations/reports/generate` | 生成日报/趋势/策略报告 |

完整 Swagger 文档：`http://localhost:8190/docs`

---

## 🗂️ 项目结构

```
nail-vista/
├── frontend/                       # React 19 + Vite + TypeScript
│   ├── src/
│   │   ├── pages/                  # 首页/试戴/款式浏览/运营看板
│   │   ├── components/common/      # 主布局
│   │   └── services/api.ts         # Axios API 层
│   ├── public/static/              # 本地图片资源
│   └── vite.config.ts
├── backend/                        # FastAPI + Python 3.12
│   ├── app/
│   │   ├── api/                    # 试戴/款式/分析/运营
│   │   ├── core/                   # 配置/数据库
│   │   ├── models/                 # SQLAlchemy 模型（6张表）
│   │   └── services/               # 试戴引擎/百炼服务/趋势分析
│   ├── batch_generate.py           # 批量AI生图脚本
│   ├── import_data.py              # 数据种子脚本
│   ├── .env.example                # 配置文件模板（仅 DASHSCOPE_API_KEY）
│   └── requirements.txt
├── .openclaw/                     # OpenClaw 项目内配置（自包含，提交到仓库）
│   ├── agents/                    # Agent 定义：xiaomei + ops
│   ├── openclaw.json              # 主配置文件（密钥通过环境变量注入）
│   └── openclaw.json.example      # 配置模板
├── docker-compose.yml              # Docker 一键部署
├── PLAN.md                         # 完整项目规划
└── README.md
```

---

## 📊 数据库

| 表名 | 说明 | 数据量 |
|------|------|--------|
| `nail_styles` | 美甲款式库（25款，8种分类） | 25 |
| `hand_images` | 手部照片 | 13+ |
| `tryon_records` | 试戴记录 | 200+ |
| `style_metrics` | 日级运营指标（25款×30天） | 750 |
| `operations_reports` | AI生成报告 | 按需 |
| `user_feedback` | 用户反馈 | 按需 |

默认使用 **SQLite**（零配置），设置 `USE_POSTGRES=1` 可切换 PostgreSQL。

---

## 🎯 核心功能

### 试戴缓存策略

```
hand_01 + style_05 → results/hand_01+style_05.png
                        ↑
                   ┌────┴────┐
                   │ 是否存在？│
                   └────┬────┘
                   Yes ↓  ↓ No
                直接返回  调用百炼生成 → 保存到 results/
                          └→ 失败 → MediaPipe+OpenCV 合成
```

- 首次试戴某组合：**约5-10秒**（百炼AI生成）
- 再次试戴同一组合：**秒出**（磁盘缓存命中）
- 百炼不可用：**自动降级** 到 MediaPipe + OpenCV 实时合成

### 智能运营

- **热度分算法**：`试戴×0.4 + 收藏×0.25 + 浏览×0.2 + 分享×0.1 + 时长加成`
- **OpenClaw AI**：实时对话、日报生成、趋势分析、策略推荐（支持 MiMo V2.5 及其他模型）

---

## 🔑 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DASHSCOPE_API_KEY` | 阿里百炼图生模型 Key（可选） | 空 |
| `USE_POSTGRES` | 使用 PostgreSQL | `false` |
| `DATABASE_URL` | 自定义数据库连接 | 自动生成 |
| `DEBUG` | 调试模式 | `true` |

> OpenClaw 所有配置（含 API Key）均在 `.openclaw/openclaw.json` 中管理，无需设置操作系统环境变量。

---

## 📝 开发阶段

- [x] Phase 1：环境搭建与项目初始化
- [x] Phase 2：数据层与基础 API
- [x] Phase 3：AI试戴模块（MediaPipe + OpenCV）
- [x] Phase 4：智能运营模块（OpenClaw + MiMo）
- [x] Phase 5：联调展示与文档

---

## 📄 许可证

MIT © 2026

---

<div align="center">
<sub>Built with 💅 by 龙猫队 · Powered by OpenClaw & 百炼 AI</sub>
</div>
