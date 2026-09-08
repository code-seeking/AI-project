import { test, expect } from '@playwright/test';
import { ApiClient } from '../src/api/api-client';
import { CandidateApi } from '../src/api/candidate.api';
import { PositionApi } from '../src/api/position.api';
import { MatchingApi } from '../src/api/matching.api';
import { TestDataFactory } from '../src/fixtures/test-data.factory';
import { TestDataCleanup } from '../src/fixtures/test-data.cleanup';
import { assertSuccessWithData } from '../src/helpers/assertions';
import { pollUntil } from '../src/helpers/poller';
import { Logger } from '../src/helpers/logger';

const log = new Logger('matching');
let client: ApiClient;
let candidateApi: CandidateApi;
let positionApi: PositionApi;
let matchingApi: MatchingApi;
let cleanup: TestDataCleanup;

test.beforeAll(async () => {
  client = await new ApiClient().init();
  candidateApi = new CandidateApi(client);
  positionApi = new PositionApi(client);
  matchingApi = new MatchingApi(client);
  cleanup = new TestDataCleanup();
});

test.afterEach(async () => {
  await cleanup.cleanupAll(candidateApi, positionApi);
});

test.afterAll(async () => {
  await client.dispose();
});

test.describe.serial('人岗匹配全流程', () => {
  test('1. 评估候选人与岗位的匹配度', async () => {
    test.slow(); // AI 端点可能较慢

    const candidate = assertSuccessWithData(
      await candidateApi.create(TestDataFactory.candidateCreate({ skills: 'Java, Spring Boot, MySQL, Redis' }))
    );
    cleanup.trackCandidate(candidate.id);

    const position = assertSuccessWithData(
      await positionApi.create(TestDataFactory.position({ requiredSkills: 'Java, Spring Boot, MySQL' }))
    );
    cleanup.trackPosition(position.id);

    log.info(`评估匹配: candidate=${candidate.id}, position=${position.id}`);
    const result = await matchingApi.evaluate({
      candidateId: candidate.id,
      positionId: position.id,
      forceRefresh: true,
    });
    const data = assertSuccessWithData(result);

    expect(data.candidateId).toBe(candidate.id);
    expect(data.positionId).toBe(position.id);
    expect(data.overallScore).toBeDefined();
    expect(typeof data.overallScore).toBe('number');
    expect(data.overallScore!).toBeGreaterThanOrEqual(0);
    expect(data.overallScore!).toBeLessThanOrEqual(100);
    log.info(`匹配评分: overallScore=${data.overallScore}`);
  });

  test('2. 按候选人查询匹配结果', async () => {
    test.slow();

    const candidate = assertSuccessWithData(await candidateApi.create(TestDataFactory.candidateCreate()));
    cleanup.trackCandidate(candidate.id);

    const position = assertSuccessWithData(await positionApi.create(TestDataFactory.position()));
    cleanup.trackPosition(position.id);

    await matchingApi.evaluate({ candidateId: candidate.id, positionId: position.id, forceRefresh: true });

    const result = await matchingApi.getByCandidate(candidate.id);
    const data = assertSuccessWithData(result);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    const match = data.find((m) => m.positionId === position.id);
    expect(match).toBeDefined();
    log.info(`候选人匹配结果: ${data.length} 条`);
  });

  test('3. 按岗位查询匹配结果', async () => {
    test.slow();

    const candidate = assertSuccessWithData(await candidateApi.create(TestDataFactory.candidateCreate()));
    cleanup.trackCandidate(candidate.id);

    const position = assertSuccessWithData(await positionApi.create(TestDataFactory.position()));
    cleanup.trackPosition(position.id);

    await matchingApi.evaluate({ candidateId: candidate.id, positionId: position.id, forceRefresh: true });

    const result = await matchingApi.getByPosition(position.id);
    const data = assertSuccessWithData(result);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    log.info(`岗位匹配结果: ${data.length} 条`);
  });

  test('4. 触发岗位自动匹配并轮询结果', async () => {
    test.slow();
    test.setTimeout(180000); // 3 分钟超时

    const candidate = assertSuccessWithData(await candidateApi.create(TestDataFactory.candidateCreate()));
    cleanup.trackCandidate(candidate.id);

    const position = assertSuccessWithData(await positionApi.create(TestDataFactory.position()));
    cleanup.trackPosition(position.id);

    log.info(`触发自动匹配: position=${position.id}`);
    const triggerResult = await positionApi.triggerAutoMatch(position.id);
    assertSuccessWithData(triggerResult);

    // 轮询等待匹配结果出现
    const matchResults = await pollUntil(
      () => positionApi.getMatchedCandidates(position.id),
      (r) => r.code === 200 && r.data !== null && r.data.length > 0,
      { timeoutMs: 120000, intervalMs: 3000, description: 'auto-match results' }
    );
    const data = assertSuccessWithData(matchResults);
    expect(data.length).toBeGreaterThan(0);
    log.info(`自动匹配完成: ${data.length} 条结果`);
  });

  test('5. 获取岗位匹配候选人（按分数降序）', async () => {
    test.slow();

    const candidate = assertSuccessWithData(await candidateApi.create(TestDataFactory.candidateCreate()));
    cleanup.trackCandidate(candidate.id);

    const position = assertSuccessWithData(await positionApi.create(TestDataFactory.position()));
    cleanup.trackPosition(position.id);

    await matchingApi.evaluate({ candidateId: candidate.id, positionId: position.id, forceRefresh: true });

    const result = await positionApi.getMatchedCandidates(position.id);
    const data = assertSuccessWithData(result);

    expect(data.length).toBeGreaterThanOrEqual(1);
    // 验证按分数降序
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        expect((data[i - 1].overallScore ?? 0)).toBeGreaterThanOrEqual(data[i].overallScore ?? 0);
      }
    }
    log.info(`匹配候选人: ${data.length} 条, 最高分=${data[0].overallScore}`);
  });

  test('6. 推荐其他匹配度高的岗位', async () => {
    test.slow();
    test.setTimeout(180000);

    const candidate = assertSuccessWithData(await candidateApi.create(TestDataFactory.candidateCreate()));
    cleanup.trackCandidate(candidate.id);

    // 创建两个岗位
    const pos1 = assertSuccessWithData(await positionApi.create(TestDataFactory.position()));
    const pos2 = assertSuccessWithData(await positionApi.create(TestDataFactory.position()));
    cleanup.trackPosition(pos1.id);
    cleanup.trackPosition(pos2.id);

    // 评估两个岗位
    await matchingApi.evaluate({ candidateId: candidate.id, positionId: pos1.id, forceRefresh: true });
    await matchingApi.evaluate({ candidateId: candidate.id, positionId: pos2.id, forceRefresh: true });

    const result = await matchingApi.findSuggestedPositions(candidate.id);
    const data = assertSuccessWithData(result);

    expect(Array.isArray(data)).toBe(true);
    // 返回的岗位匹配度应该 >= 80
    for (const match of data) {
      expect(match.overallScore!).toBeGreaterThanOrEqual(80);
    }
    log.info(`推荐岗位: ${data.length} 条`);
  });
});
