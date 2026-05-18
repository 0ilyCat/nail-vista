# 美甲AI试戴与智能运营 — 项目规划

## 一、项目概述

**赛题**：美团黑马大赛 命题三 — 美甲评测数据

**目标**：构建「AI试戴」+「智能运营」双引擎系统，让用户快速看到美甲试戴效果，让运营实时感知市场趋势。

**核心约束**：
- 美甲生图可用 Mock 数据，不需要实时调用图生模型
- OpenClaw + MiMo Token Plan 作为 AI 引擎
- 基于提供的 25 款美甲 + 13 张手图脱敏数据进行开发

---

## 二、数据资产分析

### 2.1 已有数据

| 数据表 | 记录数 | 关键字段 |
|--------|--------|---------|
| 手图 | 13 条 | 手图URL、款式图URL（配对） |
| 款式图 | 25 条 | 序号、原始款式图URL、增强后款式图URL |

- 13 张真实手部照片，每张对应一款美甲试戴效果
- 25 款美甲款式（含原图 + AI增强图），作为款式库
- 数据可作为 Mock 训练/测试基准

### 2.2 需构造的数据

- 用户行为数据（浏览、试戴、收藏、分享）
- 款式标签体系（风格、颜色、季节、场合等）
- 时间序列运营指标（日/周/月维度）

---

## 三、技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite)             │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │ AI试戴页  │  │ 款式浏览页  │  │ 运营看板 (Dashboard) │ │
│  │ 上传手图  │  │ 分类/搜索   │  │ 热度排行/趋势/策略    │ │
│  │ 试戴预览  │  │ 详情/收藏   │  │ OpenClaw 对话面板     │ │
│  └──────────┘  └────────────┘  └──────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                 Backend (FastAPI + Python 3.12)           │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ 试戴引擎  │  │ 运营分析引擎  │  │ OpenClaw 集成层   │  │
│  │          │  │              │  │                   │  │
│  │ MediaPipe│  │ 热度计算     │  │ MiMo Token Plan   │  │
│  │ OpenCV   │  │ 趋势识别     │  │ openclaw-sdk      │  │
│  │ PIL      │  │ 策略生成     │  │ (Python client)   │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │              PostgreSQL 数据库                     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 四、模块详细设计

### 4.1 AI试戴模块 (Mock Pipeline)

参考项目：[JineshRathod/AI-Virtual-Nail-Try-On](https://github.com/JineshRathod/AI-Virtual-Nail-Try-On)

**流程**：
```
用户上传手图 → MediaPipe手部关键点检测(21点) → 指甲区域定位
→ 从款式库选款 → 透视变换对齐 → 颜色/纹理叠加
→ 边缘羽化/渐变 → 输出合成图
```

**Mock 策略**：
- 不调用真实 AI 图生模型（如 Stable Diffusion）
- 使用 OpenCV + PIL 做传统图像处理
- 指甲区域用简单色彩分割/手动标注锚点
- 款式图做透视变换贴合到指甲区域
- 加阴影、光泽效果模拟真实感

**技术栈**：
- MediaPipe Hands (21点手部关键点)
- OpenCV (图像处理、透视变换)
- PIL/Pillow (图像合成)

### 4.2 智能运营模块

#### 4.2.1 数据埋点与采集
- 用户行为：浏览、试戴、收藏、停留时长
- 款式维度：PV、UV、试戴次数、转化率
- 时间维度：小时/天/周聚合

#### 4.2.2 热度排行
- 实时热度分 = w1*试戴量 + w2*收藏量 + w3*浏览时长 + w4*分享量
- 支持按风格/颜色/季节维度筛选
- TOP10 榜单 & 上升最快榜

#### 4.2.3 OpenClaw AI 运营助手

基于 MiMo Token Plan API (`https://token-plan-cn.xiaomimimo.com/v1`)

**能力清单**：
1. **日报生成**：每日自动总结关键指标变化
2. **趋势分析**：识别上升趋势款式，预测热门方向
3. **策略推荐**：基于数据给出运营建议（推什么款、做什么活动）
4. **异常检测**：识别异常流量/转化波动并告警
5. **自然语言查询**：运营人员用自然语言问"最近什么款式最火？"

**集成方式**：
```python
# 方式一：直接用 OpenAI SDK 调用 MiMo API
from openai import OpenAI
client = OpenAI(
    base_url="https://token-plan-cn.xiaomimimo.com/v1",
    api_key=os.environ["MIMO_API_KEY"]
)

# 方式二：OpenClaw SDK（需要安装 OpenClaw Gateway）
npm install -g openclaw@latest
openclaw onboard  # 配置 Xiaomi MiMo provider
pip install openclaw-sdk
```

---

## 五、数据库设计

### 5.1 核心表

```sql
-- 款式表
nail_styles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200),
    original_url TEXT,
    enhanced_url TEXT,
    category VARCHAR(50),       -- 风格分类
    color_tone VARCHAR(50),     -- 色调
    tags JSONB,                 -- 标签 ['法式','渐变','纯色']
    created_at TIMESTAMP
)

-- 手图表
hand_images (
    id SERIAL PRIMARY KEY,
    image_url TEXT,
    skin_tone VARCHAR(20),      -- 肤色
    hand_type VARCHAR(20),      -- 手型
    landmarks JSONB,            -- MediaPipe 21点坐标
    created_at TIMESTAMP
)

-- 试戴记录
tryon_records (
    id SERIAL PRIMARY KEY,
    hand_image_id INT,
    nail_style_id INT,
    result_url TEXT,
    duration_ms INT,            -- 处理耗时
    created_at TIMESTAMP
)

-- 款式指标（小时级）
style_metrics (
    id SERIAL PRIMARY KEY,
    style_id INT,
    hour TIMESTAMP,
    views INT DEFAULT 0,
    tryons INT DEFAULT 0,
    favorites INT DEFAULT 0,
    avg_duration INT DEFAULT 0,  -- 平均浏览时长(秒)
    hot_score FLOAT DEFAULT 0    -- 热度分
)

-- 运营报告
operations_reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(50),    -- daily/weekly/alert
    content TEXT,               -- AI生成内容
    metrics JSONB,              -- 关联指标快照
    created_at TIMESTAMP
)

-- 用户反馈
user_feedback (
    id SERIAL PRIMARY KEY,
    tryon_id INT,
    rating INT,                 -- 1-5分
    comment TEXT,
    created_at TIMESTAMP
)
```

---

## 六、项目目录结构

```
meituan-hackathon/
├── frontend/                    # React 19 + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── TryOn/          # AI试戴组件
│   │   │   │   ├── ImageUploader.tsx
│   │   │   │   ├── TryOnCanvas.tsx
│   │   │   │   └── StyleSelector.tsx
│   │   │   ├── Dashboard/      # 运营看板
│   │   │   │   ├── HotRanking.tsx
│   │   │   │   ├── TrendChart.tsx
│   │   │   │   └── AIAssistant.tsx
│   │   │   ├── StyleBrowse/    # 款式浏览
│   │   │   │   ├── StyleGrid.tsx
│   │   │   │   └── StyleDetail.tsx
│   │   │   └── common/
│   │   ├── pages/
│   │   ├── services/           # API调用
│   │   ├── hooks/
│   │   └── types/
│   ├── package.json
│   └── vite.config.ts
├── backend/                     # FastAPI
│   ├── app/
│   │   ├── api/
│   │   │   ├── tryon.py
│   │   │   ├── styles.py
│   │   │   ├── analytics.py
│   │   │   └── operations.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── style.py
│   │   │   ├── tryon.py
│   │   │   └── metrics.py
│   │   ├── services/
│   │   │   ├── tryon_engine.py      # MediaPipe + OpenCV 试戴引擎
│   │   │   ├── trend_analyzer.py    # 热度/趋势计算
│   │   │   └── openclaw_service.py  # OpenClaw/MiMo AI 服务
│   │   └── main.py
│   ├── requirements.txt
│   └── alembic/
├── data/                        # 数据文件
│   └── 命题三美甲评测数据（对外版）.xlsx
├── docker-compose.yml
├── PLAN.md
└── README.md
```

---

## 七、开发阶段规划

### Phase 1: 环境搭建 & 项目初始化 ✅
- [x] Conda 环境创建 (meituan-hackathon, Python 3.12)
- [x] Node.js 环境确认 → 升级到 v22.19.0
- [x] 前端项目初始化 (React 19 + Vite + TypeScript)
- [x] 后端项目初始化 (FastAPI + SQLite/PostgreSQL)
- [x] OpenClaw 安装 & MiMo 配置
- [x] Docker Compose 配置

### Phase 2: 数据层 & 基础API ✅
- [x] 数据解析入库 (Excel → DB)
- [x] 款式标签体系构建 (8大类 + 色调)
- [x] 数据库 Migration (SQLAlchemy auto-create)
- [x] 完整 CRUD API (4组端点)

### Phase 3: AI试戴模块 ✅
- [x] MediaPipe 手部关键点检测集成
- [x] 指甲区域定位算法 (5指区域估算)
- [x] 款式图透视变换 & 叠加 (椭圆遮罩 + 羽化)
- [x] 前端试戴交互流程 (上传→选款→结果)
- [x] Mock 数据流水线跑通

### Phase 4: 智能运营模块 ✅
- [x] 埋点数据采集 (试戴/浏览/收藏自动记录)
- [x] 热度计算引擎 (加权评分算法)
- [x] 运营看板 Dashboard (实时数据 + 趋势图 + 排行)
- [x] OpenClaw 集成 (日报/趋势/策略 MiMo生成)
- [x] AI 对话面板 (嵌入Dashboard)

### Phase 5: 联调 & 展示 ✅
- [x] 全流程联调 (前端4180↔后端8190 proxy通过)
- [x] UI/UX 打磨 (首页/步骤指示器/骨架加载/动画)
- [x] Demo 演示准备 (演示流程 + 推荐话术)
- [x] 部署文档 (README.md + Docker指南)

---

## 八、关键技术选型 & 参考

| 类别 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 19 + Vite + TypeScript | 与 swapchat-web 一致 |
| UI 库 | Ant Design / Shadcn/ui | 快速搭建 |
| 图表 | ECharts / Recharts | 运营看板 |
| 后端框架 | FastAPI (Python 3.12) | 高性能异步 |
| 数据库 | PostgreSQL | 与 swapchat-web 一致 |
| ORM | SQLAlchemy 2.0 + asyncpg | 异步支持 |
| 手部检测 | MediaPipe Hands | Google 开源，21点手部关键点 |
| 图像处理 | OpenCV + Pillow | 透视变换、合成 |
| AI 引擎 | OpenClaw + MiMo Token Plan | 运营智能分析 |
| 容器化 | Docker Compose | 一键部署 |

### 参考项目
1. [AI-Virtual-Nail-Try-On](https://github.com/JineshRathod/AI-Virtual-Nail-Try-On) — YOLOv8 + MediaPipe 美甲试戴
2. [IDM-VTON](https://github.com/yisol/IDM-VTON) (3.5k⭐) — 扩散模型虚拟试衣架构参考
3. [OOTDiffusion](https://github.com/levihsu/OOTDiffusion) (6k⭐) — 服装虚拟试穿
4. [nail-segmentation](https://huggingface.co/nngeek195/nail-segmentation-v1) — U-Net 美甲分割模型 (HuggingFace)
5. [OpenClaw](https://docs.openclaw.ai) — AI Agent 框架，支持多模型接入
