import { ApiClient } from './api-client';
import { ApiResult } from '../types/api.types';
import { Position, PositionRecommendation, CandidateRecommendation } from '../types/position.types';
import { MatchResult } from '../types/matching.types';

export class PositionApi {
  constructor(private client: ApiClient) {}

  async list(): Promise<ApiResult<Position[]>> {
    return this.client.get<Position[]>('/positions');
  }

  async getById(id: number): Promise<ApiResult<Position>> {
    return this.client.get<Position>(`/positions/${id}`);
  }

  async create(position: Partial<Position>): Promise<ApiResult<Position>> {
    return this.client.post<Position>('/positions', position);
  }

  async update(id: number, position: Partial<Position>): Promise<ApiResult<Position>> {
    return this.client.put<Position>(`/positions/${id}`, position);
  }

  async delete(id: number): Promise<ApiResult<void>> {
    return this.client.delete(`/positions/${id}`);
  }

  async recommend(
    positionId: number,
    rec: { candidateId: number; candidateName?: string; candidatePosition?: string; remark?: string }
  ): Promise<ApiResult<PositionRecommendation>> {
    return this.client.post<PositionRecommendation>(`/positions/${positionId}/recommend`, rec);
  }

  async getRecommendations(positionId: number): Promise<ApiResult<PositionRecommendation[]>> {
    return this.client.get<PositionRecommendation[]>(`/positions/${positionId}/recommendations`);
  }

  async getRecommendationsByCandidate(candidateId: number): Promise<ApiResult<CandidateRecommendation[]>> {
    return this.client.get<CandidateRecommendation[]>(`/positions/recommendations/candidate/${candidateId}`);
  }

  async getRecommendedCandidateIds(): Promise<ApiResult<number[]>> {
    return this.client.get<number[]>('/positions/recommendations/candidate-ids');
  }

  async getLatestPositionPerCandidate(): Promise<ApiResult<Record<string, string>>> {
    return this.client.get<Record<string, string>>('/positions/recommendations/latest-by-candidate');
  }

  async getMatchedCandidates(positionId: number, limit = 10): Promise<ApiResult<MatchResult[]>> {
    return this.client.get<MatchResult[]>(`/positions/${positionId}/matched-candidates`, { limit });
  }

  async triggerAutoMatch(positionId: number): Promise<ApiResult<string>> {
    return this.client.post<string>(`/positions/${positionId}/auto-match`);
  }
}
