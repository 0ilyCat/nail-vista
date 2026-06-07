#!/bin/bash
# ============================================================
# NailVista Backend 容器入口脚本
# 1. 等待 MySQL 就绪
# 2. 创建数据库表
# 3. 导入种子数据（幂等）
# 4. 启动 FastAPI 服务
# ============================================================
set -e

echo "========================================="
echo "  NailVista Backend 容器启动"
echo "========================================="
echo "DB_HOST: $DB_HOST"
echo "DB_PORT: $DB_PORT"
echo "DB_NAME: $DB_NAME"

# 1. 等待 MySQL 就绪
echo ""
echo "[步骤 1/4] 等待 MySQL 就绪..."
python wait_for_db.py

# 2. 初始化数据库表
echo ""
echo "[步骤 2/4] 初始化数据库表..."
python -c "
import asyncio
from app.core.database import init_db
asyncio.run(init_db())
print('数据库表初始化完成')
"

# 3. 导入种子数据（幂等，已存在则跳过）
echo ""
echo "[步骤 3/4] 导入种子数据..."
python import_data.py
python import_appointments.py

# 4. 启动 FastAPI
echo ""
echo "[步骤 4/4] 启动 FastAPI (端口 8190)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8190
