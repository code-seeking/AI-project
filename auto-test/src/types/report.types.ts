/** AI 分析报告 */
export interface AnalysisReport {
  id: number;
  candidateId: number;
  analysisDate: string;
  behaviorScore?: number;
  stabilityScore?: number;
  growthScore?: number;
  matchScore?: number;
  overallScore?: number;
  behaviorAnalysis?: string;
  strength?: string;
  weakness?: string;
  suggestion?: string;
  aiRawResponse?: string;
  createdAt: string;
}

/** 含候选人信息的报告（用于日报） */
export interface EnrichedReport {
  report: AnalysisReport;
  name: string;
  currentCompany?: string;
  currentPosition?: string;
  expectedPosition?: string;
  workYears?: number;
  education?: string;
}

/** Dashboard 数据 */
export interface DashboardData {
  funnel: Array<Record<string, unknown>>;
  monthlyTrend: Array<Record<string, unknown>>;
  sourceDistribution: Array<Record<string, unknown>>;
  anomalies: Array<Record<string, unknown>>;
  stats: {
    totalCandidates: number;
    totalPositions: number;
  };
}
