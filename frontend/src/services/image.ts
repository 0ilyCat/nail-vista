/**
 * 图片URL工具 — OSS 模式下直接返回完整URL，本地开发模式通过 Vite 代理到后端
 */
const OSS_BASE = 'https://tlias325.oss-cn-beijing.aliyuncs.com';

export function imgUrl(path: string | undefined | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  // OSS key: styles/style_01.png -> https://bucket.oss-cn-beijing.aliyuncs.com/styles/style_01.png
  return `${OSS_BASE}/${path}`;
}
