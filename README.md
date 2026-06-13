

# 💅NailVista — AI美甲试戴与智能运营系统
<div>

<img src="https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/AI-MiMo_V2.5-FF69B4?style=flat-square&logo=openai&logoColor=white" />
<img src="https://img.shields.io/badge/MediaPipe-0.10-FF6F00?style=flat-square&logo=google&logoColor=white" />
<img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />

</div>

> 让用户「所见即所得」，让商家「数据驱动经营」

> 👉[http://175.178.224.202/](http://175.178.224.202/)👈 项目已上线，欢迎体验！！

美团校园 AI Hackathon 大赛 · 龙猫队

---
## 📸 宣传海报
<img width="2048" height="1152" alt="横版宣传海报，用于 GitHub README 顶部展示，主题为 NailVista AI美甲试戴与智能运营系统。整体为现代简约风格、专业设计感、浅墨绿色系配色，气质清新、科技、轻女性化但不过分艳俗。画面比例固定为 16_9，适合 README Banner _ Hero 图展示，印刷级质量。__整体配色要求：_- 主色：浅墨绿色 #8FA89A_- 深色标题：深墨绿 #5F7468_- 背景色：雾感米白绿 #F3F6F2_- 辅助色：浅灰绿 #C9" src="https://github.com/user-attachments/assets/0c5cd08a-7826-4c1a-b301-00fa37f246f7" />

---

## 🎬 演示视频 (旧版前端，仅作展示功能)
https://github.com/user-attachments/assets/2cb731be-d0ca-4488-a661-0bd5be51942b

---

## 💡 项目概述

NailVista 是一个面向美甲行业的 **AI 智能体应用**，通过图生模型实现 AI 虚拟试戴，通过大语言模型 Agent 实现智能时尚顾问和商家运营分析，打通消费者「发现-试戴-预约」和商家「入驻-发布-运营」两条完整链路。

### ✨ 创新点

| 创新维度 | 具体实现 |
|----------|----------|
| 💅 **AI 虚拟试戴** | 用户上传手部照片，30 秒内生成逼真美甲试戴效果图。双引擎架构：百炼 AI 图生模型 + MediaPipe/OpenCV 本地降级，确保服务高可用 |
| 🤖 **双 Agent 智能对话** | 基于 OpenClaw 框架构建「小美」时尚顾问和「运营助手」数据分析师两个独立 Agent，配备 9 个 Skill，支持 Function Calling 实时查询真实业务数据 |
| 🔄 **C 端 + B 端全链路闭环** | 不是单点 Demo，而是覆盖消费者发现/试戴/预约/社区互动和商家入驻/上架/预约管理/数据看板/AI 运营的完整产品 |

---

## 📊 工程完整性

| 指标 | 数值 | 说明 |
|------|------|------|
| 代码行数 | **12,674+** | 后端 Python 7,003 + 前端 TS/TSX 5,041 + CSS 630 |
| Git 提交 | **42+** | refactor/nail-vista-v2 分支 |
| 数据库表 | **17** | 用户 / 商家 / 款式 / 帖子 / 预约 / 对话 / 试戴 / 收藏等 |
| API 端点 | **~80** | RESTful API + 3 个 WebSocket 端点 |
| AI Agent | **2** | 小美时尚顾问（4 Skills）+ 运营数据分析师（5 Skills） |
| 前端页面 | **15** | C 端 7 个 + B 端 8 个 |
| 独立服务 | **3** | 前端 :4180 / 后端 :8190 / AI 网关 :18789 |

---

## 🗺️ 产品功能全景

### 👩 C 端 — 消费者旅程

```
注册登录 → 浏览款式 → 上传手图 → AI 试戴 → 收藏款式
                                              ↓
            发帖分享 ← 完成预约 ← 选择时段 ← 在线预约
                ↓
         咨询小美 AI 时尚顾问（实时对话）
```

| 功能模块 | 说明 |
|----------|------|
| 灵感广场 | 小红书风格美甲社区，瀑布流帖子展示，支持发布多图、点赞、收藏 |
| AI 虚拟试戴 | 上传手部照片 → 选择款式 → AI 合成效果图，支持缓存复用 |
| 款式浏览 | 分类筛选 / 色调 / 场景 / 甲型 / 排序 / 分页 |
| 商家发现 | 城市筛选、搜索、详情页（含店面轮播、可预约时段） |
| 在线预约 | 选择商家 → 选择款式 → 选择日期时段 → 提交预约 |
| 小美 AI 对话 | WebSocket 流式对话，款式推荐、搜索、试戴评价，思考过程可视化 |
| 个人中心 | 收藏管理、预约管理、个人资料编辑、头像上传 |

### 🏪 B 端 — 商家全链路

```
入驻申请 → 上架款式 → 配置时段 → 管理预约
                                      ↓
            运营决策 ← AI 运营助手 ← 数据看板
```

| 功能模块 | 说明 |
|----------|------|
| 商家入驻 | 在线提交资质、上传店面图片、填写营业信息 |
| 款式管理 | 新建/编辑/上下架美甲款式，上传款式图片 |
| 时段配置 | 灵活设置每日可预约时间段 |
| 预约管理 | 查看预约列表，确认/拒绝/完成操作 |
| 数据看板 | 营收统计、预约数量、热门款式排名、月度趋势图表 |
| AI 运营助手 | ChatBI 自然语言查询 + AI 运营报告（日报/趋势/策略） |

---

## ⚡ 核心功能

### 💅 AI 虚拟试戴

采用双引擎架构，兼顾效果和可用性：

```
用户上传手图 + 选择款式
        ↓
   ┌────┴────┐
   │ 缓存命中？│ → Yes → 直接返回（毫秒级）
   └────┬────┘
        ↓ No
   ┌────┴────┐
   │ 百炼可用？│ → Yes → AI 图生模型合成（30 秒内）
   └────┬────┘
        ↓ No
   MediaPipe 手部分割 + OpenCV 透视变换叠加（自动降级）
```

- **百炼主引擎**：调用阿里百炼 DashScope qwen-image-2.0-pro API，输入手部照片与美甲款式图片，输出合成试戴效果
- **MediaPipe 降级**：21 点手部关键点检测，精确提取指甲区域，OpenCV 透视变换 + 边缘羽化合成
- **缓存复用**：相同手图 + 相同款式自动缓存，避免重复调用，降低延迟和成本

### 🤖 AI 智能对话（双 Agent）

架构：`前端 WebSocket ↔ FastAPI 中继层 ↔ OpenClaw Gateway（SSE 流式）↔ MiMo V2.5 Pro`

**小美 · AI 时尚顾问**（用户侧）

| Skill | 功能 |
|-------|------|
| 款式搜索 | 按分类/色调/场景实时查询款式库 |
| 智能推荐 | 根据场合/肤色/风格/季节个性化推荐 |
| 潮流对话 | 美甲知识问答、流行趋势分享 |
| 试戴评价 | 多模态评价试戴效果图（颜色/款式/美感/细节四维评分） |

**运营助手 · AI 数据分析师**（商家侧）

| Skill | 功能 |
|-------|------|
| 运营概览 | 营收、预约、款式、用户一站式总览 |
| 热门排行 | 多维度热门款式排名 |
| 趋势分析 | 7 日/30 日试戴、订单、营收趋势 |
| 报告生成 | 自动生成日报、趋势分析、策略报告 |
| 定时任务 | 定时推送运营数据、异常预警 |

**🔬 核心技术特性**：
- **真流式输出**：WebSocket + SSE 实现 token 级别流式推送，打字机效果逐字呈现
- **Function Calling React 循环**：Agent 通过工具调用直接查询后端 MySQL 数据库，返回真实业务数据，不是编造答案
- **思考过程可视化**：模型推理过程实时展示，用户能看到 AI「正在思考什么」

---

## 💰 商业价值

### 📈 市场规模

中国美甲市场规模已超过 **2000 亿元**，年增长率保持在 15% 以上，但线上渗透率仅为 **5%** 左右。这个巨大的缺口就是 NailVista 的市场机会。

### 🎯 应用场景

- **美甲店**：线上展示 + 预约管理 + 数据驱动运营
- **美甲师**：个人作品展示 + 客户预约 + 风格主页
- **美甲品牌**：新品发布 + 虚拟试戴 + 社区种草营销
- **消费者**：随时随地 AI 试戴 + 社区灵感发现 + 在线预约

### 🚀 商业化路径

- **SaaS 订阅**：面向美甲店提供智能运营系统，按年/月收费
- **交易佣金**：用户通过平台预约，抽取服务费
- **广告推广**：美甲品牌在灵感广场投放推广内容
- **增值服务**：高级 AI 试戴效果、个性化时尚报告等付费功能

---

## 🏗️ 系统架构

```
┌──────────────────────┐     ┌───────────────────────────┐     ┌──────────────────┐
│   React 19 + Vite    │────▶│   FastAPI (端口 8190)      │────▶│   SQLite / MySQL │
│   端口 4180           │     │                           │     └──────────────────┘
│                      │     │  /api/auth      用户认证    │
│  15 个前端页面        │     │  /api/tryon     AI 试戴    │     ┌──────────────────┐
│  Ant Design 5 UI     │     │  /api/styles    款式管理    │────▶│  百炼 DashScope  │
│  WebSocket 流式对话   │◀═══▶│  /api/posts     帖子社区    │     │  qwen-image-2.0  │
│  ECharts 图表渲染     │     │  /api/merchants 商家系统    │     └──────────────────┘
│  Markdown 富文本      │     │  /api/appointments 预约     │
└──────────────────────┘     │  /api/admin     商家后台    │     ┌──────────────────┐
                             │  /api/analytics 数据分析    │────▶│  OpenClaw Gateway│
                             │  /api/chat + /ws/chat  AI   │     │  MiMo V2.5 Pro   │
                             │  /api/favorites 收藏管理    │     │  :18789          │
                             │  /api/dashboard 仪表盘      │     └──────────────────┘
                             │  /api/search    统一搜索    │
                             └───────────────────────────┘
```

---

## 🚀 快速开始

### 📋 环境要求

- Python 3.12+（推荐 conda 环境 `nail`）
- Node.js 22+
- OpenClaw Gateway（AI 对话功能需要，端口 18789）

### ⚙️ 配置

```bash
# 1. 后端环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 DASHSCOPE_API_KEY（可选，用于 AI 试戴图生成）

# 2. OpenClaw 配置
# 编辑 .openclaw/openclaw.json，替换 env.MIMO_API_KEY
# 获取 Key：https://token-plan-cn.xiaomimimo.com
```

### ▶️ 启动服务

```bash
# 后端
cd backend
pip install -r requirements.txt
python import_data.py          # 导入种子数据
uvicorn app.main:app --host 0.0.0.0 --port 8190 --reload

# 前端（新终端）
cd frontend
npm install
npm run dev                    # http://localhost:4180

# OpenClaw Gateway（新终端，Windows PowerShell）
.\start-openclaw.ps1
# 或手动：openclaw gateway run --port 18789
```

测试账号：`xiaomei / 123456`（用户） | `merchant01 / 123456`（商家）

---

## 📡 API 接口

### 🔐 用户认证

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 用户注册 |
| `POST` | `/api/auth/login` | 用户登录 |
| `GET` | `/api/auth/me` | 获取当前用户信息 |
| `PUT` | `/api/auth/me` | 更新用户信息 |
| `POST` | `/api/auth/upload-avatar` | 上传头像 |
| `POST` | `/api/auth/change-password` | 修改密码 |

### 💅 AI 试戴

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/tryon/hand-images` | 手图列表 |
| `POST` | `/api/tryon/upload-hand` | 上传手部照片 |
| `POST` | `/api/tryon/try-on` | 执行 AI 试戴（缓存优先） |
| `GET` | `/api/tryon/history` | 试戴历史（分页） |
| `DELETE` | `/api/tryon/hand-images/{id}` | 删除手图 |
| `DELETE` | `/api/tryon/history/{id}` | 删除试戴记录 |

### 💎 美甲款式

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/styles` | 款式列表（分类/色调/场景/排序/分页） |
| `GET` | `/api/styles/{id}` | 款式详情（含商家信息） |
| `GET` | `/api/styles/hot/ranking` | 热门排行 |
| `GET` | `/api/styles/categories` | 分类列表 |

### ✨ 灵感广场

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/posts` | 帖子列表（最新/推荐/分页） |
| `GET` | `/api/posts/{id}` | 帖子详情（含关联款式） |
| `POST` | `/api/posts` | 发布帖子 |
| `DELETE` | `/api/posts/{id}` | 删除帖子 |
| `POST` | `/api/posts/{id}/like` | 点赞/取消 |
| `POST` | `/api/posts/{id}/favorite` | 收藏/取消 |

### 🏪 商家系统

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/merchants` | 商家列表（城市/搜索/分页） |
| `GET` | `/api/merchants/{id}` | 商家详情（含款式/时段/图片） |
| `GET` | `/api/merchants/cities` | 城市列表 |
| `POST` | `/api/merchants/join` | 商家入驻 |
| `GET` | `/api/merchants/{id}/slots` | 可预约时段 |

### 📅 预约管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/appointments` | 创建预约 |
| `GET` | `/api/appointments` | 预约列表（状态/分页） |
| `PUT` | `/api/appointments/{id}` | 更新预约状态 |
| `DELETE` | `/api/appointments/{id}` | 取消预约 |

### 📊 商家后台

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/styles` | 款式管理列表 |
| `POST` | `/api/admin/styles` | 新建款式 |
| `PUT` | `/api/admin/styles/{id}` | 编辑款式 |
| `DELETE` | `/api/admin/styles/{id}` | 下架款式 |
| `GET` | `/api/admin/appointments` | 预约管理列表 |
| `PUT` | `/api/admin/appointments/{id}` | 修改预约状态 |
| `GET` | `/api/admin/merchant-profile` | 商家店铺信息 |
| `PUT` | `/api/admin/merchant-profile` | 更新店铺信息 |
| `GET` | `/api/dashboard/overview` | 仪表盘概览 |
| `GET` | `/api/dashboard/revenue` | 营收统计 |

### 💬 AI 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/chat/user` | 用户端 AI 对话（React 范式） |
| `POST` | `/api/chat/ops` | 运营端 AI 对话 |
| `POST` | `/api/chat/user/stream` | 用户端流式对话（SSE） |
| `GET` | `/api/chat/sessions` | 会话列表 |
| `GET` | `/api/chat/sessions/{key}` | 会话消息详情 |
| `WS` | `/ws/chat/user?token=` | 用户端 WebSocket 流式 |
| `WS` | `/ws/chat/ops?token=` | 运营端 WebSocket 流式 |

### 📈 运营分析

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/analytics/overview` | 运营总览（9 大指标） |
| `GET` | `/api/analytics/trends` | N 日趋势 |
| `GET` | `/api/analytics/hot-styles` | 热门款式排行 |
| `GET` | `/api/analytics/revenue` | 营收趋势 |
| `POST` | `/api/operations/reports/generate` | 生成运营报告 |

完整 Swagger 文档：[http://localhost:8190/docs](http://localhost:8190/docs)

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 19 + Vite 6 + TypeScript + Ant Design 5 | 15 个页面，毛玻璃导航，粉色系 UI |
| 后端 | FastAPI + SQLAlchemy | 异步 ORM，Pydantic 验证，JWT 认证 |
| 数据库 | SQLite（默认）/ MySQL | 17 张表，关联查询优化 |
| AI 网关 | OpenClaw Gateway | Agent 生命周期管理，Skill 调度，SSE 流式 |
| LLM | MiMo V2.5 Pro | 双 Agent 体系，Function Calling |
| 图生模型 | 阿里百炼 qwen-image-2.0-pro | AI 试戴效果图生成 |
| 计算机视觉 | MediaPipe + OpenCV | 手部关键点检测，降级合成 |
| 图表 | ECharts | 运营看板数据可视化 |
| 部署 | Docker Compose | 一键部署，2C4G 云服务器 |

---

## 📂 项目结构

```
nail-vista/
├── frontend/                          # React 19 + Vite + TypeScript
│   └── src/
│       ├── pages/                     # 15 个页面
│       │   ├── Home.tsx               # 首页
│       │   ├── TryOn.tsx              # AI 试戴
│       │   ├── Chat.tsx               # 小美对话（WebSocket 流式）
│       │   ├── Community.tsx          # 灵感广场
│       │   ├── PostDetail.tsx         # 帖子详情
│       │   ├── Styles.tsx             # 款式浏览
│       │   ├── StyleDetail.tsx        # 款式详情
│       │   ├── Merchants.tsx          # 商家列表
│       │   ├── MerchantDetail.tsx     # 商家详情
│       │   ├── MerchantJoin.tsx       # 商家入驻
│       │   ├── Appointments.tsx       # 我的预约
│       │   ├── Dashboard.tsx          # 商家仪表盘
│       │   ├── Favorites.tsx          # 收藏管理
│       │   ├── Profile.tsx            # 个人中心
│       │   └── Search.tsx             # 统一搜索
│       ├── components/                # Layout / ChartRenderer / AppointmentModal / FloatingAskButton
│       ├── hooks/                     # useChatWS（WebSocket 流式对话）
│       └── services/                  # API 层
├── backend/                           # FastAPI + Python 3.12
│   ├── app/
│   │   ├── api/                       # 16 个路由模块
│   │   ├── core/                      # 配置 / 数据库 / 安全 / 日志
│   │   ├── models/                    # SQLAlchemy 数据模型（17 张表）
│   │   ├── services/                  # 试戴引擎 / 百炼服务 / 趋势分析 / Skill Router / OpenClaw
│   │   └── schemas/                   # Pydantic 请求/响应模型
│   ├── static/                        # 图片资源
│   ├── import_data.py                 # 种子数据导入
│   └── .env.example
├── .openclaw/                         # OpenClaw 项目内配置（自包含）
│   ├── agents/
│   │   ├── nailvista-xiaomei/         # 小美：4 Skills
│   │   └── nailvista-ops/             # 运营助手：5 Skills
│   └── openclaw.json.template          # 配置模板
├── docker-compose.yml
└── README.md
```

---

## 🗄️ 数据库

| 表名 | 说明 |
|------|------|
| `users` | 用户（含角色：user / merchant / admin） |
| `merchants` | 商家（店面图片 / 时段配置 / 标签 / 评分） |
| `nail_styles` | 美甲款式（分类 / 色调 / 场景 / 甲型 / 热度分） |
| `nail_tags` + `style_tags` | 标签系统（多对多关联） |
| `posts` + `post_likes` | 帖子（多图 / 关联款式）+ 点赞 |
| `appointments` | 预约记录（状态流转：pending → confirmed → completed → cancelled） |
| `hand_images` | 手部照片 |
| `tryon_effects` | AI 试戴效果记录 |
| `chat_sessions` + `chat_messages` | AI 对话会话 + 消息（含思考过程） |
| `user_favorite_merchants` + `user_favorite_styles` | 收藏管理 |

---

## 📝 开发阶段

- [x] Phase 1：基础环境与项目初始化
- [x] Phase 2：数据模型与基础 API
- [x] Phase 3：AI 试戴（百炼图生 + MediaPipe 降级 + 缓存）
- [x] Phase 4：AI 双 Agent 对话（OpenClaw + WebSocket 流式 + 工具调用）
- [x] Phase 5：C 端完整功能（灵感广场 / 商家发现 / 预约 / 收藏）
- [x] Phase 6：B 端商家后台（入驻 / 上架 / 预约管理 / 数据看板 / 运营 AI）
- [x] Phase 7：UI 精装修（粉色系 + 毛玻璃 + 荧光粉光晕）
- [x] Phase 8：数据分析（运营一览 / 趋势 / 退款 / 评价 / 流量 / ChatBI）
- [x] Phase 9：线上部署（http://175.178.224.202/）

---

## 📄 许可证

MIT © 2026

---

[![Star History Chart](https://api.star-history.com/svg?repos=0ilyCat/nail-vista&type=Date)](https://star-history.com/#0ilyCat/nail-vista&Date)

<div align="center">
<sub>Built with 💅 by 龙猫队 · Powered by OpenClaw & 百炼 AI</sub>
</div>
