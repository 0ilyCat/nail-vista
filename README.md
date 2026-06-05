<div align="center">

<img src="https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/Ant_Design-5.22-0170FE?style=flat-square&logo=antdesign&logoColor=white" />
<img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />

</div>

# NailVista — AI美甲试戴与智能运营

> 让用户「所见即所得」，让商家「实时管理」

智能体开发大赛 · 智能体应用赛道 · 龙猫队

---

## 项目简介

NailVista 是一个 **AI美甲虚拟试戴 x 社区 x 商家运营** 平台。

- **AI虚拟试戴**：选择商家 → 选择手图 → 选择款式 → AI 生成试戴效果图，结果缓存复用
- **AI智能对话**：小美时尚顾问（用户侧）+ 运营分析师（商家侧），支持流式输出、工具调用、思考过程展示
- **灵感广场**：小红书风格美甲社区，点赞/发布/多图帖子
- **店家专区**：商家列表/详情/店面轮播/预约时段/入驻系统
- **商家后台**：数据概览、款式管理、预约管理、时段管理、运营AI对话
- **用户中心**：收藏管理、预约管理、个人资料、头像上传

---

## 系统架构

```
  ┌─────────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
  │   React 18 + Vite   │────▶│   FastAPI (端口 8190)     │────▶│   MySQL         │
  │   端口 4180          │     │                          │     └─────────────────┘
  │                     │     │  /api/tryon    试戴引擎    │
  │  灵感广场           │     │  /api/posts    帖子社区    │     ┌─────────────────┐
  │  AI试戴             │     │  /api/styles   款式管理    │────▶│  百炼 AI        │
  │  店家专区           │     │  /api/merchants商家管理    │     └─────────────────┘
  │  商家后台           │     │  /api/appointments预约     │
  │  小美对话(WS流式)   │◀═══▶│  /ws/chat/*   AI对话中继  │     ┌─────────────────┐
  └─────────────────────┘     └──────────────────────────┘────▶│  OpenClaw网关   │
                                                               │  MiMo V2.5 Pro  │
                                                               └─────────────────┘
```

---

## 快速开始

### 环境要求

- Python 3.12+（推荐 conda 环境 `nail`）
- Node.js 22+
- MySQL 数据库
- OpenClaw Gateway（AI对话功能需要，端口 18789）

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
| `OPENCLAW_BASE_URL` | OpenClaw 网关地址（默认 http://127.0.0.1:18789） |

### 第二步：启动服务

```bash
# 后端启动（conda 环境 nail）
cd backend
pip install -r requirements.txt
python import_data.py              # 导入种子数据（用户/商家/款式/帖子）
python import_appointments.py      # 导入模拟预约数据（运营看板必备）
uvicorn app.main:app --host 0.0.0.0 --port 8190 --reload

# 前端启动（新终端）
cd frontend
npm install
npm run dev                         # 端口 4180
```

### 第三步：验证

```bash
curl http://localhost:8190/api/health              # 后端健康检查
curl http://localhost:8190/api/styles               # 款式列表
curl http://localhost:8190/api/merchants            # 商家列表
```
浏览器访问 `http://localhost:4180`

测试账号：`xiaomei / 123456`（用户） | `merchant01 / 123456`（商家）

---

## UI设计规范（v5.1）

| 类别 | 值 |
|------|-----|
| 主色调 | `#E8708D`（粉色系） |
| 标题/正文 | `#222` / `#333` / `#666`（黑/灰，不使用彩色做标题） |
| 布局底色 | `#FAFAFA` |
| 边框色 | `#F0F0F0` / `#eee` |
| 导航栏 | 毛玻璃 `backdrop-filter:blur(16px)` |
| 交互光晕 | 荧光粉边缘，hover 时 `box-shadow` 柔和发光 |
| Logo | Pacifico 手写艺术字体（Google Fonts） |

---

## API 接口

### 用户认证

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 用户注册 |
| `POST` | `/api/auth/login` | 用户登录 |
| `GET` | `/api/auth/me` | 获取当前用户信息 |
| `PUT` | `/api/auth/me` | 更新用户信息 |
| `POST` | `/api/auth/upload-avatar` | 上传头像 |

### AI对话（WebSocket流式）

| 端点 | 说明 |
|------|------|
| `ws://localhost:8190/ws/chat/user` | 小美时尚顾问对话（用户侧） |
| `ws://localhost:8190/ws/chat/ops` | 运营分析师对话（商家侧） |

### 试戴

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/tryon/hand-images` | 手图列表 |
| `POST` | `/api/tryon/upload-hand` | 上传手部照片 |
| `POST` | `/api/tryon/try-on` | 执行AI试戴（缓存优先） |
| `GET` | `/api/tryon/history` | 试戴历史（分页） |
| `DELETE` | `/api/tryon/hand-images/{id}` | 删除手图 |
| `DELETE` | `/api/tryon/history/{id}` | 删除试戴记录 |

### 款式

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/styles` | 款式列表（支持分类/色调/场景/排序/分页） |
| `GET` | `/api/styles/{id}` | 款式详情（含商家信息） |
| `GET` | `/api/styles/hot/ranking` | 热门排行 |
| `GET` | `/api/styles/categories` | 所有分类及数量 |

### 帖子社区

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/posts` | 帖子列表（推荐/最新/搜索/分页） |
| `GET` | `/api/posts/{id}` | 帖子详情（含款式关联/相关推荐） |
| `POST` | `/api/posts` | 发布帖子 |
| `DELETE` | `/api/posts/{id}` | 删除帖子 |
| `POST` | `/api/posts/{id}/like` | 点赞/取消点赞 |
| `POST` | `/api/posts/upload-image` | 上传帖子图片 |

### 商家

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/merchants` | 商家列表 |
| `GET` | `/api/merchants/{id}` | 商家详情（含款式/时段/图片） |
| `GET` | `/api/merchants/cities` | 城市列表 |
| `POST` | `/api/merchants/join` | 商家入驻 |
| `POST` | `/api/merchants/upload-image` | 上传店面图片 |
| `GET` | `/api/merchants/{id}/slots` | 预约时段及容量 |

### 预约

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/appointments` | 创建预约 |
| `GET` | `/api/appointments` | 预约列表 |
| `PUT` | `/api/appointments/{id}` | 更新预约状态 |
| `DELETE` | `/api/appointments/{id}` | 取消预约 |

### 商家后台

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/styles` | 款式管理列表 |
| `POST` | `/api/admin/styles` | 新建款式 |
| `PUT` | `/api/admin/styles/{id}` | 编辑款式 |
| `DELETE` | `/api/admin/styles/{id}` | 下架款式 |
| `POST` | `/api/admin/styles/{id}/image` | 设置款式图片 |
| `GET` | `/api/admin/appointments` | 预约管理列表 |
| `PUT` | `/api/admin/appointments/{id}` | 修改预约状态 |
| `GET` | `/api/admin/merchant-profile` | 商家店铺信息 |
| `PUT` | `/api/admin/merchant-profile` | 更新店铺信息（含时段） |

完整 Swagger：`http://localhost:8190/docs`

---

## 项目结构

```
nail-vista/
├── frontend/                       # React 18 + Vite 6 + TypeScript + Ant Design 5
│   └── src/
│       ├── pages/                  # Home / Community / Chat / TryOn / Merchants / Dashboard ...
│       ├── components/             # Layout / AppointmentModal / ChartRenderer
│       ├── hooks/                  # useChatWS (WebSocket流式对话)
│       └── services/               # api.ts / image.ts
├── backend/                        # FastAPI + SQLAlchemy + MySQL
│   ├── app/
│   │   ├── api/                    # auth / tryon / posts / styles / merchants / appointments / admin / ws_chat ...
│   │   ├── core/                   # config / database / security / logger
│   │   ├── models/                 # SQLAlchemy 数据模型
│   │   ├── services/               # bailian_service / local_image_service / tryon_engine
│   │   └── schemas/                # Pydantic 请求/响应模型
│   ├── static/                     # 图片资源（styles / hands / merchants / posts / results）
│   ├── import_data.py              # 种子数据导入（用户/商家/款式/帖子）
│   ├── import_posts.py             # 帖子单独导入
│   ├── import_appointments.py      # 模拟预约数据导入（运营看板必备）
│   ├── batch_generate.py           # 批量AI生图
│   └── .env.example
├── output/                         # 项目交付物（PPT / 技术报告 / 截图）
├── docker-compose.yml
├── PLAN.md
└── README.md
```

---

## 数据库

| 表名 | 说明 |
|------|------|
| `users` | 用户（含角色：user / merchant） |
| `merchants` | 商家（店面图片/时段配置/标签） |
| `nail_styles` | 美甲款式（关联商家） |
| `posts` | 帖子（多图/关联款式） |
| `post_likes` | 帖子点赞 |
| `appointments` | 预约记录 |
| `hand_images` | 手部照片 |
| `tryon_effects` | 试戴效果记录 |
| `chat_sessions` | AI对话会话 |
| `chat_messages` | AI对话消息记录 |
| `user_favorite_merchants / user_favorite_styles` | 用户收藏 |

默认使用 **MySQL**（`mysql+aiomysql`）。

---

## 开发阶段

- [x] 基础环境与项目初始化
- [x] 数据模型与 API 基础
- [x] AI试戴模块（百炼图生模型 + 缓存 + 历史）
- [x] AI智能对话（WebSocket流式 + 中继层 + 工具调用 + 思考过程）
- [x] 帖子社区（灵感广场 + 发布 + 多图）
- [x] 商家系统（入驻 + 店面图 + 时段管理）
- [x] 预约系统（商家款式下拉 + 时段容量）
- [x] 商家后台（数据概览 + 款式 + 预约 + 时段 + 运营AI）
- [x] UI精装修（粉色系 v5.1 + 毛玻璃 + 荧光粉光晕 + 灰度化）
- [x] 数据导入（种子数据 + 模拟预约）

---

## 许可证

MIT © 2026

---

<div align="center">
<sub>Built with 💅 by 龙猫队 · Powered by 百炼 AI</sub>
</div>
