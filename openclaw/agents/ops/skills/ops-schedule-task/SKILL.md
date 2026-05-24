---
name: ops-schedule-task
description: 配置定时任务（每日报告自动生成等）。当用户要求"每天自动生成报告"、"设置定时任务"时使用。
---

# 定时任务配置

## 触发条件
- 用户说"每天 9 点自动生成日报"、"每周一生成周报"
- 用户需要自动化报告或数据推送

## 操作流程
1. 确认任务详情：类型、频率、时间
2. 调用后端 API 创建任务:
   ```
   POST http://localhost:8190/api/chat/tasks
   Body: { "name": "每日运营日报", "type": "daily_report", "cron": "0 9 * * *" }
   ```
3. 查看已有任务: `GET http://localhost:8190/api/chat/tasks`
4. 删除任务: `DELETE http://localhost:8190/api/chat/tasks/{id}`

## 支持的定时任务
- `daily_report`: 每日运营日报
- `trend_analysis`: 趋势分析
- `hot_ranking`: 热门排行快报

## 回复格式
- 确认已创建的定时任务详情
- 提醒用户可以随时查看或删除
```
