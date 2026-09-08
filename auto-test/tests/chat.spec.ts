import { test, expect } from '@playwright/test';
import { ApiClient } from '../src/api/api-client';
import { ChatApi } from '../src/api/chat.api';
import { assertSuccessWithData } from '../src/helpers/assertions';
import { Logger } from '../src/helpers/logger';

const log = new Logger('chat');
let client: ApiClient;
let chatApi: ChatApi;

test.beforeAll(async () => {
  client = await new ApiClient().init();
  chatApi = new ChatApi(client);
});

test.afterAll(async () => {
  await client.dispose();
});

test.describe.serial('聊天机器人流程', () => {
  const testSessionId = `e2e-test-${Date.now()}`;

  test('1. 发送消息并获取回复', async () => {
    test.slow();
    test.setTimeout(120000);

    log.info(`发送消息: session=${testSessionId}`);
    const result = await chatApi.send('你好，请帮我查询一下候选人列表', testSessionId);
    const data = assertSuccessWithData(result);

    expect(data.sessionId).toBeDefined();
    expect(data.reply).toBeDefined();
    expect(data.reply.length).toBeGreaterThan(0);
    log.info(`回复: ${data.reply.substring(0, 100)}...`);
  });

  test('2. 获取会话历史', async () => {
    test.slow();
    test.setTimeout(120000);

    const sessionId = `e2e-history-${Date.now()}`;

    // 先发一条消息
    await chatApi.send('查询今天的候选人统计', sessionId);

    // 获取历史
    const result = await chatApi.getHistory(sessionId);
    const data = assertSuccessWithData(result);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    log.info(`会话历史: ${data.length} 条消息`);
  });

  test('3. 新会话自动分配 sessionId', async () => {
    test.slow();
    test.setTimeout(120000);

    const result = await chatApi.send('你好');
    const data = assertSuccessWithData(result);

    expect(data.sessionId).toBeDefined();
    expect(data.sessionId.length).toBeGreaterThan(0);
    log.info(`自动分配 sessionId: ${data.sessionId}`);
  });
});
