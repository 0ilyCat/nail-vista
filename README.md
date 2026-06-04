<div align="center">

<img src="https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/AI-qwen--image--2.0--pro-FF69B4?style=flat-square&logo=alibabacloud&logoColor=white" />
<img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />

</div>

# NailVista — AI美甲试戴与智能运营

> 让用户「所见即所得」，让商家「实时管理」

智能体开发大赛 · 智能体应用赛道 · 龙猫队

---

## 项目简介

NailVista 是一个 **AI美甲虚拟试戴 × 社区 × 商家运营** 平台。

- **AI虚拟试戴**：选择商家 → 选择手图 → 选择款式 → 百炼 AI 生成试戴效果图，结果缓存复用
- **灵感广场**：小红书风格美甲社区，点赞/发布/多图帖子
- **店家专区**：商家列表/详情/店面轮播/预约时段/入驻系统
- **商家后台**：数据概览、款式管理、预约管理、时段设置

---

## 系统架构

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│   React 19 + Vite   │────▶│   FastAPI (端口 8190)     │────▶│   MySQL         │
│   端口 4180          │     │                          │     └─────────────────┘
│                     │     │  /api/tryon    试戴引擎    │
│  灵感广场           │     │  /api/posts    帖子社区    │     ┌─────────────────┐
│  AI试戴             │     │  /api/styles   款式管理    │────▶│  百炼 AI        │
│  店家专区           │     │  /api/merchants商家管理    │     │  qwen-image-    │
│  商家后台           │     │  /api/appointments预约     │     │  2.0-pro-       │
│  小美对话           │     │  /api/admin    后台管理    │     │  2026-04-22     │
└─────────────────────┘     └──────────────────────────┘     └─────────────────┘
```

---

## 快速开始

### 环境要求

- Python 3.12+（推荐 conda 环境 `nail`）
- Node.js 22+
- MySQL 数据库

### 第一步：配置

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入数据库密码和百炼 API Key
```

关键配置项：

| 变量 | 说明 |
|------|------|
| `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` | MySQL 连接 |
| `DASHSCOPE_API_KEY` | 阿里百炼图生模型 Key（AI试戴必填） |
| `JWT_SECRET_KEY` | JWT 签名密钥 |

### 第二步：启动服务

```bash
# 后端启动（conda 环境 nail）
cd backend
pip install -r requirements.txt
python import_data.py      # 导入种子数据（用户/商家/款式/帖子）
uvicorn app.main:app --host 0.0.0.0 --port 8190 --reload

# 前端启动（新终端）
cd frontend
npm install
npm run dev                 # 端口 4180

# 单独导入帖子（可选，不影响已有数据）
python import_posts.py
```

### 第三步：验证

```bash
curl http://localhost:8190/api/health              # 后端健康检查
curl http://localhost:8190/api/styles               # 款式列表（25款）
curl http://localhost:8190/api/merchants            # 商家列表（3家）
```
浏览器访问 `http://localhost:4180`

---

## API 接口

### 试戴

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/tryon/hand-images` | 手图列表（用户上传 + 预设） |
| `POST` | `/api/tryon/upload-hand` | 上传手部照片 |
| `POST` | `/api/tryon/try-on` | 执行AI试戴（缓存优先，支持 force_regenerate 重新生成） |
| `GET` | `/api/tryon/history` | 试戴历史记录（分页） |
| `DELETE` | `/api/tryon/hand-images/{id}` | 删除手图（不级联删历史） |
| `DELETE` | `/api/tryon/history/{id}` | 删除单条试戴记录 |

### 款式

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/styles` | 款式列表（支持分类/色调/场景/商家/搜索/排序/分页） |
| `GET` | `/api/styles/{id}` | 款式详情（含商家信息） |
| `GET` | `/api/styles/hot/ranking` | 热门排行 |
| `GET` | `/api/styles/categories` | 所有分类及数量 |

### 帖子社区

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/posts` | 帖子列表（推荐/最新/搜索/分类/分页） |
| `GET` | `/api/posts/{id}` | 帖子详情（含款式关联、相关推荐） |
| `POST` | `/api/posts` | 发布帖子（标题/正文/多图） |
| `DELETE` | `/api/posts/{id}` | 删除帖子 |
| `POST` | `/api/posts/{id}/like` | 点赞/取消点赞 |
| `POST` | `/api/posts/upload-image` | 上传帖子图片 |

### 商家

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/merchants` | 商家列表（按城市筛选/排序/分页） |
| `GET` | `/api/merchants/{id}` | 商家详情（含款式列表/时段/店面图片） |
| `GET` | `/api/merchants/cities` | 城市列表 |
| `POST` | `/api/merchants/join` | 商家入驻（每账号仅一次，须上传店面图） |
| `POST` | `/api/merchants/upload-image` | 上传店面图片 |
| `GET` | `/api/merchants/{id}/slots` | 查询可用预约时段及容量 |

### 预约

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/appointments` | 创建预约 |
| `GET` | `/api/appointments` | 用户预约列表 |
| `GET` | `/api/appointments/{id}` | 预约详情 |
| `PUT` | `/api/appointments/{id}` | 更新预约状态 |
| `DELETE` | `/api/appointments/{id}` | 取消预约 |

### 商家后台

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/styles` | 款式列表（商家视角） |
| `POST` | `/api/admin/styles` | 新建款式 |
| `PUT` | `/api/admin/styles/{id}` | 编辑款式 |
| `DELETE` | `/api/admin/styles/{id}` | 下架款式 |
| `POST` | `/api/admin/styles/{id}/image` | 设置款式图片 |
| `GET` | `/api/admin/appointments` | 预约列表（商家视角） |
| `PUT` | `/api/admin/appointments/{id}` | 修改预约状态 |
| `GET` | `/api/admin/merchant-profile` | 商家店铺信息 |
| `PUT` | `/api/admin/merchant-profile` | 更新店铺信息（含时段配置） |

完整 Swagger：`http://localhost:8190/docs`

---

## 项目结构

```
nail-vista/
├── frontend/                       # React 19 + Vite + TypeScript
│   └── src/
│       ├── pages/                  # Community / TryOn / Merchants / Dashboard / Chat ...
│       ├── components/             # Layout / AppointmentModal
│       └── services/               # api.ts / image.ts
├── backend/                        # FastAPI + Python 3.12
│   ├── app/
│   │   ├── api/                    # tryon_api / posts / styles / merchants / appointments / admin / auth / chat ...
│   │   ├── core/                   # config / database / security / logger
│   │   ├── models/                 # SQLAlchemy 模型
│   │   ├── services/               # bailian_service / local_image_service / tryon_engine
│   │   └── schemas/                # Pydantic 请求/响应
│   ├── static/                     # 图片资源（styles / hands / merchants / posts / results）
│   ├── import_data.py              # 全量数据导入脚本
│   ├── import_posts.py             # 帖子单独导入（不影响已有数据）
│   ├── batch_generate.py           # 批量AI生图
│   └── .env.example
├── docker-compose.yml
├── PLAN.md
└── README.md
```

---

## 数据库

| 表名 | 说明 |
|------|------|
| `users` | 用户（含角色：user / merchant） |
| `merchants` | 商家（含店面图片/时段配置/标签） |
| `nail_styles` | 美甲款式（关联商家） |
| `posts` | 帖子（多图/关联款式） |
| `post_likes` | 帖子点赞 |
| `appointments` | 预约记录 |
| `hand_images` | 手部照片（用户上传 + 预设） |
| `tryon_effects` | 试戴效果记录 |
| `user_favorite_merchants / user_favorite_styles` | 用户收藏 |

默认使用 **MySQL**。

---

## 核心功能说明

### AI试戴

```
选择商家 → 选择手图 → 选择款式 → 百炼 qwen-image-2.0-pro-2026-04-22 生图
                                                    ↓
                            结果缓存 results/hand_{id}_style_{id}.png
                          再次相同组合 → 秒出（缓存命中）
                          重新生成 → 覆盖缓存 + 更新 DB 记录
```

- 超时配置：生成 300s / 下载 120s / 前端 310s
- 全链路中文日志：`[试戴]` + `[百炼生图]` 标签
- 试戴历史：卡片网格 + 分页 + 点击回填

### 帖子发布

- 标题（必填）、正文（可选，500字）、图片（可选，最多3张）
- 多图上传：逐个调用上传接口，返回 URL 列表一次提交
- 灵感广场卡片只展示标题（不加粗），详情页展示完整内容

### 商家入驻

- 每账号仅一次入驻机会（后端双校验）
- 须上传至少 1 张、最多 3 张店面图片
- 详情页横向轮播展示店面图（autoplay 4s，点击放大）

### 时段管理（商家后台）

- JSON 数组存储：`[{start: "09:00", end: "10:00", max_bookings: 2}, ...]`
- 添加/编辑/删除 + 保存按钮（本地暂存后一次性提交）
- 用户预约时展示各时段剩余容量

---

## 开发阶段

- [x] 基础环境与项目初始化
- [x] 数据模型与 API 基础
- [x] AI试戴模块（百炼图生模型 + 缓存 + 历史）
- [x] 帖子社区（灵感广场 + 发布 + 多图）
- [x] 商家系统（入驻 + 店面图 + 时段管理）
- [x] 预约系统（商家款式下拉 + 时段容量）
- [x] 商家后台（数据概览 + 款式 + 预约 + 时段）

---

## 许可证

MIT © 2026

---

<div align="center">
<sub>Built with 💅 by 龙猫队 · Powered by 百炼 AI</sub>
</div>
