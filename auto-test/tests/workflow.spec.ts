import { test, expect } from '@playwright/test';
import { ApiClient } from '../src/api/api-client';
import { WorkflowApi } from '../src/api/workflow.api';
import { assertSuccessWithData } from '../src/helpers/assertions';
import { Logger } from '../src/helpers/logger';

const log = new Logger('workflow');
let client: ApiClient;
let workflowApi: WorkflowApi;

test.beforeAll(async () => {
  client = await new ApiClient().init();
  workflowApi = new WorkflowApi(client);
});

test.afterAll(async () => {
  await client.dispose();
});

test.describe.serial('工作流执行流程', () => {
  test('1. 解析工作流计划', async () => {
    test.slow();
    test.setTimeout(120000);

    const message = '帮我创建一个Java高级工程师岗位，要求5年以上经验，熟悉Spring Boot和微服务';
    log.info(`解析计划: ${message}`);

    const result = await workflowApi.parsePlan(message);
    const data = assertSuccessWithData(result);

    expect(data.intent).toBeDefined();
    expect(data.intent.length).toBeGreaterThan(0);
    expect(data.steps).toBeDefined();
    expect(Array.isArray(data.steps)).toBe(true);
    log.info(`意图: ${data.intent}, 步骤数: ${data.steps.length}`);
  });

  test('2. 执行工作流', async () => {
    test.slow();
    test.setTimeout(120000);

    const sessionId = `wf-${Date.now()}`;
    const message = '查询候选人统计信息';
    log.info(`执行工作流: session=${sessionId}, message=${message}`);

    const result = await workflowApi.execute(message, sessionId);
    const data = assertSuccessWithData(result);

    expect(data.workflowId).toBeDefined();
    expect(data.workflowId.length).toBeGreaterThan(0);
    expect(data.status).toBeDefined();
    expect(data.sessionId).toBe(sessionId);
    log.info(`工作流: id=${data.workflowId}, status=${data.status}`);
  });

  test('3. 获取工作流进度', async () => {
    test.slow();
    test.setTimeout(120000);

    const sessionId = `wf-progress-${Date.now()}`;
    const message = '查询今天的日报';

    const execResult = await workflowApi.execute(message, sessionId);
    const execData = assertSuccessWithData(execResult);

    const result = await workflowApi.getProgress(sessionId, execData.workflowId);
    const data = assertSuccessWithData(result);

    expect(data.totalSteps).toBeGreaterThan(0);
    expect(data.currentStepIndex).toBeGreaterThanOrEqual(0);
    expect(data.workflowId).toBe(execData.workflowId);
    log.info(`进度: ${data.currentStepIndex}/${data.totalSteps}, status=${data.status}`);
  });

  test('4. 处理工作流确认', async () => {
    test.slow();
    test.setTimeout(120000);

    const sessionId = `wf-confirm-${Date.now()}`;
    const message = '帮我创建一个前端开发岗位';

    const execResult = await workflowApi.execute(message, sessionId);
    const execData = assertSuccessWithData(execResult);

    // 尝试确认
    const confirmResult = await workflowApi.confirm({
      sessionId,
      workflowId: execData.workflowId,
      confirmed: true,
    });
    const confirmData = assertSuccessWithData(confirmResult);

    // workflowId may be null if workflow already completed without confirmation
    if (confirmData.workflowId) {
      expect(confirmData.workflowId).toBe(execData.workflowId);
    }
    expect(confirmData.status).toBeDefined();
    log.info(`确认结果: status=${confirmData.status}`);
  });
});
