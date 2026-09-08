import { test, expect } from '@playwright/test';
import { ApiClient } from '../src/api/api-client';
import { CandidateApi } from '../src/api/candidate.api';
import { PositionApi } from '../src/api/position.api';
import { ReportApi } from '../src/api/report.api';
import { TestDataFactory } from '../src/fixtures/test-data.factory';
import { TestDataCleanup } from '../src/fixtures/test-data.cleanup';
import { assertSuccessWithData } from '../src/helpers/assertions';
import { Logger } from '../src/helpers/logger';

const log = new Logger('report');
let client: ApiClient;
let candidateApi: CandidateApi;
let positionApi: PositionApi;
let reportApi: ReportApi;
let cleanup: TestDataCleanup;

test.beforeAll(async () => {
  client = await new ApiClient().init();
  candidateApi = new CandidateApi(client);
  positionApi = new PositionApi(client);
  reportApi = new ReportApi(client);
  cleanup = new TestDataCleanup();
});

test.afterEach(async () => {
  await cleanup.cleanupAll(candidateApi, positionApi);
});

test.afterAll(async () => {
  await client.dispose();
});

test.describe.serial('报告与分析流程', () => {
  test('1. 分析单个候选人', async () => {
    test.slow();
    test.setTimeout(180000);

    const candidate = assertSuccessWithData(
      await candidateApi.create(TestDataFactory.candidateCreate())
    );
    cleanup.trackCandidate(candidate.id);

    log.info(`分析候选人: id=${candidate.id}`);
    const result = await reportApi.analyzeCandidate(candidate.id);
    const data = assertSuccessWithData(result);

    expect(data.candidateId).toBe(candidate.id);
    expect(data.overallScore).toBeDefined();
    expect(typeof data.overallScore).toBe('number');
    expect(data.overallScore!).toBeGreaterThanOrEqual(0);
    expect(data.overallScore!).toBeLessThanOrEqual(100);
    log.info(`分析完成: overallScore=${data.overallScore}`);
  });

  test('2. 获取候选人分析报告', async () => {
    test.slow();
    test.setTimeout(180000);

    const candidate = assertSuccessWithData(
      await candidateApi.create(TestDataFactory.candidateCreate())
    );
    cleanup.trackCandidate(candidate.id);

    // 先分析
    await reportApi.analyzeCandidate(candidate.id);

    // 获取报告
    const result = await reportApi.getCandidateReport(candidate.id);
    const data = assertSuccessWithData(result);

    expect(data.candidateId).toBe(candidate.id);
    expect(data.analysisDate).toBeDefined();
    log.info(`获取报告: date=${data.analysisDate}`);
  });

  test('3. 获取候选人报告历史', async () => {
    test.slow();
    test.setTimeout(180000);

    const candidate = assertSuccessWithData(
      await candidateApi.create(TestDataFactory.candidateCreate())
    );
    cleanup.trackCandidate(candidate.id);

    await reportApi.analyzeCandidate(candidate.id);

    const result = await reportApi.getCandidateReportHistory(candidate.id);
    const data = assertSuccessWithData(result);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    log.info(`报告历史: ${data.length} 条`);
  });

  test('4. 获取日报数据', async () => {
    const result = await reportApi.getDaily();
    const data = assertSuccessWithData(result);

    expect(Array.isArray(data)).toBe(true);
    log.info(`日报数据: ${data.length} 条`);
  });

  test('5. 获取增强日报（含候选人信息）', async () => {
    const result = await reportApi.getDailyEnriched();
    const data = assertSuccessWithData(result);

    expect(Array.isArray(data)).toBe(true);
    log.info(`增强日报: ${data.length} 条`);
  });

  test('6. 获取 Dashboard 数据', async () => {
    const result = await reportApi.getDashboard();
    const data = assertSuccessWithData(result);

    expect(data.stats).toBeDefined();
    expect(data.stats.totalCandidates).toBeDefined();
    expect(data.stats.totalPositions).toBeDefined();
    expect(data.funnel).toBeDefined();
    log.info(`Dashboard: candidates=${data.stats.totalCandidates}, positions=${data.stats.totalPositions}`);
  });

  test('7. 获取分析任务进度', async () => {
    const result = await reportApi.getTaskProgress();
    const data = assertSuccessWithData(result);

    expect(data.status).toBeDefined();
    expect(['IDLE', 'RUNNING', 'COMPLETED', 'FAILED']).toContain(data.status);
    expect(data.percentage).toBeGreaterThanOrEqual(0);
    expect(data.percentage).toBeLessThanOrEqual(100);
    log.info(`任务进度: status=${data.status}, ${data.percentage}%`);
  });
});
