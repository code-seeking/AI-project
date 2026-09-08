import { CandidateApi } from '../api/candidate.api';
import { PositionApi } from '../api/position.api';

/**
 * 测试数据清理工具
 * 跟踪测试中创建的资源 ID，在 afterEach 中统一清理
 */
export class TestDataCleanup {
  private candidateIds: number[] = [];
  private positionIds: number[] = [];

  trackCandidate(id: number): void {
    this.candidateIds.push(id);
  }

  trackPosition(id: number): void {
    this.positionIds.push(id);
  }

  async cleanupAll(candidateApi: CandidateApi, positionApi: PositionApi): Promise<void> {
    // 先清理候选人（可能关联推荐记录）
    for (const id of this.candidateIds) {
      try {
        await candidateApi.delete(id);
      } catch {
        // 忽略删除失败（可能已被删除）
      }
    }
    // 再清理岗位
    for (const id of this.positionIds) {
      try {
        await positionApi.delete(id);
      } catch {
        // 忽略删除失败
      }
    }
    this.candidateIds = [];
    this.positionIds = [];
  }

  reset(): void {
    this.candidateIds = [];
    this.positionIds = [];
  }
}
