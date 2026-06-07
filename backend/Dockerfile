# ============================================================
# NailVista Backend Dockerfile
# 基于 python:3.12-slim，MySQL 异步驱动 + FastAPI
# ============================================================
FROM python:3.12-slim

WORKDIR /app

# 配置国内 Debian 镜像源加速
RUN sed -i 's|http://deb.debian.org|http://mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources

# 安装 MySQL 客户端库（aiomysql 编译依赖）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 复制应用代码和静态资源
COPY . .

# 确保静态资源目录存在
RUN mkdir -p static/styles static/merchants static/posts static/avatars static/hands static/results

# 入口脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8190

ENTRYPOINT ["/docker-entrypoint.sh"]
