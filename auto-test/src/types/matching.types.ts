/** 人岗匹配度评分结果 */
export interface MatchResult {
  id: number;
  candidateId: number;
  positionId: number;
  candidateName: string;
  positionTitle: string;
  overallScore?: number;
  skillScore?: number;
  experienceScore?: number;
  educationScore?: number;
  salaryFitScore?: number;
  skillAnalysis?: string;
  experienceAnalysis?: string;
  summary?: string;
  evaluatedAt?: string;
}

/** 匹配评估请求 */
export interface EvaluateRequest {
  candidateId: number;
  positionId: number;
  forceRefresh?: boolean;
}
