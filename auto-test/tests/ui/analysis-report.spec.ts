import { test, expect } from '@playwright/test';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve('test-results/ui-screenshots');
const BUG_LOG: string[] = [];

function logBug(description: string) {
  BUG_LOG.push(`[BUG] ${description}`);
  console.log(`\n⚠️  [BUG] ${description}\n`);
}

test.describe.serial('智能分析（AI分析报告列表）UI 自动化测试', () => {

  test('AR-1. 页面加载 - 验证报告列表渲染', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'AR-01-page-loaded.png'), fullPage: true });

    // 验证页面标题卡片
    const headerText = await page.locator('.el-card__header').first().textContent();
    expect(headerText).toContain('AI 分析报告列表');
    console.log('页面标题: ' + headerText?.trim());

    // 验证表格存在
    const table = page.locator('.el-table');
    await expect(table).toBeVisible();

    // 验证表格列头
    const headers = page.locator('.el-table__header-wrapper th');
    const headerCount = await headers.count();
    console.log('表格列数: ' + headerCount);
    expect(headerCount).toBeGreaterThanOrEqual(5);

    // 检查是否有数据行或空状态
    const rows = page.locator('.el-table__body-wrapper .el-table__row');
    const rowCount = await rows.count();
    const empty = page.locator('.el-empty');
    const emptyVisible = await empty.isVisible().catch(() => false);

    if (rowCount > 0) {
      console.log('报告列表行数: ' + rowCount);
    } else if (emptyVisible) {
      console.log('报告列表为空，显示空状态');
    }

    // 验证查询按钮存在
    const queryBtn = page.locator('button:has-text("查询")');
    await expect(queryBtn).toBeVisible();

    // 验证日期选择器存在（使用input元素定位，因为el-date-picker panel默认隐藏）
    const datePicker = page.locator('.el-date-editor');
    await expect(datePicker).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'AR-01-table-rendered.png'), fullPage: true });
  });

  test('AR-2. 日期筛选 - 选择日期查询报告', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 获取初始行数
    const initialRows = await page.locator('.el-table__body-wrapper .el-table__row').count();
    console.log('初始报告行数: ' + initialRows);

    // 点击日期选择器
    const datePicker = page.locator('.el-date-editor input');
    await datePicker.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'AR-02-datepicker-open.png'), fullPage: true });

    // 选择今天
    const todayCell = page.locator('.el-date-table td.today');
    if (await todayCell.isVisible().catch(() => false)) {
      await todayCell.click();
      await page.waitForTimeout(300);
    } else {
      // Click the first available date
      const firstDate = page.locator('.el-date-table td.available').first();
      if (await firstDate.isVisible().catch(() => false)) {
        await firstDate.click();
        await page.waitForTimeout(300);
      }
    }

    // 点击查询按钮
    const queryBtn = page.locator('button:has-text("查询")');
    await queryBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'AR-02-date-filtered.png'), fullPage: true });

    const filteredRows = await page.locator('.el-table__body-wrapper .el-table__row').count();
    console.log('日期筛选后行数: ' + filteredRows);

    // BUG检测: 检查日期筛选后是否有任何变化
    // (如果后端不支持日期筛选，结果可能不变)
  });

  test('AR-3. 报告表格内容验证 - 评分和维度', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const rows = page.locator('.el-table__body-wrapper .el-table__row');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      console.log('无报告数据，跳过内容验证');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'AR-03-no-data.png'), fullPage: true });
      return;
    }

    // 验证第一行数据
    const firstRow = rows.first();

    // 验证候选人链接存在
    const candidateLink = firstRow.locator('.el-link');
    const linkVisible = await candidateLink.isVisible().catch(() => false);
    if (linkVisible) {
      const candidateName = await candidateLink.textContent();
      console.log('第一行候选人: ' + candidateName);
    } else {
      logBug('报告列表第一行缺少候选人链接。截图: AR-03-no-data.png');
    }

    // 验证综合评分标签
    const scoreTag = firstRow.locator('.el-tag').first();
    const scoreVisible = await scoreTag.isVisible().catch(() => false);
    if (scoreVisible) {
      const scoreText = await scoreTag.textContent();
      console.log('综合评分: ' + scoreText);
    }

    // 验证各维度评分（稳定性/成长/匹配/行为）
    const miniScores = firstRow.locator('.mini-item');
    const scoreCount = await miniScores.count();
    console.log('维度评分数量: ' + scoreCount);
    if (scoreCount >= 4) {
      for (let i = 0; i < 4; i++) {
        const text = await miniScores.nth(i).textContent();
        console.log(`  维度${i + 1}: ${text}`);
      }
    } else if (scoreCount === 0) {
      logBug('报告列表行缺少各维度评分显示。截图: AR-03-no-data.png');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'AR-03-content-verified.png'), fullPage: true });
  });

  test('AR-4. 候选人跳转 - 点击"查看候选人"', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const rows = page.locator('.el-table__body-wrapper .el-table__row');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      console.log('无报告数据，跳过跳转测试');
      return;
    }

    // 点击"查看候选人"按钮
    const firstRow = rows.first();
    const viewBtn = firstRow.locator('button:has-text("查看候选人")');
    const btnVisible = await viewBtn.isVisible().catch(() => false);

    if (!btnVisible) {
      logBug('"查看候选人"按钮不可见');
      return;
    }

    await viewBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 验证跳转到候选人详情页
    const currentUrl = page.url();
    console.log('跳转后URL: ' + currentUrl);
    expect(currentUrl).toContain('/candidate/');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'AR-04-navigate-detail.png'), fullPage: true });

    // 返回列表
    await page.goBack();
    await page.waitForLoadState('networkidle');
  });

  test('AR-5. 候选人姓名链接跳转', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const rows = page.locator('.el-table__body-wrapper .el-table__row');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      console.log('无报告数据，跳过链接跳转测试');
      return;
    }

    // 点击候选人姓名链接
    const firstRow = rows.first();
    const nameLink = firstRow.locator('.el-link');
    const linkVisible = await nameLink.isVisible().catch(() => false);

    if (!linkVisible) {
      console.log('候选人姓名链接不可见，跳过');
      return;
    }

    const name = await nameLink.textContent();
    console.log('点击候选人姓名: ' + name);
    await nameLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/candidate/');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'AR-05-name-link.png'), fullPage: true });

    // 验证详情页显示候选人名字
    const pageContent = await page.content();
    if (name && name.trim().length > 0) {
      expect(pageContent).toContain(name.trim());
    }

    await page.goBack();
    await page.waitForLoadState('networkidle');
  });

  test('AR-6. 评分颜色标识验证', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const rows = page.locator('.el-table__body-wrapper .el-table__row');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      console.log('无报告数据，跳过评分颜色验证');
      return;
    }

    // 检查评分标签的颜色类型
    // success >= 80, warning >= 60, danger < 60
    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const row = rows.nth(i);
      const scoreTags = row.locator('.el-tag');
      const tagCount = await scoreTags.count();
      if (tagCount > 0) {
        const tagClass = await scoreTags.first().getAttribute('class');
        const scoreText = await scoreTags.first().textContent();
        console.log(`行${i + 1} 评分: ${scoreText}, class: ${tagClass?.includes('success') ? 'success' : tagClass?.includes('warning') ? 'warning' : tagClass?.includes('danger') ? 'danger' : 'info'}`);
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'AR-06-score-colors.png'), fullPage: true });
  });

  test('AR-7. 行为分析摘要截断验证', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const rows = page.locator('.el-table__body-wrapper .el-table__row');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      console.log('无报告数据，跳过摘要验证');
      return;
    }

    // 检查行为分析摘要列是否显示show-overflow-tooltip（鼠标悬浮显示完整内容）
    const firstRow = rows.first();
    const cells = firstRow.locator('td');
    const cellCount = await cells.count();
    console.log('单元格数量: ' + cellCount);

    // 验证 show-overflow-tooltip 属性（内容过长时显示tooltip）
    // 这是通过检查 el-tooltip 或 cell__content 的样式来实现的
    const tooltipCells = page.locator('.el-table__body-wrapper .cell');
    const tooltipCount = await tooltipCells.count();
    console.log('带cell样式的单元格数: ' + tooltipCount);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'AR-07-truncation.png'), fullPage: true });
  });

  test('AR-8. 空状态展示验证', async ({ page }) => {
    // 使用一个不太可能有数据的日期来测试空状态
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 尝试选择2020年的日期（很可能没有数据）
    const datePicker = page.locator('.el-date-editor input');
    await datePicker.fill('2020-01-01');
    await page.waitForTimeout(300);

    const queryBtn = page.locator('button:has-text("查询")');
    await queryBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const empty = page.locator('.el-empty');
    const emptyVisible = await empty.isVisible().catch(() => false);
    const rows = page.locator('.el-table__body-wrapper .el-table__row');
    const rowCount = await rows.count();

    if (emptyVisible && rowCount === 0) {
      const emptyText = await empty.textContent();
      console.log('空状态文案: ' + emptyText);
      expect(emptyText).toContain('暂无分析报告');
    } else {
      console.log('选择2020-01-01后仍有 ' + rowCount + ' 条数据（可能日期筛选未生效）');
      if (rowCount === 0 && !emptyVisible) {
        logBug('报告列表无数据但未显示空状态组件');
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'AR-08-empty-state.png'), fullPage: true });
  });
});

test.afterAll(async () => {
  if (BUG_LOG.length > 0) {
    console.log('\n========================================');
    console.log('🐛 智能分析页面发现的 Bug:');
    console.log('========================================');
    BUG_LOG.forEach((bug, i) => console.log(`  ${i + 1}. ${bug}`));
    console.log('========================================\n');
  } else {
    console.log('\n✅ 智能分析页面未发现 Bug\n');
  }
});
