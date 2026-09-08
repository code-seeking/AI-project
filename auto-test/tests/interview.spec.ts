import { test, expect } from '@playwright/test';
import { ApiClient } from '../src/api/api-client';
import { CandidateApi } from '../src/api/candidate.api';
import { PositionApi } from '../src/api/position.api';
import { InterviewApi } from '../src/api/interview.api';
import { TestDataFactory } from '../src/fixtures/test-data.factory';
import { TestDataCleanup } from '../src/fixtures/test-data.cleanup';
import { assertSuccess, assertSuccessWithData } from '../src/helpers/assertions';
import { Logger } from '../src/helpers/logger';

const log = new Logger('interview');
let client: ApiClient;
let candidateApi: CandidateApi;
let positionApi: PositionApi;
let interviewApi: InterviewApi;
let cleanup: TestDataCleanup;

test.beforeAll(async () => {
  client = await new ApiClient().init();
  candidateApi = new CandidateApi(client);
  positionApi = new PositionApi(client);
  interviewApi = new InterviewApi(client);
  cleanup = new TestDataCleanup();
});

test.afterEach(async () => {
  await cleanup.cleanupAll(candidateApi, positionApi);
});

test.afterAll(async () => {
  await client.dispose();
});

test.describe.serial('面试管理全流程', () => {
  let candidateId: number;
  let positionId: number;
  let recommendationId: number;

  test('1. 前置准备: 创建候选人、岗位并推荐', async () => {
    test.slow();

    // 创建候选人
    const candidate = assertSuccessWithData(
      await candidateApi.create(TestDataFactory.candidateCreate({ skills: 'Java, Spring Boot, Vue' }))
    );
    candidateId = candidate.id;
    cleanup.trackCandidate(candidate.id);

    // 创建岗位
    const position = assertSuccessWithData(
      await positionApi.create(TestDataFactory.position({ requiredSkills: 'Java, Spring Boot' }))
    );
    positionId = position.id;
    cleanup.trackPosition(position.id);

    // 推荐候选人到岗位
    const recResult = await positionApi.recommend(positionId, {
      candidateId: candidateId,
      candidateName: candidate.name,
    });
    const rec = assertSuccessWithData(recResult);
    recommendationId = rec.id;

    expect(recommendationId).toBeGreaterThan(0);
    expect(rec.status).toBe('已推荐');
    log.info(`前置完成: candidate=${candidateId}, position=${positionId}, rec=${recommendationId}`);
  });

  test('2. 安排面试', async () => {
    const scheduleReq = TestDataFactory.interviewSchedule({
      recommendationId,
      candidateId,
      positionId,
    });
    log.info('安排面试', scheduleReq);

    const result = await interviewApi.schedule(scheduleReq);
    const data = assertSuccessWithData(result);

    expect(data.id).toBeGreaterThan(0);
    expect(data.recommendationId).toBe(recommendationId);
    expect(data.candidateId).toBe(candidateId);
    expect(data.positionId).toBe(positionId);
    expect(data.status).toBeDefined();
    log.info(`面试安排成功: id=${data.id}, status=${data.status}`);
  });

  test('3. 获取面试详情', async () => {
    // 先安排面试
    const scheduled = assertSuccessWithData(
      await interviewApi.schedule(TestDataFactory.interviewSchedule({ recommendationId, candidateId, positionId }))
    );

    const result = await interviewApi.getById(scheduled.id);
    const data = assertSuccessWithData(result);

    expect(data.id).toBe(scheduled.id);
    expect(data.round).toBe(1);
    expect(data.interviewType).toBe('现场');
    expect(data.feedbacks).toBeDefined();
    log.info(`面试详情: round=${data.round}, type=${data.interviewType}`);
  });

  test('4. 按候选人查询面试记录', async () => {
    // 先安排一个面试
    await interviewApi.schedule(TestDataFactory.interviewSchedule({ recommendationId, candidateId, positionId }));

    const result = await interviewApi.getByCandidate(candidateId);
    const data = assertSuccessWithData(result);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    log.info(`候选人面试记录: ${data.length} 条`);
  });

  test('5. 按推荐记录查询面试', async () => {
    await interviewApi.schedule(TestDataFactory.interviewSchedule({ recommendationId, candidateId, positionId }));

    const result = await interviewApi.getByRecommendation(recommendationId);
    const data = assertSuccessWithData(result);

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    log.info(`推荐记录面试: ${data.length} 条`);
  });

  test('6. 更新面试状态', async () => {
    const scheduled = assertSuccessWithData(
      await interviewApi.schedule(TestDataFactory.interviewSchedule({ recommendationId, candidateId, positionId }))
    );

    const result = await interviewApi.updateStatus(scheduled.id, '进行中');
    assertSuccess(result);
    log.info(`面试状态更新: id=${scheduled.id}`);
  });

  test('7. 提交面试反馈', async () => {
    const scheduled = assertSuccessWithData(
      await interviewApi.schedule(TestDataFactory.interviewSchedule({ recommendationId, candidateId, positionId }))
    );

    const feedbackReq = TestDataFactory.interviewFeedback(scheduled.id);
    const result = await interviewApi.submitFeedback(feedbackReq);
    const data = assertSuccessWithData(result);

    expect(data.interviewId).toBe(scheduled.id);
    expect(data.interviewer).toBe(feedbackReq.interviewer);
    expect(data.overallScore).toBe(feedbackReq.overallScore);
    expect(data.result).toBe('通过');
    log.info(`反馈提交: score=${data.overallScore}`);
  });

  test('8. 查询面试反馈列表', async () => {
    const scheduled = assertSuccessWithData(
      await interviewApi.schedule(TestDataFactory.interviewSchedule({ recommendationId, candidateId, positionId }))
    );

    // 提交反馈
    await interviewApi.submitFeedback(TestDataFactory.interviewFeedback(scheduled.id));

    const result = await interviewApi.getFeedbacks(scheduled.id);
    const data = assertSuccessWithData(result);

    expect(data.length).toBeGreaterThanOrEqual(1);
    log.info(`反馈列表: ${data.length} 条`);
  });

  test('9. 完成面试', async () => {
    const scheduled = assertSuccessWithData(
      await interviewApi.schedule(TestDataFactory.interviewSchedule({ recommendationId, candidateId, positionId }))
    );

    const result = await interviewApi.complete(scheduled.id);
    assertSuccess(result);
    log.info(`面试完成: id=${scheduled.id}`);
  });
});
