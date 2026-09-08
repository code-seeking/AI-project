import { ApiClient } from './api-client';
import { ApiResult, TaskProgress } from '../types/api.types';
import { AnalysisReport, EnrichedReport, DashboardData } from '../types/report.types';

export class ReportApi {
  constructor(private client: ApiClient) {}

  async triggerFullAnalysis(): Promise<ApiResult<string>> {
    return this.client.post<string>('/reports/trigger');
  }

  async analyzeCandidate(candidateId: number): Promise<ApiResult<AnalysisReport>> {
    return this.client.post<AnalysisReport>(`/reports/candidate/${candidateId}/analyze`);
  }

  async getDaily(date?: string): Promise<ApiResult<AnalysisReport[]>> {
    const params: Record<string, string> = {};
    if (date) params.date = date;
    return this.client.get<AnalysisReport[]>('/reports/daily', params);
  }

  async getDailyEnriched(date?: string): Promise<ApiResult<EnrichedReport[]>> {
    const params: Record<string, string> = {};
    if (date) params.date = date;
    return this.client.get<EnrichedReport[]>('/reports/daily/enriched', params);
  }

  async getCandidateReport(candidateId: number): Promise<ApiResult<AnalysisReport>> {
    return this.client.get<AnalysisReport>(`/reports/candidate/${candidateId}`);
  }

  async getCandidateReportHistory(candidateId: number): Promise<ApiResult<AnalysisReport[]>> {
    return this.client.get<AnalysisReport[]>(`/reports/candidate/${candidateId}/history`);
  }

  async getTaskProgress(): Promise<ApiResult<TaskProgress>> {
    return this.client.get<TaskProgress>('/reports/task/progress');
  }

  async getDashboard(): Promise<ApiResult<DashboardData>> {
    return this.client.get<DashboardData>('/reports/dashboard');
  }
}
