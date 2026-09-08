/** 岗位 */
export interface Position {
  id: number;
  title: string;
  department?: string;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string;
  description?: string;
  educationRequirement?: string;
  experienceMin?: number;
  experienceMax?: number;
  requiredSkills?: string;
  responsibilities?: string;
  analysisDimensions?: string;
  createdAt: string;
}

/** 岗位推荐记录 */
export interface PositionRecommendation {
  id: number;
  positionId: number;
  candidateId: number;
  candidateName: string;
  candidatePosition?: string;
  status: string;
  remark?: string;
  createdAt: string;
}

/** 候选人推荐记录（含岗位信息） */
export interface CandidateRecommendation {
  id: number;
  positionId: number;
  positionTitle: string;
  positionDepartment?: string;
  candidateId: number;
  candidateName: string;
  candidatePosition?: string;
  status: string;
  remark?: string;
  createdAt: string;
}
