import { test, expect } from '@playwright/test';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve('test-results/ui-screenshots');
const BUG_LOG: string[] = [];

function logBug(description: string) {
  BUG_LOG.push(`[BUG] ${description}`);
  console.log(`\n⚠️  [BUG] ${description}\n`);
}

test.describe.serial('候选人详情页 UI 自动化测试', () => {

  // 先获取一个有效的候选人ID
  let candidateId = 1;

  test.beforeAll(async () => {
    // 通过API获取一个有数据的候选人ID
    try {
      const response = await fetch('http://localhost:8080/api/candidates?page=0&size=1');
      const data = await response.json();
      if (data?.data?.records?.length > 0) {
        candidateId = data.data.records[0].id;
        console.log('使用候选人ID: ' + candidateId);
      }
    } catch (e) {
      console.log('无法获取候选人ID，使用默认值1');
    }
  });

  test('CD-1. 页面加载 - 验证基本信息渲染', async ({ page }) => {
    await page.goto(`/candidate/${candidateId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-01-page-loaded.png'), fullPage: true });

    // 验证页面头部（返回按钮）
    const pageHeader = page.locator('.el-page-header');
    await expect(pageHeader).toBeVisible();

    // 验证候选人姓名
    const nameElement = page.locator('.info-card .name');
    const nameVisible = await nameElement.isVisible().catch(() => false);
    if (nameVisible) {
      const name = await nameElement.textContent();
      console.log('候选人姓名: ' + name);
      expect(name!.length).toBeGreaterThan(0);
    } else {
      logBug('候选人详情页未显示姓名。截图: CD-01-page-loaded.png');
    }

    // 验证状态标签
    const statusTag = page.locator('.info-card .el-tag').first();
    if (await statusTag.isVisible().catch(() => false)) {
      const statusText = await statusTag.textContent();
      console.log('候选人状态: ' + statusText);
    }

    // 验证描述列表
    const descriptions = page.locator('.info-card .el-descriptions');
    await expect(descriptions).toBeVisible();

    // 验证描述项数量
    const descItems = descriptions.locator('.el-descriptions__cell');
    const descCount = await descItems.count();
    console.log('基本信息字段数: ' + descCount);
    expect(descCount).toBeGreaterThanOrEqual(10);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-01-info-verified.png'), fullPage: true });
  });

  test('CD-2. 基本信息字段验证', async ({ page }) => {
    await page.goto(`/candidate/${candidateId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 验证关键信息字段
    const descItems = page.locator('.info-card .el-descriptions__label');
    const labelCount = await descItems.count();

    const labels: string[] = [];
    for (let i = 0; i < labelCount; i++) {
      const label = await descItems.nth(i).textContent();
      labels.push(label?.trim() || '');
    }
    console.log('信息标签列表: ' + labels.join(', '));

    // 验证关键字段存在
    const requiredFields = ['性别', '年龄', '学历', '工作年限'];
    for (const field of requiredFields) {
      if (labels.includes(field)) {
        console.log(`  ✓ ${field} 存在`);
      } else {
        console.log(`  ✗ ${field} 缺失`);
      }
    }

    // 验证技能标签
    const skillTags = page.locator('.info-card .skill-tag');
    const skillCount = await skillTags.count();
    console.log('技能标签数: ' + skillCount);

    if (skillCount > 0) {
      for (let i = 0; i < Math.min(skillCount, 5); i++) {
        const skill = await skillTags.nth(i).textContent();
        console.log(`  技能${i + 1}: ${skill}`);
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-02-fields-verified.png'), fullPage: true });
  });

  test('CD-3. 操作按钮验证', async ({ page }) => {
    await page.goto(`/candidate/${candidateId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const actions = page.locator('.info-card .actions');
    await expect(actions).toBeVisible();

    // AI深度分析按钮
    const analyzeBtn = actions.locator('button:has-text("AI 深度分析")');
    const analyzeVisible = await analyzeBtn.isVisible().catch(() => false);
    console.log('AI深度分析按钮: ' + (analyzeVisible ? '可见' : '不可见'));

    // 编辑按钮
    const editBtn = actions.locator('button:has-text("编辑")');
    const editVisible = await editBtn.isVisible().catch(() => false);
    console.log('编辑按钮: ' + (editVisible ? '可见' : '不可见'));
    expect(editVisible).toBe(true);

    // 标记通过按钮
    const passBtn = actions.locator('button:has-text("标记通过")');
    const passVisible = await passBtn.isVisible().catch(() => false);
    console.log('标记通过按钮: ' + (passVisible ? '可见' : '不可见'));

    // 标记淘汰按钮
    const failBtn = actions.locator('button:has-text("标记淘汰")');
    const failVisible = await failBtn.isVisible().catch(() => false);
    console.log('标记淘汰按钮: ' + (failVisible ? '可见' : '不可见'));

    // 推荐到岗位按钮
    const recommendBtn = actions.locator('button:has-text("推荐到岗位")');
    const recommendVisible = await recommendBtn.isVisible().catch(() => false);
    console.log('推荐到岗位按钮: ' + (recommendVisible ? '可见' : '不可见'));
    expect(recommendVisible).toBe(true);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-03-action-buttons.png'), fullPage: true });
  });

  test('CD-4. AI分析报告区域', async ({ page }) => {
    await page.goto(`/candidate/${candidateId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 检查是否有AI分析报告
    const reportCard = page.locator('.report-card');
    const reportVisible = await reportCard.isVisible().catch(() => false);

    if (reportVisible) {
      console.log('AI分析报告卡片可见');

      // 验证评分
      const scoreBadges = reportCard.locator('.el-col');
      const badgeCount = await scoreBadges.count();
      console.log('评分项数量: ' + badgeCount);

      // 验证分析时间标签
      const timeTag = reportCard.locator('.el-tag:has-text("分析时间")');
      if (await timeTag.isVisible().catch(() => false)) {
        const timeText = await timeTag.textContent();
        console.log('分析时间: ' + timeText?.trim());
      }

      // 验证分析内容
      const analysisItems = reportCard.locator('.el-descriptions__cell');
      const analysisCount = await analysisItems.count();
      console.log('分析项数量: ' + analysisCount);

      // 检查各字段
      const labels = reportCard.locator('.el-descriptions__label');
      const labelCount = await labels.count();
      for (let i = 0; i < labelCount; i++) {
        const text = await labels.nth(i).textContent();
        console.log(`  分析字段: ${text?.trim()}`);
      }
    } else {
      console.log('AI分析报告卡片不可见（候选人可能未分析）');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-04-ai-report.png'), fullPage: true });
  });

  test('CD-5. 岗位匹配度区域', async ({ page }) => {
    await page.goto(`/candidate/${candidateId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const matchCard = page.locator('.match-card');
    const matchVisible = await matchCard.isVisible().catch(() => false);

    if (matchVisible) {
      console.log('岗位匹配度卡片可见');

      const matchItems = matchCard.locator('.match-card-item');
      const itemCount = await matchItems.count();
      console.log('匹配岗位数: ' + itemCount);

      // 验证岗位标签数量
      const countTag = matchCard.locator('.el-tag:has-text("个岗位")');
      if (await countTag.isVisible().catch(() => false)) {
        const countText = await countTag.textContent();
        console.log('岗位标签: ' + countText?.trim());
      }

      // 验证第一项匹配
      if (itemCount > 0) {
        const firstItem = matchItems.first();
        const posTitle = await firstItem.locator('.match-position-title').textContent();
        console.log('第一个匹配岗位: ' + posTitle);
      }
    } else {
      console.log('岗位匹配度卡片不可见（无匹配数据）');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-05-match-results.png'), fullPage: true });
  });

  test('CD-6. 项目及任职经历时间线', async ({ page }) => {
    await page.goto(`/candidate/${candidateId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const projectCard = page.locator('.project-card');
    await expect(projectCard).toBeVisible();

    const headerText = await projectCard.locator('.el-card__header').textContent();
    console.log('项目经历标题: ' + headerText?.trim());
    expect(headerText).toContain('项目及任职经历');

    // 检查时间线或空状态
    const timeline = projectCard.locator('.el-timeline');
    const timelineVisible = await timeline.isVisible().catch(() => false);
    const empty = projectCard.locator('.el-empty');
    const emptyVisible = await empty.isVisible().catch(() => false);

    if (timelineVisible) {
      const items = timeline.locator('.el-timeline-item');
      const itemCount = await items.count();
      console.log('项目经历条数: ' + itemCount);

      if (itemCount > 0) {
        // 验证第一个项目
        const firstItem = items.first();
        const h4 = firstItem.locator('h4');
        if (await h4.isVisible().catch(() => false)) {
          const companyInfo = await h4.textContent();
          console.log('第一个项目: ' + companyInfo);
        }

        // 验证时间戳
        const timestamp = firstItem.locator('.el-timeline-item__timestamp');
        if (await timestamp.isVisible().catch(() => false)) {
          const timeText = await timestamp.textContent();
          console.log('时间范围: ' + timeText);
        }
      }
    } else if (emptyVisible) {
      console.log('暂无项目经历');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-06-projects.png'), fullPage: true });
  });

  test('CD-7. 岗位推荐记录', async ({ page }) => {
    await page.goto(`/candidate/${candidateId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const recommendCard = page.locator('.recommend-card');
    await expect(recommendCard).toBeVisible();

    const headerText = await recommendCard.locator('.el-card__header').textContent();
    console.log('推荐记录标题: ' + headerText?.trim());

    // 检查推荐记录
    const recItems = recommendCard.locator('.rec-item');
    const recCount = await recItems.count();
    const empty = recommendCard.locator('.el-empty');
    const emptyVisible = await empty.isVisible().catch(() => false);

    if (recCount > 0) {
      console.log('推荐记录数: ' + recCount);
      for (let i = 0; i < Math.min(recCount, 3); i++) {
        const item = recItems.nth(i);
        const posTitle = await item.locator('.rec-pos-title').textContent();
        const status = await item.locator('.el-tag').textContent();
        console.log(`  推荐${i + 1}: ${posTitle?.trim()} - ${status?.trim()}`);
      }
    } else if (emptyVisible) {
      const emptyText = await empty.textContent();
      console.log('空状态: ' + emptyText?.trim());
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-07-recommendations.png'), fullPage: true });
  });

  test('CD-8. 面试记录', async ({ page }) => {
    await page.goto(`/candidate/${candidateId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const interviewCard = page.locator('.interview-card');
    await expect(interviewCard).toBeVisible();

    const headerText = await interviewCard.locator('.el-card__header').textContent();
    console.log('面试记录标题: ' + headerText?.trim());

    // 检查"安排面试"按钮
    const scheduleBtn = interviewCard.locator('button:has-text("安排面试")');
    const btnVisible = await scheduleBtn.isVisible().catch(() => false);
    if (btnVisible) {
      const isDisabled = await scheduleBtn.getAttribute('disabled');
      console.log('安排面试按钮: 可见, 禁用: ' + (isDisabled !== null));
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-08-interviews.png'), fullPage: true });
  });

  test('CD-9. 返回按钮功能', async ({ page }) => {
    // 先从列表进入详情
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const firstRow = page.locator('.el-table__body-wrapper .el-table__row').first();
    const nameLink = firstRow.locator('.el-link');
    await nameLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 验证在详情页
    expect(page.url()).toContain('/candidate/');

    // 点击返回按钮
    const backBtn = page.locator('.el-page-header');
    await backBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // 应该回到列表页
    const currentUrl = page.url();
    console.log('返回后URL: ' + currentUrl);
    // router.back() should go back to list
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-09-back-navigation.png'), fullPage: true });
  });

  test('CD-10. 编辑功能 - 打开编辑对话框', async ({ page }) => {
    await page.goto(`/candidate/${candidateId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 点击编辑按钮
    const editBtn = page.locator('.actions button:has-text("编辑")');
    await editBtn.click();
    await page.waitForTimeout(1000);

    // 验证编辑对话框
    const dialog = page.locator('.el-dialog:has-text("编辑候选人")');
    const dialogVisible = await dialog.isVisible().catch(() => false);

    if (dialogVisible) {
      console.log('编辑对话框已打开');

      // 验证姓名输入框有值
      const nameInput = dialog.locator('input[placeholder="请输入姓名"]');
      const nameVal = await nameInput.inputValue();
      console.log('编辑候选人姓名: ' + nameVal);
      expect(nameVal.length).toBeGreaterThan(0);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-10-edit-dialog.png'), fullPage: true });

      // 关闭对话框不保存
      const cancelBtn = dialog.locator('.el-dialog__footer button:has-text("取消")');
      await cancelBtn.click();
      await page.waitForTimeout(500);
    } else {
      logBug('编辑按钮点击后未打开编辑对话框。截图: CD-10-edit-dialog.png');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-10-edit-bug.png'), fullPage: true });
    }
  });

  test('CD-11. 推荐到岗位对话框', async ({ page }) => {
    await page.goto(`/candidate/${candidateId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 点击"推荐到岗位"按钮
    const recommendBtn = page.locator('.actions button:has-text("推荐到岗位")');
    await recommendBtn.click();
    await page.waitForTimeout(1000);

    // 验证对话框
    const dialog = page.locator('.el-dialog:has-text("推荐到岗位")');
    const dialogVisible = await dialog.isVisible().catch(() => false);

    if (dialogVisible) {
      console.log('推荐到岗位对话框已打开');

      // 验证岗位选择器
      const select = dialog.locator('.el-select');
      await expect(select).toBeVisible();

      // 点击选择器查看岗位列表
      await select.click();
      await page.waitForTimeout(500);

      const options = page.locator('.el-select-dropdown__item');
      const optionCount = await options.count();
      console.log('可选岗位数量: ' + optionCount);

      if (optionCount > 0) {
        const firstOption = await options.first().textContent();
        console.log('第一个岗位选项: ' + firstOption);
      }

      // 验证备注输入框
      const remarkInput = dialog.locator('textarea');
      const remarkVisible = await remarkInput.isVisible().catch(() => false);
      console.log('备注输入框: ' + (remarkVisible ? '可见' : '不可见'));

      // 验证确认按钮
      const confirmBtn = dialog.locator('button:has-text("确认推荐")');
      const isDisabled = await confirmBtn.getAttribute('disabled');
      console.log('确认推荐按钮禁用: ' + (isDisabled !== null));

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-11-recommend-dialog.png'), fullPage: true });

      // 先点击空白处关闭下拉框，再点取消
      await page.locator('.el-dialog__header').click();
      await page.waitForTimeout(300);
      const cancelBtn = dialog.locator('.el-dialog__footer button:has-text("取消")');
      await cancelBtn.click();
    } else {
      logBug('推荐到岗位按钮点击后未打开对话框');
    }
  });

  test('CD-12. 状态变更功能', async ({ page }) => {
    await page.goto(`/candidate/${candidateId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 检查当前状态
    const statusTag = page.locator('.info-card .el-tag').first();
    const currentStatus = await statusTag.textContent();
    console.log('当前状态: ' + currentStatus?.trim());

    // 检查标记通过按钮
    const passBtn = page.locator('.actions button:has-text("标记通过")');
    const passVisible = await passBtn.isVisible().catch(() => false);

    if (passVisible) {
      console.log('标记通过按钮可见');
      // 不实际点击，避免改变数据
    }

    // 检查标记淘汰按钮
    const failBtn = page.locator('.actions button:has-text("标记淘汰")');
    const failVisible = await failBtn.isVisible().catch(() => false);
    console.log('标记淘汰按钮: ' + (failVisible ? '可见' : '不可见'));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-12-status-buttons.png'), fullPage: true });
  });

  test('CD-13. 不存在的候选人', async ({ page }) => {
    // 使用一个不存在的ID
    await page.goto('/candidate/999999');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // 应该显示空状态
    const empty = page.locator('.el-empty');
    const emptyVisible = await empty.isVisible().catch(() => false);

    if (emptyVisible) {
      const emptyText = await empty.textContent();
      console.log('不存在候选人的提示: ' + emptyText?.trim());
      expect(emptyText).toContain('候选人不存在');
    } else {
      logBug('访问不存在的候选人时未显示"候选人不存在"空状态。截图: CD-13-not-found.png');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'CD-13-not-found.png'), fullPage: true });
  });
});

test.afterAll(async () => {
  if (BUG_LOG.length > 0) {
    console.log('\n========================================');
    console.log('🐛 候选人详情页发现的 Bug:');
    console.log('========================================');
    BUG_LOG.forEach((bug, i) => console.log(`  ${i + 1}. ${bug}`));
    console.log('========================================\n');
  } else {
    console.log('\n✅ 候选人详情页未发现 Bug\n');
  }
});
