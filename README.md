# 💅 美甲AI试戴与智能运营

美团黑马大赛 — 命题三：美甲评测数据

**双引擎系统**：AI 虚拟试戴 + MiMo 大模型智能运营分析

---

## ✨ 功能概览

| 模块 | 功能 | 技术 |
|------|------|------|
| 🏠 **首页** | 系统概览、热门TOP5、快捷入口 | React 19 |
| 💅 **AI试戴** | 上传手图 → 选款式 → 秒级生成试戴效果 | MediaPipe + OpenCV |
| 🎨 **款式浏览** | 25款美甲，分类筛选/搜索/排序 | FastAPI + SQLite |
| 📊 **运营看板** | 热度排行/7日趋势/AI对话/日报生成 | MiMo V2.5 + Recharts |

### AI试戴流程

```
用户上传手部照片
    ↓
MediaPipe 21点手部关键点检测
    ↓
指甲区域定位 (5指独立估算)
    ↓
款式图透视变换 + 椭圆遮罩 + 边缘羽化
    ↓
OpenCV 颜色叠加 + 光影效果
    ↓
返回合成图 (200-800ms)
```

---

## 🚀 快速开始

### 环境要求

- Python 3.12+ (Conda)
- Node.js 22.16+
- (可选) Docker + Docker Compose

### 本地开发

```bash
# 1. 克隆项目
cd meituan-hackathon

# 2. 创建 Python 环境
conda create -n meituan-hackathon python=3.12 -y
conda activate meituan-hackathon

# 3. 安装后端依赖
cd backend
pip install -r requirements.txt

# 4. 导入种子数据
python import_data.py

# 5. 启动后端 (端口 8190)
uvicorn app.main:app --host 0.0.0.0 --port 8190 --reload

# 6. 安装前端依赖 & 启动 (端口 4180)
cd ../frontend
npm install
npm run dev
```

打开浏览器访问 **http://localhost:4180**

### Docker 一键部署

```bash
# 设置 MiMo API Key
export MIMO_API_KEY=your_key_here

# 启动全部服务
docker compose up -d --build

# 导入数据 (PostgreSQL)
docker compose exec backend python import_data.py

# 访问
# 前端: http://localhost:4180
# API文档: http://localhost:8190/docs
```

---

## 📡 API 文档

启动后端后访问 `http://localhost:8190/docs` 查看 Swagger 文档。

### 核心接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/styles?category=&search=&sort=` | 款式列表 |
| GET | `/api/styles/{id}` | 款式详情 |
| GET | `/api/styles/hot/ranking?limit=&days=` | 热门排行 |
| GET | `/api/tryon/history?limit=` | 试戴历史 |
| POST | `/api/tryon/upload-hand` | 上传手图 |
| POST | `/api/tryon/try-on` | 执行试戴 |
| GET | `/api/analytics/overview` | 运营总览 |
| GET | `/api/analytics/trends?days=` | 趋势数据 |
| POST | `/api/operations/chat` | AI对话 |
| POST | `/api/operations/reports/generate` | 生成报告 |

---

## 🏗️ 技术架构

```
Frontend (React 19 + Vite)     Backend (FastAPI)         AI Engine
┌──────────────────┐          ┌─────────────────┐      ┌──────────────┐
│  HomePage         │  HTTP    │  /api/styles     │      │  MiMo V2.5   │
│  TryOnPage        │────────→│  /api/tryon      │─────→│  Token Plan  │
│  StyleBrowsePage  │  Proxy  │  /api/analytics  │      │  (OpenAI SDK) │
│  DashboardPage    │          │  /api/operations │      └──────────────┘
└──────────────────┘          └────────┬────────┘
      Port 4180                       │           ┌──────────────┐
                                      └──────────→│  SQLite/     │
                                         Port 8190 │  PostgreSQL  │
                                                   └──────────────┘
```

### 数据库

默认使用 **SQLite**（零配置），设环境变量 `USE_POSTGRES=1` 切换 PostgreSQL。

表结构：

| 表 | 说明 | 数据量 |
|----|------|--------|
| `nail_styles` | 美甲款式库 | 25 |
| `hand_images` | 手部照片 | 13 |
| `tryon_records` | 试戴记录 | 200+ |
| `style_metrics` | 日级运营指标 | 750 (25款×30天) |
| `operations_reports` | AI 生成报告 | 按需 |
| `user_feedback` | 用户反馈 | 按需 |

---

## 🧪 演示指引

### 演示流程 (5分钟)

1. **首页** (1min) — 展示系统概览、热门TOP5
2. **AI试戴** (2min) — 选择一张手图上传 → 挑选款式 → 查看合成效果
3. **款式浏览** (1min) — 展示25款分类筛选、搜索
4. **运营看板** (1min) — 实时数据、趋势图、AI对话生成日报

### 推荐话术

> "这是一个AI驱动的美甲虚拟试戴与智能运营系统。用户上传手部照片后，MediaPipe 精确检测21个手部关键点，然后 OpenCV 将选中的美甲款式通过透视变换叠加到指甲区域，整个过程在500ms内完成。运营侧，系统自动采集用户行为数据，通过 MiMo 大模型生成日报和运营策略。"

---

## 📁 项目结构

```
meituan-hackathon/
├── frontend/                    # React 19 + Vite + TypeScript
│   ├── src/
│   │   ├── pages/               # 4个页面 (Home/TryOn/StyleBrowse/Dashboard)
│   │   ├── components/common/   # 主布局
│   │   └── services/api.ts      # API 服务层 (axios)
│   ├── Dockerfile
│   └── nginx.conf
├── backend/                     # FastAPI + Python 3.12
│   ├── app/
│   │   ├── api/                 # 4组 REST 端点
│   │   ├── core/                # 配置 + 数据库
│   │   ├── models/              # SQLAlchemy 模型
│   │   └── services/            # 试戴引擎/趋势分析/MiMo AI
│   ├── import_data.py           # 数据种子脚本
│   └── Dockerfile
├── docker-compose.yml           # 一键部署
├── PLAN.md                      # 项目规划
└── README.md
```

---

## 🔑 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MIMO_API_KEY` | MiMo Token Plan API Key | (必填) |
| `USE_POSTGRES` | 使用 PostgreSQL | `false` (SQLite) |
| `DATABASE_URL` | 自定义数据库 URL | 自动生成 |
| `DEBUG` | 调试模式 | `true` |

---

## 📝 开发阶段

- [x] Phase 1: 环境搭建 & 项目初始化
- [x] Phase 2: 数据层 & 基础 CRUD API
- [x] Phase 3: AI试戴模块 (MediaPipe + OpenCV)
- [x] Phase 4: 智能运营模块 (MiMo AI)
- [x] Phase 5: 联调 & 展示 & 文档
