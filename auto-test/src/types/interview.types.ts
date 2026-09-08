/** 面试记录 */
export interface InterviewDTO {
  id: number;
  recommendationId: number;
  candidateId: number;
  positionId: number;
  round: number;
  interviewType: string;
  status: string;
  scheduledAt?: string;
  interviewer?: string;
  durationMinutes?: number;
  locationOrLink?: string;
  aiGeneratedQuestions?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  candidateName?: string;
  positionTitle?: string;
  positionDepartment?: string;
  feedbacks: InterviewFeedback[];
}

/** 面试反馈 */
export interface InterviewFeedback {
  id: number;
  interviewId: number;
  interviewer: string;
  overallScore?: number;
  technicalScore?: number;
  communicationScore?: number;
  teamworkScore?: number;
  strength?: string;
  weakness?: string;
  evaluation?: string;
  result: string;
  suggestedRound?: number;
  createdAt: string;
}

/** 安排面试请求 */
export interface InterviewScheduleRequest {
  recommendationId: number;
  candidateId: number;
  positionId: number;
  round: number;
  interviewType: string;
  scheduledAt?: string;
  interviewer?: string;
  durationMinutes?: number;
  locationOrLink?: string;
  remark?: string;
}

/** 提交面试反馈请求 */
export interface InterviewFeedbackSubmitRequest {
  interviewId: number;
  interviewer: string;
  overallScore?: number;
  technicalScore?: number;
  communicationScore?: number;
  teamworkScore?: number;
  strength?: string;
  weakness?: string;
  evaluation?: string;
  result: string;
  suggestedRound?: number;
}
