import { ApiClient } from './api-client';
import { ApiResult } from '../types/api.types';
import {
  InterviewDTO,
  InterviewScheduleRequest,
  InterviewFeedbackSubmitRequest,
  InterviewFeedback,
} from '../types/interview.types';

export class InterviewApi {
  constructor(private client: ApiClient) {}

  async schedule(request: InterviewScheduleRequest): Promise<ApiResult<InterviewDTO>> {
    return this.client.post<InterviewDTO>('/interviews/schedule', request);
  }

  async getById(id: number): Promise<ApiResult<InterviewDTO>> {
    return this.client.get<InterviewDTO>(`/interviews/${id}`);
  }

  async getByCandidate(candidateId: number): Promise<ApiResult<InterviewDTO[]>> {
    return this.client.get<InterviewDTO[]>(`/interviews/by-candidate/${candidateId}`);
  }

  async getByRecommendation(recommendationId: number): Promise<ApiResult<InterviewDTO[]>> {
    return this.client.get<InterviewDTO[]>(`/interviews/by-recommendation/${recommendationId}`);
  }

  async updateStatus(id: number, status: string): Promise<ApiResult<void>> {
    return this.client.put<void>(`/interviews/${id}/status?status=${encodeURIComponent(status)}`);
  }

  async submitFeedback(request: InterviewFeedbackSubmitRequest): Promise<ApiResult<InterviewFeedback>> {
    return this.client.post<InterviewFeedback>('/interviews/feedback', request);
  }

  async getFeedbacks(interviewId: number): Promise<ApiResult<InterviewFeedback[]>> {
    return this.client.get<InterviewFeedback[]>(`/interviews/${interviewId}/feedbacks`);
  }

  async complete(interviewId: number): Promise<ApiResult<void>> {
    return this.client.post<void>(`/interviews/${interviewId}/complete`);
  }

  async generateQuestions(positionId: number, count = 6): Promise<ApiResult<Array<Record<string, unknown>>>> {
    return this.client.post<Array<Record<string, unknown>>>(
      `/interviews/generate-questions?positionId=${positionId}&count=${count}`
    );
  }
}
