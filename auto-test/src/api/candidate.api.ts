import { ApiClient } from './api-client';
import { ApiResult, PageResult } from '../types/api.types';
import { Candidate, CandidateCreateDTO, CandidateDetail, CandidateProject } from '../types/candidate.types';

export class CandidateApi {
  constructor(private client: ApiClient) {}

  async create(dto: CandidateCreateDTO): Promise<ApiResult<Candidate>> {
    return this.client.post<Candidate>('/candidates', dto);
  }

  async update(id: number, dto: CandidateCreateDTO): Promise<ApiResult<Candidate>> {
    return this.client.put<Candidate>(`/candidates/${id}`, dto);
  }

  async list(params?: {
    status?: number;
    keyword?: string;
    page?: number;
    size?: number;
  }): Promise<ApiResult<PageResult<Candidate>>> {
    const query: Record<string, string | number> = {};
    if (params?.status !== undefined) query.status = params.status;
    if (params?.keyword) query.keyword = params.keyword;
    query.page = params?.page ?? 1;
    query.size = params?.size ?? 20;
    return this.client.get<PageResult<Candidate>>('/candidates', query);
  }

  async getById(id: number): Promise<ApiResult<CandidateDetail>> {
    return this.client.get<CandidateDetail>(`/candidates/${id}`);
  }

  async updateStatus(id: number, status: number): Promise<ApiResult<Candidate>> {
    return this.client.put<Candidate>(`/candidates/${id}/status?status=${status}`);
  }

  async delete(id: number): Promise<ApiResult<void>> {
    return this.client.delete(`/candidates/${id}`);
  }

  async addProject(id: number, project: Partial<CandidateProject>): Promise<ApiResult<CandidateProject>> {
    return this.client.post<CandidateProject>(`/candidates/${id}/projects`, project);
  }

  async getProjects(id: number): Promise<ApiResult<CandidateProject[]>> {
    return this.client.get<CandidateProject[]>(`/candidates/${id}/projects`);
  }

  async getStats(): Promise<ApiResult<Record<string, number>>> {
    return this.client.get<Record<string, number>>('/candidates/stats');
  }
}
