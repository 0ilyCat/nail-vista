"""
等待 MySQL 就绪 — 异步连接检测
"""
import asyncio
import os
import sys

import aiomysql


async def wait_for_mysql():
    host = os.environ["DB_HOST"]
    port = int(os.environ["DB_PORT"])
    user = os.environ["DB_USER"]
    password = os.environ["DB_PASSWORD"]

    max_retries = 30
    for i in range(max_retries):
        try:
            conn = await aiomysql.connect(
                host=host, port=port, user=user, password=password
            )
            await conn.ensure_closed()
            print(f"[NailVista] MySQL 已就绪 ({host}:{port})")
            return
        except Exception:
            print(f"  等待 MySQL ({i + 1}/{max_retries})...")
            await asyncio.sleep(2)

    print("[NailVista] MySQL 连接超时，退出")
    sys.exit(1)


if __name__ == "__main__":
    asyncio.run(wait_for_mysql())
