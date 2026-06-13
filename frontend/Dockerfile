# ============================================================
# NailVista Frontend Dockerfile — 多阶段构建
# Stage 1: Node 构建 React SPA
# Stage 2: Nginx 运行
# ============================================================

# ── Stage 1: 构建 ──
FROM node:22-alpine AS builder

WORKDIR /app

# 安装依赖（利用 Docker 层缓存）
COPY package*.json ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npm run build

# ── Stage 2: 运行 ──
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
