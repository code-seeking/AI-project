import { ApiClient } from './api-client';
import { ApiResult } from '../types/api.types';
import { EvaluateRequest, MatchResult } from '../types/matching.types';

export class MatchingApi {
  constructor(private client: ApiClient) {}

  async evaluate(request: EvaluateRequest): Promise<ApiResult<MatchResult>> {
    return this.client.post<MatchResult>('/match/evaluate', request);
  }

  async getByCandidate(candidateId: number, limit = 10): Promise<ApiResult<MatchResult[]>> {
    return this.client.get<MatchResult[]>(`/match/candidate/${candidateId}`, { limit });
  }

  async getByPosition(positionId: number, limit = 10): Promise<ApiResult<MatchResult[]>> {
    return this.client.get<MatchResult[]>(`/match/position/${positionId}`, { limit });
  }

  async findSuggestedPositions(candidateId: number, limit = 5): Promise<ApiResult<MatchResult[]>> {
    return this.client.get<MatchResult[]>('/match/suggested-positions', { candidateId, limit });
  }
}
