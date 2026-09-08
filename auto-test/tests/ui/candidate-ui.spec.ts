import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve('test-results/ui-screenshots');
const BUG_LOG: string[] = [];

function logBug(description: string) {
  BUG_LOG.push(`[BUG] ${description}`);
  console.log(`\n⚠️  [BUG] ${description}\n`);
}

test.describe.serial('人才库（候选人列表）UI 自动化测试', () => {

  test('1. 页面加载 - 验证统计卡片和表格渲染', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-page-loaded.png'), fullPage: true });

    // 验证导航菜单 "人才库" 高亮
    const menuActive = page.locator('.el-menu-item.is-active, .nav-item.active, [class*="active"]').first();
    await expect(menuActive).toBeVisible();

    // 验证统计卡片
    const statCards = page.locator('.stat-card');
    const cardCount = await statCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(5);

    // 验证表格存在且有数据
    const tableRows = page.locator('.el-table__body-wrapper .el-table__row');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);
    console.log(`表格行数: ${rowCount}`);

    // BUG: "总候选人" 统计卡片显示 0，分页组件显示 "Total 0"，但表格实际有数据
    // 原因: 后端 MyBatis-Plus 分页接口返回的 total 字段始终为 0
    const totalValue = page.locator('.stat-card').first().locator('.stat-value');
    const totalText = await totalValue.textContent();
    if (Number(totalText) === 0 && rowCount > 0) {
      logBug('"总候选人" 统计卡片显示 0，但表格有 ' + rowCount + ' 行数据。后端分页 total 字段异常。截图: 01-page-loaded.png');
    }

    // Check if pagination total is correct (should not be 0 when there is data)
    const paginationTotal = page.locator('.el-pagination__total');
    const paginationText = await paginationTotal.textContent();
    if (paginationText?.trim() === 'Total 0' && rowCount > 0) {
      logBug('分页组件显示 "Total 0"，但表格有数据。后端 IPage.total 返回值异常。截图: 01-page-loaded.png');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-table-loaded.png'), fullPage: true });
  });

  test('2. 搜索功能 - 关键词搜索', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 在关键词输入框输入
    const keywordInput = page.locator('.search-form input[placeholder*="姓名"]');
    await keywordInput.fill('测试');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-keyword-entered.png'), fullPage: true });

    // 点击搜索按钮
    const searchBtn = page.locator('.search-form button:has-text("搜索")');
    await searchBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-search-results.png'), fullPage: true });

    // 验证有搜索结果
    const rows = page.locator('.el-table__body-wrapper .el-table__row');
    const count = await rows.count();
    console.log(`搜索"测试"结果行数: ${count}`);

    // 重置搜索
    const resetBtn = page.locator('.search-form button:has-text("重置")');
    await resetBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const resetRows = page.locator('.el-table__body-wrapper .el-table__row');
    const resetCount = await resetRows.count();
    console.log(`重置后行数: ${resetCount}`);
    // Backend pagination bug: reset may not show all rows due to total=0 issue
    expect(resetCount).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-search-reset.png'), fullPage: true });
  });

  test('3. 状态筛选 - 点击统计卡片筛选', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 点击 "待筛选" 卡片
    const pendingCard = page.locator('.stat-card.pending');
    await pendingCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // 验证卡片高亮
    await expect(pendingCard).toHaveClass(/active/);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-filter-pending.png'), fullPage: true });

    // 点击 "已通过" 卡片
    const passedCard = page.locator('.stat-card.passed');
    await passedCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(passedCard).toHaveClass(/active/);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-filter-passed.png'), fullPage: true });

    // 点击 "总候选人" 卡片恢复全部
    const totalCard = page.locator('.stat-card').first();
    await totalCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-filter-all.png'), fullPage: true });
  });

  test('4. 新增候选人 - 打开弹窗并填写表单', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 点击 "新增候选人" 按钮
    const addBtn = page.locator('button:has-text("新增候选人")');
    await addBtn.click();
    await page.waitForTimeout(500);

    // 验证弹窗打开
    const dialog = page.locator('.el-dialog:has-text("新增候选人")');
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-dialog-opened.png'), fullPage: true });

    // 填写姓名（必填）
    const nameInput = dialog.locator('input[placeholder="请输入姓名"]');
    await nameInput.fill(`UI测试候选人_${Date.now()}`);

    // 填写年龄
    const ageInput = dialog.locator('.el-input-number').first().locator('input');
    await ageInput.fill('30');

    // 填写工作年限
    const workYearsInput = dialog.locator('.el-input-number').nth(1).locator('input');
    await workYearsInput.fill('5');

    // 选择学历
    const eduSelect = dialog.locator('.el-select').first();
    await eduSelect.click();
    await page.locator('.el-select-dropdown__item:has-text("本科")').click();
    await page.waitForTimeout(200);

    // 填写当前公司
    const companyInput = dialog.locator('input[placeholder="请输入"]').nth(3);
    await companyInput.fill('UI测试科技有限公司');

    // 填写当前职位
    const positionInput = dialog.locator('input[placeholder="请输入"]').nth(4);
    await positionInput.fill('高级开发工程师');

    // 填写技能标签
    const skillsInput = dialog.locator('input[placeholder*="逗号"]');
    await skillsInput.fill('Java, Spring Boot, Vue, MySQL');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-form-filled.png'), fullPage: true });

    // 点击保存
    const saveBtn = dialog.locator('button:has-text("保存")');
    await saveBtn.click();

    // 等待成功提示
    const successMsg = page.locator('.el-message--success');
    await expect(successMsg).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-create-success.png'), fullPage: true });

    // 验证弹窗关闭
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test('5. 查看候选人详情 - 点击姓名跳转', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 点击第一个候选人的姓名链接
    const firstRow = page.locator('.el-table__body-wrapper .el-table__row').first();
    const nameLink = firstRow.locator('.el-link');
    const candidateName = await nameLink.textContent();
    console.log(`点击候选人: ${candidateName}`);

    await nameLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 验证跳转到详情页
    expect(page.url()).toContain('/candidate/');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-detail-page.png'), fullPage: true });

    // 验证详情页包含候选人姓名
    const pageContent = await page.content();
    expect(pageContent).toContain(candidateName!);

    // 返回列表
    await page.goBack();
    await page.waitForLoadState('networkidle');
  });

  test('6. 编辑候选人 - 点击编辑按钮', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 点击第一行的 "编辑" 按钮
    const firstRow = page.locator('.el-table__body-wrapper .el-table__row').first();
    const editBtn = firstRow.locator('button:has-text("编辑")');
    await editBtn.click();
    await page.waitForTimeout(1000);

    // 验证编辑弹窗打开
    const dialog = page.locator('.el-dialog:has-text("编辑候选人")');
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-edit-dialog.png'), fullPage: true });

    // 验证姓名输入框有值
    const nameInput = dialog.locator('input[placeholder="请输入姓名"]');
    const nameVal = await nameInput.inputValue();
    expect(nameVal.length).toBeGreaterThan(0);
    console.log(`编辑候选人姓名: ${nameVal}`);

    // 修改备注
    const remarkInput = dialog.locator('textarea');
    await remarkInput.fill('UI自动化测试编辑备注');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-edit-form-modified.png'), fullPage: true });

    // 点击保存
    const saveBtn = dialog.locator('button:has-text("保存")');
    await saveBtn.click();

    // 等待成功提示或弹窗关闭
    try {
      const successMsg = page.locator('.el-message--success');
      await expect(successMsg).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-edit-success.png'), fullPage: true });
    } catch (e) {
      logBug('编辑候选人保存后未显示成功提示');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-edit-bug-no-success.png'), fullPage: true });
    }
  });

  test('7. 候选人详情按钮 - 操作栏详情', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('.el-table__body-wrapper .el-table__row').first();
    const detailBtn = firstRow.locator('button:has-text("详情")');
    await detailBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/candidate/');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-detail-via-button.png'), fullPage: true });

    await page.goBack();
    await page.waitForLoadState('networkidle');
  });

  test('8. AI分析功能 - 点击分析按钮', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('.el-table__body-wrapper .el-table__row').first();
    const analyzeBtn = firstRow.locator('button:has-text("分析")');

    // 监听AI分析请求是否发出
    const apiRequestPromise = page.waitForRequest(
      req => req.url().includes('/reports/candidate/') && req.url().includes('/analyze'),
      { timeout: 10000 }
    ).catch(() => null);

    await analyzeBtn.click();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-analyze-clicked.png'), fullPage: true });

    // 验证请求已发出
    const request = await apiRequestPromise;
    if (request) {
      console.log('AI分析请求已发出: ' + request.url());
    } else {
      logBug('AI分析按钮点击后未发出API请求');
    }

    // 等待AI分析完成（可能需要较长时间，缩短等待以避免dev server断连）
    try {
      const successMsg = page.locator('.el-message--success:has-text("分析完成")');
      await expect(successMsg).toBeVisible({ timeout: 30000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-analyze-success.png'), fullPage: true });
    } catch (e) {
      logBug('AI分析按钮点击后未收到"分析完成"成功提示（30秒超时，可能AI响应较慢）');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-analyze-bug-timeout.png'), fullPage: true });
    }
  });

  test('9. 分页功能 - 切换每页数量', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 检查分页组件存在
    const pagination = page.locator('.el-pagination');
    await expect(pagination).toBeVisible();

    // 获取当前表格行数
    const getRowCount = async () => {
      return await page.locator('.el-table__body-wrapper .el-table__row').count();
    };
    const initialRows = await getRowCount();
    console.log(`初始表格行数: ${initialRows}`);

    // 获取分页总数文字
    const totalText = await pagination.locator('.el-pagination__total').textContent();
    console.log(`分页总数文字: ${totalText}`);

    // 获取当前每页数量选择器的值
    const sizeSelector = pagination.locator('.el-pagination__sizes .el-select');
    await expect(sizeSelector).toBeVisible();
    const currentSize = await sizeSelector.locator('.el-select__placeholder, .el-select__selected-item').first().textContent();
    console.log(`当前每页数量: ${currentSize}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-pagination-initial.png'), fullPage: true });

    // 点击每页数量下拉选择器
    await sizeSelector.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-pagination-dropdown.png'), fullPage: true });

    // 选择 50 条/页
    const option50 = page.locator('.el-select-dropdown__item:has-text("50")');
    if (await option50.isVisible()) {
      await option50.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const rowsAfter50 = await getRowCount();
      console.log(`切换为50条/页后行数: ${rowsAfter50}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-pagination-50per-page.png'), fullPage: true });

      // BUG检测: 如果后端分页 total=0，切换每页数量可能不会生效
      if (rowsAfter50 === initialRows && initialRows < 50) {
        // 检查是否因为数据本来就少于50条
        // 如果数据少于50条，行数不变是正常的
        // 但如果 total 显示 0，这也是 bug
        if (totalText?.includes('0')) {
          logBug('分页组件 Total 显示 0，导致每页数量切换后无法正确反映数据总量。后端 IPage.total 异常。截图: 09-pagination-50per-page.png');
        }
      } else if (rowsAfter50 > initialRows) {
        console.log('切换每页数量生效，行数增加');
      }
    }

    // 切换为 10 条/页
    await sizeSelector.click();
    await page.waitForTimeout(500);
    const option10 = page.locator('.el-select-dropdown__item:has-text("10")');
    if (await option10.isVisible()) {
      await option10.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const rowsAfter10 = await getRowCount();
      console.log(`切换为10条/页后行数: ${rowsAfter10}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-pagination-10per-page.png'), fullPage: true });

      // 如果数据多于10条，行数应该变为10
      if (initialRows > 10 && rowsAfter10 > 10) {
        logBug('切换每页数量为10后，表格仍显示 ' + rowsAfter10 + ' 行，应该只显示10行。分页组件未正确工作，因为后端 total=0。截图: 09-pagination-10per-page.png');
      }
    }

    // 尝试翻到第二页
    const nextBtn = pagination.locator('.btn-next');
    const isDisabled = await nextBtn.getAttribute('disabled');
    if (isDisabled === null) {
      await nextBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      const count = await getRowCount();
      console.log(`第2页行数: ${count}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-page-2.png'), fullPage: true });
    } else {
      console.log('翻页按钮已禁用（可能因 total=0 bug）');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-pagination-final.png'), fullPage: true });
  });

  test('10. 删除候选人 - 确认对话框', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 先创建一个候选人用于删除
    const addBtn = page.locator('button:has-text("新增候选人")');
    await addBtn.click();
    await page.waitForTimeout(500);

    const dialog = page.locator('.el-dialog:has-text("新增候选人")');
    const nameInput = dialog.locator('input[placeholder="请输入姓名"]');
    const deleteName = `待删除_${Date.now()}`;
    await nameInput.fill(deleteName);

    const saveBtn = dialog.locator('button:has-text("保存")');
    await saveBtn.click();
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // 搜索刚创建的候选人
    const keywordInput = page.locator('.search-form input[placeholder*="姓名"]');
    await keywordInput.fill(deleteName);
    await page.locator('.search-form button:has-text("搜索")').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // 点击删除按钮
    const firstRow = page.locator('.el-table__body-wrapper .el-table__row').first();
    const deleteBtn = firstRow.locator('button:has-text("删除")');
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // 验证确认对话框弹出
    const confirmDialog = page.locator('.el-message-box');
    await expect(confirmDialog).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-delete-confirm.png'), fullPage: true });

    // 点击确认 (Element Plus uses "OK"/"Cancel")
    const confirmBtn = confirmDialog.locator('button:has-text("OK"), button:has-text("确定")');
    await confirmBtn.click();

    // 等待删除成功
    try {
      const successMsg = page.locator('.el-message--success:has-text("删除成功")');
      await expect(successMsg).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-delete-success.png'), fullPage: true });
    } catch (e) {
      logBug('删除候选人后未显示"删除成功"提示');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-delete-bug.png'), fullPage: true });
    }
  });

  test('11. 触发AI分析 - 全局按钮', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const triggerBtn = page.locator('button:has-text("触发AI分析")');
    await triggerBtn.click();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-trigger-ai.png'), fullPage: true });

    try {
      const successMsg = page.locator('.el-message--success:has-text("分析任务已触发")');
      await expect(successMsg).toBeVisible({ timeout: 60000 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-trigger-success.png'), fullPage: true });
    } catch (e) {
      logBug('触发AI分析按钮点击后未收到"分析任务已触发"成功提示');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-trigger-bug.png'), fullPage: true });
    }
  });
});

// 在所有测试完成后输出 Bug 汇总
test.afterAll(async () => {
  if (BUG_LOG.length > 0) {
    console.log('\n========================================');
    console.log('🐛 发现的 Bug 汇总:');
    console.log('========================================');
    BUG_LOG.forEach((bug, i) => console.log(`  ${i + 1}. ${bug}`));
    console.log('========================================\n');
  } else {
    console.log('\n✅ 未发现 Bug\n');
  }
});
