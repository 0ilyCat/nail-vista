/**
 * NailVista 完整功能测试
 * 使用 Playwright 测试所有前端页面和后端API
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4180';
const API = 'http://localhost:8190/api';

// ============================================================
// 1. 首页 & 导航
// ============================================================
test.describe('首页 & 导航', () => {
  test('首页加载成功，显示热门款式和商家', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('h1')).toContainText('AI 美甲灵感引擎');
    // 热门款式卡片
    await expect(page.locator('.ant-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('导航菜单可点击跳转', async ({ page }) => {
    await page.goto(BASE);
    await page.click('text=灵感广场');
    await expect(page).toHaveURL(/\/community/);
    await expect(page.locator('h2')).toContainText('灵感广场');

    await page.click('text=店家专区');
    await expect(page).toHaveURL(/\/merchants/);
    await expect(page.locator('h2')).toContainText('店家专区');

    await page.click('text=AI美甲试戴');
    await expect(page).toHaveURL(/\/tryon/);

    await page.click('text=小美对话');
    await expect(page).toHaveURL(/\/chat/);
  });

  test('站内搜索功能', async ({ page }) => {
    await page.goto(BASE);
    const searchInput = page.locator('input[type="search"]').first();
    await searchInput.fill('猫眼');
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=猫眼/);
  });
});

// ============================================================
// 2. 认证系统
// ============================================================
test.describe('认证系统', () => {
  test('登录页面加载', async ({ page }) => {
    await page.goto(BASE + '/login');
    await expect(page.locator('.ant-tabs')).toBeVisible();
  });

  test('用户登录成功', async ({ page }) => {
    await page.goto(BASE + '/login');
    // 在登录tab
    const loginTab = page.locator('.ant-tabs-tab').filter({ hasText: '用户登录' });
    await loginTab.click();

    await page.fill('input[id$="username"]', 'xiaomei');
    await page.fill('input[id$="password"]', '123456');
    await page.click('button[type="submit"]');

    // 应该跳转回首页
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).not.toContain('/login');
  });

  test('商家登录后跳转仪表盘', async ({ page }) => {
    await page.goto(BASE + '/login');
    await page.fill('input[id$="username"]', 'merchant01');
    await page.fill('input[id$="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toContain('/dashboard');
  });

  test('注册新用户', async ({ page }) => {
    await page.goto(BASE + '/login');
    const regTab = page.locator('.ant-tabs-tab').filter({ hasText: '注册' });
    await regTab.click();
    await page.fill('input[id$="username"]', 'testuser_' + Date.now());
    await page.fill('input[id$="nickname"]', '测试用户');
    await page.fill('input[id$="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).not.toContain('/login');
  });
});

// ============================================================
// 3. 灵感广场 (社区)
// ============================================================
test.describe('灵感广场', () => {
  test('帖子列表加载', async ({ page }) => {
    await page.goto(BASE + '/community');
    await expect(page.locator('h2')).toContainText('灵感广场');
    // 等待帖子卡片加载
    await page.waitForSelector('.ant-card', { timeout: 10000 });
    const cards = await page.locator('.ant-card').count();
    expect(cards).toBeGreaterThan(0);
  });

  test('帖子详情页加载', async ({ page }) => {
    await page.goto(BASE + '/community/post/1');
    await page.waitForTimeout(2000);
    // 应显示帖子标题和返回按钮
    await expect(page.locator('h2')).toBeVisible();
  });

  test('发布帖子', async ({ page }) => {
    // 先登录
    await page.goto(BASE + '/login');
    await page.fill('input[id$="username"]', 'xiaomei');
    await page.fill('input[id$="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // 去灵感广场
    await page.goto(BASE + '/community');
    await page.waitForTimeout(2000);

    // 在底部发布栏输入
    const titleInput = page.locator('input[placeholder="标题"]');
    const contentInput = page.locator('input[placeholder="正文内容"]');
    if (await titleInput.isVisible()) {
      await titleInput.fill('测试帖子 ' + new Date().toISOString().slice(0, 19));
      await contentInput.fill('这是测试内容');
      await page.click('button:has-text("发布")');
      await page.waitForTimeout(2000);
    }
  });
});

// ============================================================
// 4. 美甲款式
// ============================================================
test.describe('美甲款式', () => {
  test('款式详情页加载', async ({ page }) => {
    await page.goto(BASE + '/styles/26');
    await page.waitForTimeout(3000);
    // 应显示款式名和价格
    await expect(page.locator('h2')).toBeVisible();
  });

  test('款式标签显示', async ({ page }) => {
    await page.goto(BASE + '/styles/26');
    await page.waitForTimeout(3000);
    // 应有标签
    const tags = page.locator('.ant-tag');
    const count = await tags.count();
    expect(count).toBeGreaterThan(0);
  });

  test('预约按钮可见', async ({ page }) => {
    await page.goto(BASE + '/styles/26');
    await page.waitForTimeout(3000);
    await expect(page.locator('button:has-text("立即预约")')).toBeVisible();
  });
});

// ============================================================
// 5. 商家专区
// ============================================================
test.describe('商家专区', () => {
  test('商家列表加载', async ({ page }) => {
    await page.goto(BASE + '/merchants');
    await page.waitForTimeout(2000);
    await expect(page.locator('h2')).toContainText('店家专区');
    await page.waitForSelector('.ant-card', { timeout: 10000 });
  });

  test('商家详情页加载', async ({ page }) => {
    await page.goto(BASE + '/merchants/1');
    await page.waitForTimeout(3000);
    await expect(page.locator('h2')).toBeVisible();
  });

  test('商家详情有服务项目', async ({ page }) => {
    await page.goto(BASE + '/merchants/4');
    await page.waitForTimeout(3000);
    await expect(page.locator('text=服务项目')).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// 6. AI美甲试戴
// ============================================================
test.describe('AI美甲试戴', () => {
  test('试戴页面加载', async ({ page }) => {
    await page.goto(BASE + '/tryon');
    await page.waitForTimeout(2000);
    await expect(page.locator('h2')).toContainText('AI美甲试戴');
  });

  test('手图列表加载', async ({ page }) => {
    // 先登录
    await page.goto(BASE + '/login');
    await page.fill('input[id$="username"]', 'xiaomei');
    await page.fill('input[id$="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.goto(BASE + '/tryon');
    await page.waitForTimeout(3000);
    await expect(page.locator('text=选择手图')).toBeVisible();
    await expect(page.locator('text=选择美甲款式')).toBeVisible();
  });
});

// ============================================================
// 7. 小美对话
// ============================================================
test.describe('小美对话', () => {
  test('对话页面加载', async ({ page }) => {
    await page.goto(BASE + '/chat');
    await page.waitForTimeout(2000);
    await expect(page.locator('h2')).toContainText('小美对话');
  });
});

// ============================================================
// 8. 收藏功能
// ============================================================
test.describe('收藏功能', () => {
  test('收藏页面加载（需登录）', async ({ page }) => {
    await page.goto(BASE + '/login');
    await page.fill('input[id$="username"]', 'xiaomei');
    await page.fill('input[id$="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.goto(BASE + '/favorites');
    await page.waitForTimeout(2000);
    // 应有标签页
    await expect(page.locator('.ant-tabs')).toBeVisible();
  });
});

// ============================================================
// 9. 商家仪表盘
// ============================================================
test.describe('商家仪表盘', () => {
  test('商家登录后查看仪表盘', async ({ page }) => {
    await page.goto(BASE + '/login');
    await page.fill('input[id$="username"]', 'merchant01');
    await page.fill('input[id$="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const url = page.url();
    expect(url).toContain('/dashboard');

    // 应有统计数据
    await expect(page.locator('.ant-statistic').first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================
// 10. 预约功能
// ============================================================
test.describe('预约功能', () => {
  test('预约列表页面', async ({ page }) => {
    await page.goto(BASE + '/login');
    await page.fill('input[id$="username"]', 'xiaomei');
    await page.fill('input[id$="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.goto(BASE + '/appointments');
    await page.waitForTimeout(2000);
    await expect(page.locator('h2')).toContainText('我的预约');
  });
});

// ============================================================
// 11. API后端接口测试
// ============================================================
test.describe('后端API测试', () => {
  test('GET /api/health', async ({ request }) => {
    const resp = await request.get(API + '/health');
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.status).toBe('ok');
  });

  test('GET /api/styles 返回分页数据', async ({ request }) => {
    const resp = await request.get(API + '/styles?page_size=3');
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
  });

  test('GET /api/styles/{id} 返回款式详情', async ({ request }) => {
    const resp = await request.get(API + '/styles/26');
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('price');
    expect(data).toHaveProperty('merchant');
  });

  test('GET /api/posts 返回帖子列表', async ({ request }) => {
    const resp = await request.get(API + '/posts?page_size=3');
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('total');
  });

  test('GET /api/merchants 返回商家列表', async ({ request }) => {
    const resp = await request.get(API + '/merchants');
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.total).toBe(3);
  });

  test('POST /api/auth/login 用户登录', async ({ request }) => {
    const resp = await request.post(API + '/auth/login', {
      data: { username: 'xiaomei', password: '123456' },
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('access_token');
    expect(data.user.nickname).toBe('小美');
  });

  test('POST /api/auth/register 用户注册', async ({ request }) => {
    const resp = await request.post(API + '/auth/register', {
      data: { username: 'pwtest_' + Date.now(), password: '123456', nickname: 'PW测试' },
    });
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('access_token');
  });

  test('GET /api/styles/hot/ranking 返回热门排行', async ({ request }) => {
    const resp = await request.get(API + '/styles/hot/ranking?limit=5');
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('GET /api/search 搜索功能', async ({ request }) => {
    const resp = await request.get(API + '/search?q=猫眼');
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data).toHaveProperty('styles');
    expect(data).toHaveProperty('posts');
    expect(data).toHaveProperty('merchants');
  });

  test('GET /api/merchants/cities 城市列表', async ({ request }) => {
    const resp = await request.get(API + '/merchants/cities');
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('GET /api/styles/categories 分类列表', async ({ request }) => {
    const resp = await request.get(API + '/styles/categories');
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('认证API - token认证', async ({ request }) => {
    // 先登录获取token
    const loginResp = await request.post(API + '/auth/login', {
      data: { username: 'xiaomei', password: '123456' },
    });
    const token = (await loginResp.json()).access_token;

    // 用token访问需认证的接口
    const meResp = await request.get(API + '/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meResp.status()).toBe(200);
  });

  test('认证API - 无效token返回401', async ({ request }) => {
    const resp = await request.get(API + '/auth/me', {
      headers: { Authorization: 'Bearer invalid_token' },
    });
    expect(resp.status()).toBe(401);
  });
});

// ============================================================
// 12. 404 & 边界情况
// ============================================================
test.describe('边界情况', () => {
  test('款式不存在返回404', async ({ request }) => {
    const resp = await request.get(API + '/styles/99999');
    expect(resp.status()).toBe(404);
  });

  test('商家不存在返回404', async ({ request }) => {
    const resp = await request.get(API + '/merchants/99999');
    expect(resp.status()).toBe(404);
  });

  test('空分页处理', async ({ request }) => {
    const resp = await request.get(API + '/styles?page=99&page_size=10');
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.items.length).toBe(0);
  });
});
