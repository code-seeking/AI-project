import { ApiClient } from './api-client';
import { ApiResult } from '../types/api.types';
import { WorkflowPlan, WorkflowProgress, WorkflowConfirmRequest } from '../types/workflow.types';

export class WorkflowApi {
  constructor(private client: ApiClient) {}

  async execute(message: string, sessionId?: string): Promise<ApiResult<WorkflowProgress>> {
    return this.client.post<WorkflowProgress>('/workflow/execute', { message, sessionId });
  }

  async getProgress(sessionId: string, workflowId: string): Promise<ApiResult<WorkflowProgress>> {
    return this.client.get<WorkflowProgress>('/workflow/progress', { sessionId, workflowId });
  }

  async confirm(request: WorkflowConfirmRequest): Promise<ApiResult<WorkflowProgress>> {
    return this.client.post<WorkflowProgress>('/workflow/confirm', request);
  }

  async parsePlan(message: string, sessionId?: string): Promise<ApiResult<WorkflowPlan>> {
    return this.client.post<WorkflowPlan>('/workflow/parse', { message, sessionId });
  }
}
