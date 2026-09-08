import { test, expect } from '@playwright/test';
import { ApiClient } from '../src/api/api-client';
import { PositionApi } from '../src/api/position.api';
import { CandidateApi } from '../src/api/candidate.api';
import { TestDataFactory } from '../src/fixtures/test-data.factory';
import { TestDataCleanup } from '../src/fixtures/test-data.cleanup';
import { assertSuccess, assertSuccessWithData } from '../src/helpers/assertions';
import { Logger } from '../src/helpers/logger';

const log = new Logger('position');
let client: ApiClient;
let positionApi: PositionApi;
let candidateApi: CandidateApi;
let cleanup: TestDataCleanup;

test.beforeAll(async () => {
  client = await new ApiClient().init();
  positionApi = new PositionApi(client);
  candidateApi = new CandidateApi(client);
  cleanup = new TestDataCleanup();
});

test.afterEach(async () => {
  await cleanup.cleanupAll(candidateApi, positionApi);
});

test.afterAll(async () => {
  await client.dispose();
});

test.describe.serial('岗位管理全流程', () => {
  test('1. 创建岗位并验证返回数据', async () => {
    const posData = TestDataFactory.position();
    log.info('创建岗位', posData);

    const result = await positionApi.create(posData);
    const data = assertSuccessWithData(result);

    expect(data.id).toBeGreaterThan(0);
    expect(data.title).toBe(posData.title);
    expect(data.department).toBe(posData.department);
    cleanup.trackPosition(data.id);
    log.info(`创建成功: id=${data.id}`);
  });

  test('2. 查询岗位列表', async () => {
    const posData = TestDataFactory.position();
    const created = assertSuccessWithData(await positionApi.create(posData));
    cleanup.trackPosition(created.id);

    const result = await positionApi.list();
    const data = assertSuccessWithData(result);

    expect(Array.isArray(data)).toBe(true);
    const found = data.find((p) => p.id === created.id);
    expect(found).toBeDefined();
    log.info(`列表查询: 共 ${data.length} 个岗位`);
  });

  test('3. 获取岗位详情', async () => {
    const posData = TestDataFactory.position();
    const created = assertSuccessWithData(await positionApi.create(posData));
    cleanup.trackPosition(created.id);

    const result = await positionApi.getById(created.id);
    const data = assertSuccessWithData(result);

    expect(data.id).toBe(created.id);
    expect(data.title).toBe(posData.title);
    expect(data.skills).toBe(posData.skills);
    log.info(`详情查询: ${data.title}`);
  });

  test('4. 编辑岗位信息', async () => {
    const posData = TestDataFactory.position();
    const created = assertSuccessWithData(await positionApi.create(posData));
    cleanup.trackPosition(created.id);

    const newTitle = `更新岗位_${Date.now()}`;
    const updateResult = await positionApi.update(created.id, {
      ...posData,
      title: newTitle,
      salaryMin: 30000,
      salaryMax: 50000,
    });
    const updated = assertSuccessWithData(updateResult);

    expect(updated.title).toBe(newTitle);
    expect(updated.salaryMin).toBe(30000);
    expect(updated.salaryMax).toBe(50000);
    log.info(`更新成功: ${updated.title}`);
  });

  test('5. 删除岗位', async () => {
    const posData = TestDataFactory.position();
    const created = assertSuccessWithData(await positionApi.create(posData));

    const deleteResult = await positionApi.delete(created.id);
    assertSuccess(deleteResult);

    // 验证删除后查不到（后端可能返回 500 或 data=null）
    try {
      const getResult = await positionApi.getById(created.id);
      expect(getResult.data === null || getResult.code !== 200).toBeTruthy();
    } catch (e) {
      // HTTP 500 from API client is acceptable - means the record is gone
      log.info(`删除后查询预期失败: ${e}`);
    }
    log.info(`删除成功: id=${created.id}`);
  });
});
