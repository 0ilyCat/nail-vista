# NailVista 技术报告

> AI 驱动的美甲虚拟试戴与智能运营平台  
> 智能体创新应用大赛 · 参赛作品

---

## 摘要

NailVista 面向美甲消费场景，基于多模态 AI 与智能 Agent 技术，构建了一套集虚拟试戴、智能推荐与数据分析于一体的全栈平台。平台采用 OpenClaw Agent 引擎管理两个独立 AI 助手——面向用户的“小美”时尚顾问与面向运营的数据分析师，通过自定义 Skill 体系实现业务逻辑封装。前端基于 React 19 构建角色化多页面 SPA，后端以 FastAPI 提供异步 API 与 SSE 流式桥接。图像处理采用百炼 Bailian API 与 MediaPipe+OpenCV 三级降级链路，保障生成可用性。本文从系统架构、Agent 设计、试戴引擎、前端体验四个维度进行阐述。

---

## 1. 引言

### 1.1 背景

美甲消费中，用户在线浏览款式时无法直观预知上甲效果，决策周期长、试错成本高；商家侧则缺乏数据驱动的运营决策能力，难以实时感知用户偏好变化与款式热度趋势。传统的“看图片→到店试”模式无法满足用户对所见即所得的需求，而商家也缺少轻量级的数据分析工具。

### 1.2 目标

本项目的目标是构建一个 AI 全栈平台，解决上述两大痛点：

- **用户侧**：提供高保真虚拟试戴能力，上传手部照片即可预览任意美甲款式的实际效果，同时配备 AI 时尚顾问进行个性化推荐与效果评价。
- **运营侧**：构建实时数据看板，支持关键指标统计、趋势分析与热门排行，并内置 AI 运营助手，可通过自然语言交互查询数据、生成报告。

### 1.3 技术路线

平台采用“前端 SPA + 后端 API + AI Agent 引擎”三层架构，核心选型为 React 19 (Vite)、FastAPI、OpenClaw Gateway 与 MiMo V2.5 系列模型。试戴图像由阿里百炼 Bailian API 生成，MediaPipe Hands 21 关键点检测与 OpenCV 透视变换作为本地降级方案。

---

## 2. 系统架构

### 2.1 架构概览

```
┌─────────────────────┐          ┌─────────────────────┐          ┌──────────────────────┐
│   React 前端 (:4180)  │ ◄─HTTP──► │   FastAPI 后端 (:8190) │ ◄─OpenAI─► │  OpenClaw Gateway    │
│                      │  SSE     │                      │  Compat   │  (:18789)            │
│  RoleSelectPage      │          │  /api/chat/user      │          │                      │
│  StyleBrowsePage     │          │  /api/chat/dashboard │          │  nailvista-xiaomei   │
│  TryOnPage           │          │  /api/tryon/*        │          │  nailvista-ops       │
│  ChatPage            │          │  /api/styles/*       │          │  9 custom skills     │
│  DashboardPage       │          │  /api/analytics/*    │          │  MiMo V2.5 Token Plan│
└─────────────────────┘          └─────────────────────┘          └──────────────────────┘
```

三层职责分离：

1. **前端层**：React 19 SPA，Vite 6 构建。角色选择页（/）分流至用户端与运营端两套独立路由，共享 UI 组件与 ChatWidget。
2. **后端层**：FastAPI 异步框架，SQLAlchemy + SQLite/PostgreSQL 持久化。通过 httpx 向 OpenClaw 转发请求并以 SSE 流式推送到前端。图像处理三级链路：缓存查询 → 百炼生成 → 本地合成。
3. **AI Agent 层**：OpenClaw Gateway 管理双 Agent，每个 Agent 拥有独立的 workspace、人格定义文件与 Skill 集合。通过 `/v1/chat/completions` 标准接口暴露，支持流式响应与多模态输入。

### 2.2 组件详细说明

**角色选择首页（/）**：品牌展示区、两个大卡片入口（用户端/运营端），悬停动效与入场动画。

**用户端（/user/*）**：四个子页面——款式浏览（网格+搜索+分类+排序）、AI试戴（三列等宽流程）、小美对话（全屏聊天+模板提问）、StyleBrowsePage 右下角浮动“AI试戴”按钮。

**运营端（/dashboard）**：双栏布局——左侧 42% 宽度展示 4 个统计卡片 + 7 日趋势折线图 + 热门排名表，右侧 58% 为 AI 运营助手对话面板。排行榜使用 flex 自适应高度与右侧面板底边对齐。

---

## 3. OpenClaw AI Agent 引擎

### 3.1 选型理由

相较于直接调用模型 API，选择 OpenClaw 作为中间网关层基于以下考量：

- **Agent 隔离**：每个 Agent 拥有独立的 workspace 目录，包含 `SOUL.md`（人格定义）、`AGENTS.md`（行为指令）与 `skills/`（技能文件），实现关注点分离。
- **Skill 封装**：业务流程以声明式 Markdown 文件（`SKILL.md`）描述，包含触发条件、操作流程、模型选择与回复格式，Agent 运行时按需加载执行。
- **Session 管理**：多轮对话上下文由 OpenClaw 自动维护，前端无需自行拼接消息历史。
- **OpenAI 兼容 API**：`/v1/chat/completions` 标准接口，前端与后端可无缝对接，降低集成成本。
- **本地部署**：数据不出域，适用于私有化交付场景。

OpenClaw 版本：2026.5.12 (f066dd2)。

### 3.2 双 Agent 架构

两个 Agent 在 Agent 类型、能力边界与模型配置上存在明确分工：

| 属性 | 小美 | 运营助手 |
|------|------|----------|
| Agent ID | nailvista-xiaomei | nailvista-ops |
| 角色定位 | AI 时尚顾问 | 数据分析师 |
| 对话语言 | 中文 | 中文 |
| 默认模型 | MiMo V2.5 (text+image) | MiMo V2.5-Pro (text only) |
| 多模态 | 支持图像评价 | 不支持 |
| 上下文窗口 | 256K | 1,024K |
| Skill 数量 | 4 | 5 |
| 前端入口 | /user/chat | /dashboard |

### 3.3 小美 Agent — 技能定义

小美面向普通用户，核心技能围绕美甲款式的搜索、推荐与效果评价：

| Skill 名称 | 功能描述 | 使用的模型 |
|------------|---------|-----------|
| nail-style-search | 根据分类、颜色、热度等条件查询数据库中的美甲款式，返回格式化列表。 | MiMo V2.5-Pro |
| nail-style-recommend | 基于用户输入的场景（如“约会”“日常通勤”）进行个性化推荐，考虑肤色、甲型等因素。 | MiMo V2.5-Pro |
| nail-tryon-evaluate | 接收试戴效果图，调用多模态视觉模型从颜色搭配（30分）、款式匹配（25分）、整体美感（25分）、细节呈现（20分）四个维度进行量化评分，满分 100 分。 | MiMo V2.5（多模态） |
| nail-trend-chat | 回答用户关于美甲潮流、护理知识、搭配技巧等开放式问题。 | MiMo V2.5-Pro |

小美的 SOUL.md 人格定义强调“温暖亲切、专业可靠”，避免机械式回复，并鼓励在对话中适度使用表情符号。

### 3.4 运营助手 Agent — 技能定义

运营助手面向商家后台，核心技能围绕数据查询、分析与自动化：

| Skill 名称 | 功能描述 |
|------------|---------|
| ops-overview | 查询当前运营概览数据：款式总数、今日试戴次数、浏览量、累计数据及环比变化。 |
| ops-trends | 分析最近 7 天的试戴、浏览、收藏走势，识别异常波动并提供文字摘要。 |
| ops-hot-styles | 展示热门款式排行（Top 10），包含热度分、试戴次数、分类与变化百分比。 |
| ops-generate-report | 自动生成运营日报或周报，包含关键指标、趋势分析、热门款式与建议。 |
| ops-schedule-task | 支持创建、查看、删除定时任务，使用 cron 表达式调度（如每日 09:00 自动发送日报）。 |

全部 5 个 Skill 均使用 MiMo V2.5-Pro 模型（1M 上下文），确保在分析大量运营数据时保持完整上下文。

### 3.5 模型配置与 Token Plan

本项目使用小米 MiMo Token Plan，通过 `xiaomi-coding` provider 对接。以下为 provider 下的三款模型：

| 模型 ID | 名称 | 推理能力 | 输入类型 | 上下文窗口 | 最大输出 |
|---------|------|---------|---------|-----------|---------|
| mimo-v2.5-pro | MiMo V2.5 Pro | Reasoning | text only | 1,048,576 | 32,000 |
| mimo-v2.5 | MiMo V2.5 | Reasoning | text + image | 262,144 | 32,000 |
| mimo-v2-omni | MiMo V2 Omni | Reasoning | text + image | 262,144 | 32,000 |

Provider 配置要点：

1. Provider 名设置为 `xiaomi-coding`（与内置 MiMo 网关区分）。
2. API 类型设为 `openai-completions`，Base URL 为 `https://token-plan-cn.xiaomimimo.com/v1`。
3. `gateway.http.endpoints.chatCompletions.enabled` 必须设为 `true`（该端点默认禁用）。
4. API Key 通过环境变量 `MIMO_API_KEY` 注入，配置文件中使用 SecretRef 引用。

### 3.6 SSE 流式对话实现

流式对话链路如下：

```
React ChatWidget (fetch + ReadableStream)
  → POST /api/chat/user/stream { message, session_key, image_url? }
  → FastAPI SSE StreamingResponse (text/event-stream)
  → httpx.stream POST http://127.0.0.1:18789/v1/chat/completions
     { model: "openclaw/nailvista-xiaomei", messages, stream: true }
  → OpenClaw Gateway → Agent Turn (加载 SOUL.md + 匹配 Skill → 调用 MiMo API)
  → SSE events: text | tool_start | tool_end | thinking | done
  → 前端 ReactMarkdown 逐字渲染 + 工具调用/思考过程折叠展示
```

前端 ChatWidget 组件内部使用 `ReadableStream` API 逐行解析 SSE 事件流，根据事件类型更新 UI。工具调用以可折叠卡片展示，包含执行状态（运行中/完成）与结果内容。思考过程使用独立折叠区，默认收起。

---

## 4. AI 虚拟试戴引擎

### 4.1 三级链路设计

为保证试戴效果生成的可用性与响应速度，设计了三级降级链路：

| 级别 | 方式 | 耗时 | 说明 |
|------|------|------|------|
| L1 | 百炼缓存命中 | ≤ 500ms | 已生成效果存储于后端，命中直接返回 URL |
| L2 | 百炼实时生成 | 5-15s | 调用阿里 DashScope 文生图 API，首次生成 |
| L3 | 本地降级合成 | ≤ 1s | MediaPipe Hands 检测指尖 + OpenCV 透视变换合成 |

后端服务在内存中维护 LRU 缓存（基于手图+款式组合的哈希键），L1 命中率随使用次数提升逐步提高。

### 4.2 图像处理技术

**手部检测**：MediaPipe Hands 模型提取 21 个手部关键点，其中指尖坐标（食指、中指、无名指、小指）用于后续对齐。检测阈值 0.5，最大检测手数 1。

**图像合成**：OpenCV 计算透视变换矩阵，将款式效果图映射至指尖区域；使用泊松融合（`cv2.seamlessClone`）实现色彩平滑过渡，减少合成痕迹。

**预置资源**：`batch_generate.py` 脚本预生成 25 款美甲效果图（存储于 `backend/static/` 目录），同时提供 13 张示例手部照片（`user_01` 至 `user_13`）用于演示与历史上传展示。

### 4.3 前端交互流程

试戴页面（/user/tryon）采用三列等宽 CSS Grid 布局，每列宽度 `1fr`，预览区统一高度 260px。流程分为三步：

1. **选择手部照片**：支持拖拽上传、历史记录缩略图点选。上传后立即显示 260px 正方形预览。
2. **选择美甲款式**：下拉搜索框 + 可滚动缩略图网格（56×56px），选中后顶部预览区同步更新。
3. **查看试戴效果**：点击“试戴”按钮触发后端链路，效果图区域展示生成的图片、款式名称与生成耗时。提供“重新试戴”与“换款式”按钮。

从款式浏览页进入试戴时，通过 URL 参数 `?styleId=X` 预选款式，减少操作步骤。

---

## 5. 前端设计系统

### 5.1 色彩体系

采用 oklch 色域定义，保证在不同设备上的色彩一致性：

| 变量 | 值 | 用途 |
|------|-----|------|
| --primary | oklch(52% 0.13 12) | 主色调，warm rose |
| --primary-dark | oklch(45% 0.14 12) | 深色变体 |
| --primary-light | oklch(82% 0.05 12) | 浅色变体 |
| --accent | oklch(40% 0.15 350) | 强调色，deep burgundy |
| --bg | oklch(97% 0.003 30) | 页面背景 |
| --bg-alt | oklch(95% 0.005 30) | 次级背景 |
| --surface | oklch(100% 0 0) | 卡片表面 |
| --text | oklch(22% 0.005 30) | 正文 |
| --text-secondary | oklch(45% 0.01 30) | 次要文本 |
| --text-muted | oklch(70% 0.01 30) | 辅助文本 |
| --border | oklch(88% 0.01 30) | 默认边框 |
| --border-light | oklch(94% 0.005 30) | 浅色边框 |

### 5.2 排版

- **展示字体**：Playfair Display（衬线体），用于页面标题、品牌名与卡片标题
- **正文字体**：DM Sans + system-ui fallback，用于 UI 文本与正文
- **字号层级**：6 级缩放体系——`xs`(0.75rem) → `sm`(0.875rem) → `base`(1rem) → `lg`(1.125rem) → `xl`(1.25rem) → `2xl`(1.5rem) → `3xl`(1.875rem)
- **间距网格**：4px 基础单位，扩展为 `--space-xs`(4px) 至 `--space-3xl`(48px)

### 5.3 动效体系

- **页面入场**：`fadeSlideIn`，400ms `ease-out-expo`，透明度 + 上移 16px
- **卡片悬停**：`translateY(-2px)` + `box-shadow` 放大，300ms `ease-out-expo`
- **梯度边框**：`@keyframes gradientBorder`，4s 循环，`background-position` 位移动画
- **Blob Morphing**：`@keyframes blobMorph`，5s 循环，border-radius 动态变化 + scale 微调
- **加载动画**：5 条 `.paint-ribbon` 彩色光带，`mix-blend-mode: screen` 交织融合，各具不同浮动动画（ribbonFloat1/2/3）
- **骨架屏**：`@keyframes shimmer` 扫描光效
- **打字指示器**：3 点 `typingBounce` 异步弹跳

### 5.4 ChatWidget 组件设计

`<ChatWidget>` 是平台内对话功能的统一组件，在三个页面复用（ChatPage、DashboardPage、TryOnPage）：

**模式切换**：通过 `agentType` prop 区分 `"user"`（小美）与 `"dashboard"`（运营助手），组件自动切换对应的 SSE 端点、欢迎语与快捷操作。

**流式渲染**：使用 `fetch` + `ReadableStream` 接收 SSE 事件流。文本事件通过 ReactMarkdown 实时渲染（`remarkGfm` + `remarkBreaks` 插件），表格自动包裹滚动容器。工具调用事件以可折叠手风琴展示，思考过程独立折叠区默认收起。

**快捷操作**：`quickActions` prop 接收 `{ label, message }` 数组，在聊天区域上方渲染为横向标签按钮，点击自动发送对应消息。

**多模态上下文**：`contextImage` prop 传递试戴效果图 URL，聊天接口携带 `image_url` 字段，触发 Agent 的多模态评价能力。

**Session 持久化**：组件在本地维护 `sessionKey`，每次请求携带，实现跨页面刷新保持对话上下文。

---

## 6. 后端 API 设计

### 6.1 接口总览

| 端点 | 方法 | 功能 |
|------|------|------|
| /api/tryon/upload-hand | POST | 上传手部照片 |
| /api/tryon/hand-images | GET | 历史手图列表 |
| /api/tryon/try-on | POST | 执行试戴（指定手图ID + 款式ID） |
| /api/styles | GET | 查询款式（参数: category, search, sort, page, size） |
| /api/styles/categories | GET | 获取分类列表及计数 |
| /api/analytics/overview | GET | 运营数据概览 |
| /api/analytics/trends?days=N | GET | N 日趋势数据 |
| /api/analytics/hot-styles | GET | 热门款式排行 |
| /api/chat/user | POST | 小美同步对话 |
| /api/chat/user/stream | POST | 小美 SSE 流式对话 |
| /api/chat/dashboard | POST | 运营助手同步对话 |
| /api/chat/dashboard/stream | POST | 运营助手 SSE 流式对话 |
| /api/chat/sessions | GET | 会话列表 |
| /api/chat/tasks | GET/POST | 定时任务查询/创建 |
| /api/chat/tasks/{id} | PUT/DELETE | 定时任务更新/删除 |

### 6.2 数据模型

**ChatSession**：会话 ID、Agent 类型、创建时间、更新时间。

**ChatMessage**：消息 ID、会话 ID、角色（user/assistant）、内容、工具调用记录（JSON）、创建时间。

**ScheduledTask**：任务 ID、描述、cron 表达式、目标 Agent、创建时间。

**NailStyle**：款式 ID、名称、分类、标签、颜色基调、本地图片路径、热度、今日试戴次数。

**HandImage**：手图 ID、文件名、存储路径、上传时间。

### 6.3 错误处理

后端统一返回 FastAPI `HTTPException`，前端在 ChatWidget 中以红色警告气泡展示错误信息。OpenClaw 网关不可达时返回 504，后端自动重试 1 次后降级为提示文案。

---

## 7. 部署与协作

### 7.1 运行环境

| 组件 | 要求 |
|------|------|
| Node.js | 22.19.0 |
| Python | 3.12.13 (Conda 环境: `meituan-hackathon`) |
| OpenClaw CLI | 2026.5.12 |
| MiMo API Key | Token Plan |

所需 Python 包：`fastapi`、`uvicorn`、`sqlalchemy`、`aiosqlite`、`httpx`、`pydantic-settings`、`openai`、`opencv-python`、`mediapipe==0.10.18`。

### 7.2 启动步骤

```bash
# 1. OpenClaw Gateway
set MIMO_API_KEY=your-token-plan-key
set OPENCLAW_CONFIG_PATH=openclaw\openclaw.json
openclaw gateway run --port 18789

# 2. 后端 (Conda)
cd backend
conda activate meituan-hackathon
python -m uvicorn app.main:app --host 0.0.0.0 --port 8190 --reload

# 3. 前端
cd frontend
npm install
npx vite --port 4180
```

### 7.3 团队协作设计

项目级 OpenClaw 配置（`openclaw/openclaw.json`）可提交至版本控制系统：

- Agent workspace 路径指向项目内 `openclaw/agents/` 目录
- 9 个 Skill 文件作为项目文件随代码仓库管理
- Agent 人格定义（`SOUL.md`）与行为指令（`AGENTS.md`）团队共享
- `apiKey` 字段使用占位符 `"YOUR_TOKEN_PLAN_KEY_HERE"`，团队成员克隆后替换即可
- 提供 `.env.example` 作为环境变量参考模板

---

## 8. 总结与展望

### 8.1 项目成果

本作品完成了一个从用户端到运营端的全栈美甲 AI 平台，具备以下核心能力：

1. 基于百炼 Bailian API 与 MediaPipe+OpenCV 三级降级链路的虚拟试戴引擎
2. 基于 OpenClaw Gateway 的双 Agent 对话系统，包含 9 个自定义 Skill
3. 实时运营数据分析看板与 AI 运营助手
4. 基于 oklch 暖调配色体系的前端设计系统，适配 5 个独立页面
5. 项目级 OpenClaw 配置方案，支持团队协作与版本管理

### 8.2 后续方向

- 试戴效果的真实度提升：接入更高分辨率的图像生成模型
- 款式库扩展与用户偏好学习：基于试戴行为构建协同过滤推荐
- Agent Skill 进一步完善：如多轮试戴对比、用户风格画像等
- 移动端适配：响应式布局优化，支持手机拍照即试戴
