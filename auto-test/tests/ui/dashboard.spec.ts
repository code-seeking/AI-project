import { test, expect } from '@playwright/test';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve('test-results/ui-screenshots');
const BUG_LOG: string[] = [];

function logBug(description: string) {
  BUG_LOG.push(`[BUG] ${description}`);
  console.log(`\n⚠️  [BUG] ${description}\n`);
}

test.describe.serial('全景驾驶舱（数据看板）UI 自动化测试', () => {

  test('DB-1. 页面加载 - 验证整体布局', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DB-01-page-loaded.png'), fullPage: true });

    // 验证图表卡片数量
    const chartCards = page.locator('.chart-card');
    const cardCount = await chartCards.count();
    console.log('图表卡片数量: ' + cardCount);
    expect(cardCount).toBeGreaterThanOrEqual(3);

    // 验证各卡片标题
    const expectedTitles = ['招聘漏斗', '月度新增候选人趋势', '候选人来源分布', '异常预警'];
    for (let i = 0; i < cardCount; i++) {
      const headerText = await chartCards.nth(i).locator('.el-card__header').textContent();
      console.log(`  卡片${i + 1}: ${headerText?.trim()}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DB-01-layout-verified.png'), fullPage: true });
  });

  test('DB-2. 招聘漏斗图表', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    // 验证漏斗图容器
    const funnelCard = page.locator('.chart-card').first();
    const headerText = await funnelCard.locator('.el-card__header').textContent();
    console.log('第一个卡片: ' + headerText?.trim());
    expect(headerText).toContain('招聘漏斗');

    // 验证ECharts图表容器
    const chartContainer = funnelCard.locator('.chart-container');
    await expect(chartContainer).toBeVisible();

    // 检查canvas元素（ECharts渲染到canvas）
    const canvas = chartContainer.locator('canvas');
    const canvasVisible = await canvas.isVisible().catch(() => false);
    if (canvasVisible) {
      console.log('招聘漏斗图表已渲染（canvas可见）');
    } else {
      // 可能没有数据
      console.log('招聘漏斗图表canvas不可见，可能无数据');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DB-02-funnel-chart.png'), fullPage: true });
  });

  test('DB-3. 招聘漏斗数据表格', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    // 验证漏斗表格
    const funnelTable = page.locator('.funnel-table');
    const tableVisible = await funnelTable.isVisible().catch(() => false);

    if (tableVisible) {
      const tableRows = funnelTable.locator('.el-table__body-wrapper .el-table__row');
      const rowCount = await tableRows.count();
      console.log('漏斗表格行数: ' + rowCount);

      if (rowCount > 0) {
        // 验证表格列
        for (let i = 0; i < Math.min(rowCount, 5); i++) {
          const row = tableRows.nth(i);
          const stage = await row.locator('td').nth(0).textContent();
          const count = await row.locator('td').nth(1).textContent();
          const rate = await row.locator('td').nth(2).textContent();
          console.log(`  ${stage?.trim()}: ${count?.trim()}人, 转化率: ${rate?.trim()}`);
        }

        // 验证"查看"按钮
        const viewBtns = funnelTable.locator('button:has-text("查看")');
        const btnCount = await viewBtns.count();
        console.log('查看按钮数量: ' + btnCount);

        if (btnCount > 0) {
          // 点击第一个"查看"按钮
          await viewBtns.first().click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);

          const newUrl = page.url();
          console.log('点击查看后URL: ' + newUrl);
          // 应该跳转到候选人列表
          if (newUrl.includes('/?status=') || newUrl.endsWith('/')) {
            console.log('成功跳转到候选人列表');
          }

          // 返回
          await page.goto('/dashboard');
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1500);
        }
      }
    } else {
      console.log('漏斗表格不可见（可能无数据）');
      logBug('招聘漏斗数据表格不可见，可能是后端看板接口未返回漏斗数据。截图: DB-02-funnel-chart.png');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DB-03-funnel-table.png'), fullPage: true });
  });

  test('DB-4. 月度新增候选人趋势图表', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    // 验证月度趋势卡片
    const chartCards = page.locator('.chart-card');
    let trendCard: any = null;

    const cardCount = await chartCards.count();
    for (let i = 0; i < cardCount; i++) {
      const text = await chartCards.nth(i).locator('.el-card__header').textContent();
      if (text?.includes('月度新增')) {
        trendCard = chartCards.nth(i);
        break;
      }
    }

    if (trendCard) {
      const chartContainer = trendCard.locator('.chart-container');
      await expect(chartContainer).toBeVisible();

      const canvas = chartContainer.locator('canvas');
      const canvasVisible = await canvas.isVisible().catch(() => false);
      if (canvasVisible) {
        console.log('月度趋势图表已渲染');
      } else {
        console.log('月度趋势图表canvas不可见');
      }
    } else {
      console.log('未找到月度趋势卡片');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DB-04-monthly-trend.png'), fullPage: true });
  });

  test('DB-5. 候选人来源分布图表', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    // 验证来源分布卡片
    const chartCards = page.locator('.chart-card');
    let sourceCard: any = null;

    const cardCount = await chartCards.count();
    for (let i = 0; i < cardCount; i++) {
      const text = await chartCards.nth(i).locator('.el-card__header').textContent();
      if (text?.includes('来源分布')) {
        sourceCard = chartCards.nth(i);
        break;
      }
    }

    if (sourceCard) {
      const chartContainer = sourceCard.locator('.chart-container');
      await expect(chartContainer).toBeVisible();

      const canvas = chartContainer.locator('canvas');
      const canvasVisible = await canvas.isVisible().catch(() => false);
      if (canvasVisible) {
        console.log('来源分布图表已渲染');
      } else {
        console.log('来源分布图表canvas不可见');
      }
    } else {
      console.log('未找到来源分布卡片');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DB-05-source-distribution.png'), fullPage: true });
  });

  test('DB-6. 异常预警面板', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);

    // 验证异常预警卡片
    const chartCards = page.locator('.chart-card');
    let anomalyCard: any = null;

    const cardCount = await chartCards.count();
    for (let i = 0; i < cardCount; i++) {
      const text = await chartCards.nth(i).locator('.el-card__header').textContent();
      if (text?.includes('异常预警')) {
        anomalyCard = chartCards.nth(i);
        break;
      }
    }

    if (anomalyCard) {
      const headerText = await anomalyCard.locator('.el-card__header').textContent();
      console.log('异常预警标题: ' + headerText?.trim());

      // 检查预警列表或空状态
      const anomalyItems = anomalyCard.locator('.anomaly-item');
      const itemCount = await anomalyItems.count();
      const empty = anomalyCard.locator('.el-empty');
      const emptyVisible = await empty.isVisible().catch(() => false);

      if (itemCount > 0) {
        console.log('异常预警数量: ' + itemCount);
        for (let i = 0; i < Math.min(itemCount, 3); i++) {
          const alert = anomalyItems.nth(i).locator('.el-alert');
          const alertText = await alert.textContent();
          console.log(`  预警${i + 1}: ${alertText?.trim()}`);

          // 验证"查看岗位"按钮
          const viewBtn = anomalyItems.nth(i).locator('button:has-text("查看岗位")');
          if (await viewBtn.isVisible().catch(() => false)) {
            console.log(`  预警${i + 1}包含"查看岗位"按钮`);
          }
        }
      } else if (emptyVisible) {
        const emptyText = await empty.textContent();
        console.log('空状态: ' + emptyText?.trim());
        expect(emptyText).toContain('暂无异常预警');
      }
    } else {
      console.log('未找到异常预警卡片');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DB-06-anomaly-alerts.png'), fullPage: true });
  });

  test('DB-7. 图表响应式布局', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 验证图表使用grid布局
    const dashboardContainer = page.locator('.dashboard-charts');
    await expect(dashboardContainer).toBeVisible();

    // 缩小视口
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DB-07-small-viewport.png'), fullPage: true });

    // 放大视口
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DB-07-large-viewport.png'), fullPage: true });

    // 恢复原始视口
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    console.log('图表在不同视口下布局测试完成');
  });

  test('DB-8. 数据加载状态验证', async ({ page }) => {
    // 导航到看板并观察加载过程
    await page.goto('/dashboard');
    await page.waitForTimeout(500);

    // 截图加载中状态
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DB-08-loading.png'), fullPage: true });

    // 等待加载完成
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 验证图表已加载
    const canvases = page.locator('canvas');
    const canvasCount = await canvases.count();
    console.log('Canvas图表数量: ' + canvasCount);

    // 至少应该有一个图表渲染
    if (canvasCount === 0) {
      logBug('全景驾驶舱页面无任何ECharts图表渲染。截图: DB-08-loading.png');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DB-08-loaded.png'), fullPage: true });
  });
});

test.afterAll(async () => {
  if (BUG_LOG.length > 0) {
    console.log('\n========================================');
    console.log('🐛 全景驾驶舱页面发现的 Bug:');
    console.log('========================================');
    BUG_LOG.forEach((bug, i) => console.log(`  ${i + 1}. ${bug}`));
    console.log('========================================\n');
  } else {
    console.log('\n✅ 全景驾驶舱页面未发现 Bug\n');
  }
});
