/** 工作流计划 */
export interface WorkflowPlan {
  intent: string;
  steps: Array<{
    step: number;
    action: string;
    description: string;
  }>;
}

/** 工作流进度 */
export interface WorkflowProgress {
  workflowId: string;
  sessionId: string;
  status: string;
  currentStepIndex: number;
  totalSteps: number;
  steps?: Array<{
    step: number;
    action: string;
    status: string;
    result?: unknown;
  }>;
  requiresConfirmation?: boolean;
  message?: string;
}

/** 工作流确认请求 */
export interface WorkflowConfirmRequest {
  sessionId: string;
  workflowId: string;
  confirmed: boolean;
  additionalInput?: string;
}
