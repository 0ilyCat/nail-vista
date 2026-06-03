---
name: ops-overview
description: 查询运营概览数据（总款式数、今日/累计试戴与浏览）。当用户询问"今日数据"、"运营概况"时使用。
---

# 运营概览查询

## 触发条件
- 用户说"今天数据怎么样"、"看看概览"
- 询问整体运营数据

## 操作流程
1. `curl http://localhost:8190/api/analytics/overview`
2. 解析返回数据: `{ total_styles, today_tryons, today_views, total_tryons, tryon_change_pct }`
3. 用简洁的格式展示，标注变化趋势

## 回复格式
```
📊 今日运营概览
• 款式总数：25 款
• 今日试戴：128 次 (↑12%)
• 今日浏览：456 次
• 累计试戴：3,421 次
```
