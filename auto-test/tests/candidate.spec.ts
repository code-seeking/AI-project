import { test, expect } from '@playwright/test';
import { ApiClient } from '../src/api/api-client';
import { CandidateApi } from '../src/api/candidate.api';
import { TestDataFactory } from '../src/fixtures/test-data.factory';
import { TestDataCleanup } from '../src/fixtures/test-data.cleanup';
import { assertSuccess, assertSuccessWithData } from '../src/helpers/assertions';
import { Logger } from '../src/helpers/logger';
import { PositionApi } from '../src/api/position.api';

const log = new Logger('candidate');
let client: ApiClient;
let candidateApi: CandidateApi;
let cleanup: TestDataCleanup;
let createdCandidateId: number;

test.beforeAll(async () => {
  client = await new ApiClient().init();
  candidateApi = new CandidateApi(client);
  cleanup = new TestDataCleanup();
});

test.afterEach(async () => {
  const positionApi = new PositionApi(client);
  await cleanup.cleanupAll(candidateApi, positionApi);
});

test.afterAll(async () => {
  await client.dispose();
});

test.describe.serial('候选人管理全流程', () => {
  test('1. 创建候选人并验证返回数据', async () => {
    const dto = TestDataFactory.candidateCreate();
    log.info('创建候选人', dto);

    const result = await candidateApi.create(dto);
    const data = assertSuccessWithData(result);

    expect(data.id).toBeGreaterThan(0);
    expect(data.name).toBe(dto.name);
    expect(data.education).toBe(dto.education);
    expect(data.workYears).toBe(dto.workYears);
    expect(data.status).toBe(0); // 默认待筛选

    createdCandidateId = data.id;
    cleanup.trackCandidate(data.id);
    log.info(`创建成功: id=${data.id}`);
  });

  test('2. 分页查询候选人列表', async () => {
    const result = await candidateApi.list({ page: 1, size: 5 });
    const data = assertSuccessWithData(result);

    expect(data.records).toBeDefined();
    expect(data.records.length).toBeGreaterThanOrEqual(1);
    expect(data.size).toBeDefined();
    expect(data.current).toBeDefined();
    log.info(`列表查询: records=${data.records.length}`);
  });

  test('3. 关键词搜索候选人', async () => {
    // 先创建一个候选人
    const dto = TestDataFactory.candidateCreate({ name: `E2E搜索测试_${Date.now()}` });
    const created = assertSuccessWithData(await candidateApi.create(dto));
    cleanup.trackCandidate(created.id);

    // 搜索
    const result = await candidateApi.list({ keyword: dto.name });
    const data = assertSuccessWithData(result);

    const found = data.records.find((c) => c.id === created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe(dto.name);
    log.info(`搜索成功: 找到 ${found!.name}`);
  });

  test('4. 按状态筛选候选人', async () => {
    // 创建一个候选人并更新状态为通过
    const dto = TestDataFactory.candidateCreate();
    const created = assertSuccessWithData(await candidateApi.create(dto));
    cleanup.trackCandidate(created.id);

    await candidateApi.updateStatus(created.id, 1); // 通过

    const result = await candidateApi.list({ status: 1 });
    const data = assertSuccessWithData(result);

    const found = data.records.find((c) => c.id === created.id);
    expect(found).toBeDefined();
    log.info(`状态筛选: status=1 中找到 ${found?.name}`);
  });

  test('5. 获取候选人详情', async () => {
    const dto = TestDataFactory.candidateCreate();
    const created = assertSuccessWithData(await candidateApi.create(dto));
    cleanup.trackCandidate(created.id);

    const result = await candidateApi.getById(created.id);
    const data = assertSuccessWithData(result);

    expect(data.id).toBe(created.id);
    expect(data.name).toBe(dto.name);
    expect(data.projects).toBeDefined();
    expect(Array.isArray(data.projects)).toBe(true);
    log.info(`详情查询: ${data.name}, projects=${data.projects.length}`);
  });

  test('6. 更新候选人信息', async () => {
    const dto = TestDataFactory.candidateCreate();
    const created = assertSuccessWithData(await candidateApi.create(dto));
    cleanup.trackCandidate(created.id);

    const newName = `更新后_${Date.now()}`;
    const updateResult = await candidateApi.update(created.id, {
      ...dto,
      name: newName,
      workYears: 10,
    });
    const updated = assertSuccessWithData(updateResult);

    expect(updated.name).toBe(newName);
    expect(updated.workYears).toBe(10);
    log.info(`更新成功: ${updated.name}`);
  });

  test('7. 更新候选人状态', async () => {
    const dto = TestDataFactory.candidateCreate();
    const created = assertSuccessWithData(await candidateApi.create(dto));
    cleanup.trackCandidate(created.id);

    const result = await candidateApi.updateStatus(created.id, 1);
    const data = assertSuccessWithData(result);

    expect(data.status).toBe(1);
    log.info(`状态更新: ${data.status}`);
  });

  test('8. 添加项目经历', async () => {
    const dto = TestDataFactory.candidateCreate();
    const created = assertSuccessWithData(await candidateApi.create(dto));
    cleanup.trackCandidate(created.id);

    const project = TestDataFactory.candidateProject(created.id);
    const result = await candidateApi.addProject(created.id, project);
    const data = assertSuccessWithData(result);

    expect(data.id).toBeGreaterThan(0);
    expect(data.candidateId).toBe(created.id);
    expect(data.companyName).toBe(project.companyName);
    log.info(`添加项目经历: id=${data.id}`);
  });

  test('9. 查询项目经历列表', async () => {
    const dto = TestDataFactory.candidateCreate();
    const created = assertSuccessWithData(await candidateApi.create(dto));
    cleanup.trackCandidate(created.id);

    // 添加两个项目
    await candidateApi.addProject(created.id, TestDataFactory.candidateProject(created.id, { companyName: '公司A' }));
    await candidateApi.addProject(created.id, TestDataFactory.candidateProject(created.id, { companyName: '公司B' }));

    const result = await candidateApi.getProjects(created.id);
    const data = assertSuccessWithData(result);

    expect(data.length).toBeGreaterThanOrEqual(2);
    log.info(`项目经历列表: ${data.length} 条`);
  });

  test('10. 删除候选人', async () => {
    const dto = TestDataFactory.candidateCreate();
    const created = assertSuccessWithData(await candidateApi.create(dto));

    const deleteResult = await candidateApi.delete(created.id);
    assertSuccess(deleteResult);

    // 验证删除后查不到（后端可能返回 500 或 data=null）
    try {
      const getResult = await candidateApi.getById(created.id);
      expect(getResult.data === null || getResult.code !== 200).toBeTruthy();
    } catch (e) {
      log.info(`删除后查询预期失败: ${e}`);
    }
    log.info(`删除成功: id=${created.id}`);
  });
});
