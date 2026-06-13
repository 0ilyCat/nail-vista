/**
 * 图片URL工具 — 通过后端 /api/getImg 接口返回图片二进制流
 *
 * 正确用法: <img src="/api/getImg?name=styles/xxx.png">
 * 错误用法: <img src="/usr/upload/a.jpg">（浏览器不能直接访问服务器磁盘）
 */
export function imgUrl(path: string | undefined | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/api/getImg')) return path;  // 后端已转换过，直接返回
  // 本地路径: styles/style_01.png → /api/getImg?name=styles/style_01.png
  return `/api/getImg?name=${encodeURIComponent(path)}`;
}
