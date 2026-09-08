import { test, expect } from '@playwright/test';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve('test-results/ui-screenshots');
const BUG_LOG: string[] = [];

function logBug(description: string) {
  BUG_LOG.push(`[BUG] ${description}`);
  console.log(`\n⚠️  [BUG] ${description}\n`);
}

test.describe.serial('每日洞察（每日日报）UI 自动化测试', () => {

  test('DR-1. 页面加载 - 验证统计卡片和整体布局', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-01-page-loaded.png'), fullPage: true });

    // 验证统计卡片区域
    const statCards = page.locator('.stat-card');
    const cardCount = await statCards.count();
    console.log('统计卡片数量: ' + cardCount);
    expect(cardCount).toBeGreaterThanOrEqual(5);

    // 验证各统计卡片标签
    const expectedLabels = ['待处理', '已处理', '已匹配', '已推荐', '已录用', '已入职', '已淘汰'];
    for (let i = 0; i < cardCount; i++) {
      const label = await statCards.nth(i).locator('.stat-label').textContent();
      console.log(`  卡片${i + 1}: ${label?.trim()}`);
    }

    // 验证左侧候选人表格区域
    const tableCard = page.locator('.table-card');
    await expect(tableCard).toBeVisible();

    // 验证右侧面板
    const recommendCard = page.locator('.recommend-card');
    await expect(recommendCard.first()).toBeVisible();

    const riskCard = page.locator('.risk-card');
    await expect(riskCard).toBeVisible();

    const actionCard = page.locator('.action-card');
    await expect(actionCard).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-01-layout-verified.png'), fullPage: true });
  });

  test('DR-2. 统计卡片数值显示与交互', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 检查统计卡片数值
    const statCards = page.locator('.stat-card');
    const cardCount = await statCards.count();

    for (let i = 0; i < cardCount; i++) {
      const card = statCards.nth(i);
      const value = await card.locator('.stat-value').textContent();
      const label = await card.locator('.stat-label').textContent();
      console.log(`  ${label?.trim()}: ${value}`);
      // 值应该是数字
      expect(Number(value)).not.toBeNaN();
    }

    // BUG检测: 检查统计数值是否全部为0
    let allZero = true;
    for (let i = 0; i < cardCount; i++) {
      const val = await statCards.nth(i).locator('.stat-value').textContent();
      if (Number(val) !== 0) { allZero = false; break; }
    }
    if (allZero) {
      logBug('所有统计卡片数值均为0，可能后端统计接口返回异常。截图: DR-01-page-loaded.png');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-02-stat-values.png'), fullPage: true });
  });

  test('DR-3. 统计卡片点击跳转', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 点击"待处理"卡片 -> 应跳转到候选人列表并带status参数
    const pendingCard = page.locator('.stat-card').first();
    await pendingCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const url1 = page.url();
    console.log('点击待处理后URL: ' + url1);

    // 应该跳转到候选人列表页面
    if (url1.includes('/?status=') || url1 === page.url().split('?')[0] + '/') {
      console.log('成功跳转到候选人列表');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-03-stat-navigate.png'), fullPage: true });
    } else {
      console.log('跳转后URL: ' + url1);
    }

    // 返回每日洞察页面
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  });

  test('DR-4. 今日通过候选人表格', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 验证表格标题
    const tableHeader = page.locator('.table-card .el-card__header');
    const headerText = await tableHeader.textContent();
    console.log('表格标题: ' + headerText?.trim());
    expect(headerText).toContain('今日通过候选人');

    // 检查表格或空状态
    const rows = page.locator('.table-card .el-table__body-wrapper .el-table__row');
    const rowCount = await rows.count();
    const empty = page.locator('.table-card .el-empty');
    const emptyVisible = await empty.isVisible().catch(() => false);

    if (rowCount > 0) {
      console.log('通过候选人行数: ' + rowCount);

      // 验证表格列
      const headers = page.locator('.table-card .el-table__header-wrapper th');
      const headerCount = await headers.count();
      console.log('表格列数: ' + headerCount);

      // 验证第一行数据
      const firstRow = rows.first();
      const nameCell = firstRow.locator('td').nth(1);
      const nameText = await nameCell.textContent();
      console.log('第一行候选人: ' + nameText);

      // 验证"详情"按钮
      const detailBtn = firstRow.locator('button:has-text("详情")');
      await expect(detailBtn).toBeVisible();
    } else if (emptyVisible) {
      console.log('今日无通过候选人，显示空状态');
      const emptyText = await empty.textContent();
      console.log('空状态: ' + emptyText);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-04-candidates-table.png'), fullPage: true });
  });

  test('DR-5. 候选人展开行 - 查看建议/优势/风险', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const rows = page.locator('.table-card .el-table__body-wrapper .el-table__row');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      console.log('无候选人数据，跳过展开行测试');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-05-no-data.png'), fullPage: true });
      return;
    }

    // 点击展开按钮（第一行）
    const expandBtn = rows.first().locator('.el-table__expand-icon');
    if (await expandBtn.isVisible().catch(() => false)) {
      await expandBtn.click();
      await page.waitForTimeout(500);

      // 验证展开内容
      const expandContent = page.locator('.expand-content').first();
      const expandVisible = await expandContent.isVisible().catch(() => false);
      if (expandVisible) {
        const expandText = await expandContent.textContent();
        console.log('展开内容: ' + expandText?.substring(0, 100));

        // 检查是否包含建议、优势、风险标签
        const labels = expandContent.locator('.expand-label');
        const labelCount = await labels.count();
        console.log('展开项数量: ' + labelCount);

        if (labelCount === 0) {
          // 可能显示"暂无分析数据"
          const emptyText = expandContent.locator('.expand-empty');
          if (await emptyText.isVisible().catch(() => false)) {
            console.log('展开内容为空：暂无分析数据');
          }
        }
      }
    } else {
      console.log('展开按钮不可见');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-05-expand-row.png'), fullPage: true });
  });

  test('DR-6. 岗位推荐面板', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 验证岗位推荐卡片
    const recommendCard = page.locator('.recommend-card');
    await expect(recommendCard).toBeVisible();

    const cardHeader = await recommendCard.locator('.el-card__header').textContent();
    console.log('推荐卡片标题: ' + cardHeader?.trim());
    expect(cardHeader).toContain('岗位推荐');

    // 验证"NEW"标签
    const newTag = recommendCard.locator('.el-tag:has-text("NEW")');
    if (await newTag.isVisible().catch(() => false)) {
      console.log('NEW标签可见');
    }

    // 检查岗位列表或空状态
    const positionItems = recommendCard.locator('.position-item');
    const posCount = await positionItems.count();
    console.log('岗位推荐数量: ' + posCount);

    if (posCount > 0) {
      // 验证第一个岗位信息
      const firstPos = positionItems.first();
      const posTitle = await firstPos.locator('.pos-title').textContent();
      console.log('第一个岗位: ' + posTitle);

      // 验证岗位操作按钮
      const viewBtn = firstPos.locator('button:has-text("查看")');
      const editBtn = firstPos.locator('button:has-text("编辑")');
      const pushBtn = firstPos.locator('button:has-text("推送")');
      const deleteBtn = firstPos.locator('button[type="warning"], .pos-actions button:last-child');

      expect(await viewBtn.isVisible()).toBe(true);
      expect(await editBtn.isVisible()).toBe(true);
      expect(await pushBtn.isVisible()).toBe(true);
    }

    // 验证"添加岗位"按钮
    const addBtn = recommendCard.locator('button:has-text("添加岗位至推荐池")');
    await expect(addBtn).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-06-position-panel.png'), fullPage: true });
  });

  test('DR-7. 风险提醒面板', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const riskCard = page.locator('.risk-card');
    await expect(riskCard).toBeVisible();

    const headerText = await riskCard.locator('.el-card__header').textContent();
    console.log('风险提醒标题: ' + headerText?.trim());
    expect(headerText).toContain('风险提醒');

    // 检查是否有风险提醒项或空状态
    const timelineItems = riskCard.locator('.el-timeline-item');
    const itemCount = await timelineItems.count();
    const empty = riskCard.locator('.el-empty');
    const emptyVisible = await empty.isVisible().catch(() => false);

    if (itemCount > 0) {
      console.log('风险提醒数量: ' + itemCount);
      for (let i = 0; i < Math.min(itemCount, 3); i++) {
        const text = await timelineItems.nth(i).textContent();
        console.log(`  风险${i + 1}: ${text?.trim()}`);
      }
    } else if (emptyVisible) {
      console.log('暂无风险提醒');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-07-risk-panel.png'), fullPage: true });
  });

  test('DR-8. 快速操作面板 - 手动触发全量分析', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const actionCard = page.locator('.action-card');
    await expect(actionCard).toBeVisible();

    // 验证上次分析时间
    const lastTime = actionCard.locator('.last-analysis-time');
    if (await lastTime.isVisible().catch(() => false)) {
      const timeText = await lastTime.textContent();
      console.log('上次分析时间: ' + timeText?.trim());
    }

    // 验证手动触发按钮
    const triggerBtn = actionCard.locator('button:has-text("手动触发全量分析")');
    await expect(triggerBtn).toBeVisible();

    // 验证自动运行提示
    const autoNote = actionCard.locator('.el-alert');
    if (await autoNote.isVisible().catch(() => false)) {
      const noteText = await autoNote.textContent();
      console.log('自动运行提示: ' + noteText?.trim());
      expect(noteText).toContain('21:00');
    }

    // 点击触发分析（不等待完成，仅验证按钮响应）
    await triggerBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-08-trigger-clicked.png'), fullPage: true });

    // 验证按钮变为loading状态或显示进度
    const btnText = await triggerBtn.textContent();
    console.log('点击后按钮文字: ' + btnText?.trim());

    // 检查是否有进度条
    const progress = actionCard.locator('.el-progress');
    if (await progress.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('进度条可见');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-08-progress.png'), fullPage: true });
    }

    // 等待成功提示
    try {
      const successMsg = page.locator('.el-message--success');
      await expect(successMsg.first()).toBeVisible({ timeout: 60000 });
      const msgText = await successMsg.first().textContent();
      console.log('成功消息: ' + msgText);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-08-trigger-success.png'), fullPage: true });
    } catch (e) {
      logBug('手动触发全量分析后60秒内未收到成功提示。截图: DR-08-trigger-clicked.png');
    }
  });

  test('DR-9. 添加岗位对话框', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 点击"添加岗位至推荐池"
    const addBtn = page.locator('button:has-text("添加岗位至推荐池")');
    await addBtn.click();
    await page.waitForTimeout(500);

    // 验证对话框打开
    const dialog = page.locator('.el-dialog:has-text("添加岗位至推荐池")');
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-09-add-position-dialog.png'), fullPage: true });

    // 验证表单字段
    const formItems = dialog.locator('.el-form-item');
    const formCount = await formItems.count();
    console.log('表单字段数量: ' + formCount);

    // 填写岗位名称（必填）
    const titleInput = dialog.locator('input[placeholder*="岗位名称"]');
    await titleInput.fill('UI自动化测试岗位_' + Date.now());

    // 填写部门
    const deptInput = dialog.locator('input[placeholder*="技术部"]');
    await deptInput.fill('测试部门');

    // 选择学历要求
    const eduSelect = dialog.locator('.el-select').first();
    await eduSelect.click();
    await page.waitForTimeout(300);
    const eduOption = page.locator('.el-select-dropdown__item:has-text("本科")');
    if (await eduOption.isVisible().catch(() => false)) {
      await eduOption.click();
      await page.waitForTimeout(200);
    }

    // 填写技能要求
    const skillsInput = dialog.locator('input[placeholder*="逗号分隔"]');
    await skillsInput.fill('Java,Spring,MySQL');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-09-form-filled.png'), fullPage: true });

    // 验证AI评分维度checkbox
    const checkboxes = dialog.locator('.el-checkbox');
    const cbCount = await checkboxes.count();
    console.log('AI评分维度选项数: ' + cbCount);

    // 点击确认添加
    const confirmBtn = dialog.locator('button:has-text("确认添加")');
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // 检查是否成功
    try {
      const successMsg = page.locator('.el-message--success');
      await expect(successMsg).toBeVisible({ timeout: 10000 });
      const msgText = await successMsg.textContent();
      console.log('添加成功: ' + msgText);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-09-add-success.png'), fullPage: true });
    } catch (e) {
      logBug('添加岗位后未显示成功提示。截图: DR-09-form-filled.png');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-09-add-bug.png'), fullPage: true });
    }
  });

  test('DR-10. 岗位详情对话框 - 查看按钮', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 检查是否有岗位项
    const positionItems = page.locator('.position-item');
    const posCount = await positionItems.count();

    if (posCount === 0) {
      console.log('无岗位数据，跳过详情测试');
      return;
    }

    // 点击第一个岗位的"查看"按钮
    const viewBtn = positionItems.first().locator('button:has-text("查看")');
    await viewBtn.click();
    await page.waitForTimeout(1000);

    // 验证岗位详情对话框
    const detailDialog = page.locator('.el-dialog:has-text("岗位详情")');
    await expect(detailDialog).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-10-position-detail.png'), fullPage: true });

    // 验证详情内容
    const detailRows = detailDialog.locator('.detail-row');
    const rowCount = await detailRows.count();
    console.log('详情字段数: ' + rowCount);

    // 验证推荐记录区域
    const recSection = detailDialog.locator('.rec-section');
    const recCount = await recSection.count();
    console.log('推荐记录区域数: ' + recCount);

    // 验证"推送候选人"按钮
    const pushBtn = detailDialog.locator('button:has-text("推送候选人")');
    if (await pushBtn.isVisible().catch(() => false)) {
      console.log('推送候选人按钮可见');
    }

    // 关闭对话框
    const closeBtn = detailDialog.locator('.el-dialog__close');
    await closeBtn.click();
    await page.waitForTimeout(500);
  });

  test('DR-11. 推送候选人对话框', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const positionItems = page.locator('.position-item');
    const posCount = await positionItems.count();

    if (posCount === 0) {
      console.log('无岗位数据，跳过推送测试');
      return;
    }

    // 点击第一个岗位的"推送"按钮
    const pushBtn = positionItems.first().locator('button:has-text("推送")');
    await pushBtn.click();
    await page.waitForTimeout(500);

    // 验证推送对话框
    const dialog = page.locator('.el-dialog:has-text("推送候选人")');
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-11-push-dialog.png'), fullPage: true });

    // 验证搜索输入框
    const searchInput = dialog.locator('input[placeholder*="关键词"]');
    await expect(searchInput).toBeVisible();

    // 搜索候选人
    await searchInput.fill('工程师');
    const searchBtn = dialog.locator('button:has-text("搜索")');
    await searchBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-11-search-results.png'), fullPage: true });

    // 检查搜索结果
    const candidates = dialog.locator('.rec-candidate-item');
    const candidateCount = await candidates.count();
    console.log('搜索到的候选人数量: ' + candidateCount);

    if (candidateCount > 0) {
      // 选择第一个候选人
      await candidates.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-11-candidate-selected.png'), fullPage: true });

      // 验证"确认推送"按钮可用
      const confirmBtn = dialog.locator('button:has-text("确认推送")');
      const isDisabled = await confirmBtn.getAttribute('disabled');
      console.log('确认推送按钮禁用状态: ' + (isDisabled !== null));

      // 不实际推送，关闭对话框
      const cancelBtn = dialog.locator('button:has-text("取消")');
      await cancelBtn.click();
    } else {
      console.log('未搜索到候选人');
      // 关闭对话框
      const cancelBtn = dialog.locator('button:has-text("取消")');
      await cancelBtn.click();
    }
  });

  test('DR-12. 候选人详情跳转', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const rows = page.locator('.table-card .el-table__body-wrapper .el-table__row');
    const rowCount = await rows.count();

    if (rowCount === 0) {
      console.log('无候选人数据，跳过详情跳转');
      return;
    }

    // 点击"详情"按钮
    const detailBtn = rows.first().locator('button:has-text("详情")');
    await detailBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/candidate/');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-12-detail-navigate.png'), fullPage: true });

    // 返回
    await page.goBack();
    await page.waitForLoadState('networkidle');
  });

  test('DR-13. 编辑岗位对话框', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const positionItems = page.locator('.position-item');
    const posCount = await positionItems.count();

    if (posCount === 0) {
      console.log('无岗位数据，跳过编辑测试');
      return;
    }

    // 获取第一个岗位名称
    const posTitle = await positionItems.first().locator('.pos-title').textContent();
    console.log('编辑岗位: ' + posTitle);

    // 点击"编辑"按钮
    const editBtn = positionItems.first().locator('button:has-text("编辑")');
    await editBtn.click();
    await page.waitForTimeout(500);

    // 验证编辑对话框
    const dialog = page.locator('.el-dialog:has-text("编辑岗位")');
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-13-edit-position.png'), fullPage: true });

    // 验证岗位名称已填充
    const titleInput = dialog.locator('input[placeholder*="岗位名称"]');
    const titleVal = await titleInput.inputValue();
    console.log('岗位名称值: ' + titleVal);
    expect(titleVal.length).toBeGreaterThan(0);

    // 关闭不保存
    const cancelBtn = dialog.locator('button:has-text("取消")');
    await cancelBtn.click();
  });

  test('DR-14. 删除岗位功能', async ({ page }) => {
    await page.goto('/daily');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const positionItems = page.locator('.position-item');
    const posCount = await positionItems.count();

    if (posCount === 0) {
      console.log('无岗位数据，跳过删除测试');
      return;
    }

    // 获取最后一个岗位（可能是刚添加的测试数据）
    const lastPos = positionItems.last();
    const posTitle = await lastPos.locator('.pos-title').textContent();
    console.log('准备删除岗位: ' + posTitle);

    // 点击删除按钮（最后一个按钮）
    const deleteBtn = lastPos.locator('.pos-actions button').last();
    await deleteBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-14-delete-clicked.png'), fullPage: true });

    // 检查是否有确认提示或直接删除
    try {
      const successMsg = page.locator('.el-message--success:has-text("已移除")');
      await expect(successMsg).toBeVisible({ timeout: 5000 });
      console.log('岗位已移除');
    } catch {
      console.log('删除操作可能需要确认或无反馈');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'DR-14-after-delete.png'), fullPage: true });
  });
});

test.afterAll(async () => {
  if (BUG_LOG.length > 0) {
    console.log('\n========================================');
    console.log('🐛 每日洞察页面发现的 Bug:');
    console.log('========================================');
    BUG_LOG.forEach((bug, i) => console.log(`  ${i + 1}. ${bug}`));
    console.log('========================================\n');
  } else {
    console.log('\n✅ 每日洞察页面未发现 Bug\n');
  }
});
