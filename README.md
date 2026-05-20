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

# 💅 NailVista — AI Nail Art Try-On & Smart Operations

> 美甲AI虚拟试戴 × 智能运营分析 —— 让用户「所见即所得」，让运营「实时感知趋势」

---

## ✨ What is NailVista?

NailVista is a dual-engine platform for **AI-powered virtual nail art try-on** and **intelligent operations analytics**, built for the Meituan Hackathon.

- 👁️ **AI Try-On**: Upload a hand photo → pick a nail style → see it on your hand in seconds
- 📊 **Smart Dashboard**: Real-time hot rankings, 7-day trend charts, AI-generated daily reports
- 🤖 **MiMo AI Assistant**: Natural language Q&A, auto-generate operations strategies

---

## 🏗️ Architecture

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│   React 19 + Vite   │────▶│   FastAPI (port 8190)     │────▶│   SQLite / PG    │
│   port 4180         │     │                          │     └─────────────────┘
│                     │     │  /api/styles   款式管理    │
│  HomePage           │     │  /api/tryon    试戴引擎    │     ┌─────────────────┐
│  TryOnPage          │     │  /api/analytics 数据分析   │────▶│  MiMo V2.5       │
│  StyleBrowsePage    │     │  /api/operations AI运营    │     │  Token Plan      │
│  DashboardPage      │     │                          │     └─────────────────┘
└─────────────────────┘     │  MediaPipe + OpenCV       │
                            │  百炼 qwen-image-2.0-pro   │
                            └──────────────────────────┘
```

### AI Try-On Pipeline

```
Upload Hand Photo → MediaPipe 21-Point Detection → Nail Region Estimation
                                                        ↓
                    Style Image (perspective warp)  →  OpenCV Overlay + Edge Blending
                                                        ↓
                    Bailian qwen-image-2.0-pro      →  AI-Generated Result (cached)
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.12+ (conda recommended)
- Node.js 22.16+
- [DASHSCOPE_API_KEY](https://dashscope.console.aliyun.com/) (for AI image generation)

### Development

```bash
# 1. Backend
conda create -n nailvista python=3.12 -y && conda activate nailvista
cd backend
pip install -r requirements.txt
python import_data.py              # Seed data (25 styles + metrics)
uvicorn app.main:app --port 8190 --reload

# 2. Frontend
cd frontend
npm install
npm run dev                        # → http://localhost:4180
```

### Generate AI Try-On Images (Batch)

```bash
cd backend
export DASHSCOPE_API_KEY=sk-xxxx

# Check status
python batch_generate.py --check

# Generate sample
python batch_generate.py --sample 5

# Generate all (13 hands × 25 styles = 325 images)
python batch_generate.py
```

### Docker (Optional)

```bash
docker compose up -d --build
# Frontend: http://localhost:4180
# API docs: http://localhost:8190/docs
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/tryon/hand-images` | List all hand images (user + preset) |
| `POST` | `/api/tryon/upload-hand` | Upload a hand photo |
| `POST` | `/api/tryon/try-on` | Execute AI try-on (cache-first, generate on miss) |
| `GET` | `/api/tryon/history` | Try-on history |
| `GET` | `/api/styles` | List nail styles (filter/sort/page) |
| `GET` | `/api/styles/{id}` | Style detail with stats |
| `GET` | `/api/styles/hot/ranking` | Hot ranking by hot score |
| `GET` | `/api/analytics/overview` | Operations overview |
| `GET` | `/api/analytics/trends` | N-day trend data |
| `POST` | `/api/operations/chat` | AI assistant chat (MiMo) |
| `POST` | `/api/operations/reports/generate` | Generate daily/trend/strategy report |

Full Swagger docs: `http://localhost:8190/docs`

---

## 🗂️ Project Structure

```
nail-vista/
├── frontend/                     # React 19 + Vite + TypeScript
│   ├── src/
│   │   ├── pages/                # HomePage / TryOnPage / StyleBrowsePage / DashboardPage
│   │   ├── components/common/    # MainLayout
│   │   └── services/api.ts       # Axios API layer
│   ├── public/static/            # Local images (styles, hands, results)
│   └── vite.config.ts
├── backend/                      # FastAPI + Python 3.12
│   ├── app/
│   │   ├── api/                  # tryon / styles / analytics / operations
│   │   ├── core/                 # config / database
│   │   ├── models/               # SQLAlchemy models (6 tables)
│   │   └── services/             # tryon_engine / bailian_service / openclaw_service / trend_analyzer
│   ├── batch_generate.py         # Batch AI image generation script
│   ├── import_data.py            # Data seeding script
│   └── requirements.txt
├── docker-compose.yml            # Optional Docker deployment
├── PLAN.md                       # Full project plan
└── README.md
```

---

## 📊 Database

| Table | Description | Records |
|-------|-------------|---------|
| `nail_styles` | Nail art catalog (25 styles, 8 categories) | 25 |
| `hand_images` | Hand photos (user uploads + presets) | 13+ |
| `tryon_records` | Try-on history | 200+ |
| `style_metrics` | Daily operations metrics (25 styles × 30 days) | 750 |
| `operations_reports` | AI-generated reports | on-demand |
| `user_feedback` | User ratings & comments | on-demand |

Default: **SQLite** (zero-config). Set `USE_POSTGRES=1` for PostgreSQL.

---

## 🎯 Key Features

### Try-On Cache Strategy

```
hand_name + style_id → static/results/{hand_name}+style_{id}.png
                         ↑
                    ┌────┴────┐
                    │ Exists?  │
                    └────┬────┘
                   Yes ↓  ↓ No
                Return    Call Bailian API
                cached    → Save to results/
                          → Return result
```

- First try-on for a combination: **~5-10s** (Bailian AI generation)
- Subsequent tries: **instant** (cached on disk)
- Bailian unavailable → **fallback to MediaPipe + OpenCV**

### Smart Operations

- **Hot Score Algorithm**: `tryons×0.4 + favorites×0.25 + views×0.2 + shares×0.1 + duration_bonus`
- **MiMo AI**: Real-time chat, daily/weekly reports, trend analysis, strategy recommendations

---

## 🔑 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MIMO_API_KEY` | MiMo Token Plan API Key | (required for chat) |
| `DASHSCOPE_API_KEY` | Alibaba Bailian API Key | (required for image gen) |
| `USE_POSTGRES` | Use PostgreSQL instead of SQLite | `false` |
| `DATABASE_URL` | Custom database URL | auto-generated |
| `DEBUG` | Debug mode | `true` |

---

## 📝 License

MIT © 2026

---

<div align="center">
<sub>Built with 💅 by 0ilyCat · Powered by MiMo & Bailian AI</sub>
</div>
