/** 候选人 */
export interface Candidate {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  idCard?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  maritalStatus?: number;
  nationality?: string;
  gender: number;
  age?: number;
  education?: string;
  school?: string;
  major?: string;
  workYears: number;
  currentCompany?: string;
  currentPosition?: string;
  expectedPosition?: string;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  skills?: string;
  status: number;
  source?: string;
  resumeUrl?: string;
  remark?: string;
  createdAt: string;
}

/** 候选人项目经历 */
export interface CandidateProject {
  id: number;
  candidateId: number;
  companyName: string;
  department?: string;
  position: string;
  startDate: string;
  endDate?: string;
  projectName?: string;
  projectRole?: string;
  projectDescription?: string;
  techStack?: string;
  achievements?: string;
  leaveReason?: string;
}

/** 候选人详情（含项目） */
export interface CandidateDetail extends Candidate {
  projects: CandidateProject[];
}

/** 候选人创建/编辑 DTO */
export interface CandidateCreateDTO {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  gender?: number;
  age?: number;
  education?: string;
  school?: string;
  major?: string;
  workYears?: number;
  currentCompany?: string;
  currentPosition?: string;
  expectedPosition?: string;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  skills?: string;
  source?: string;
  resumeUrl?: string;
  remark?: string;
  idCard?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  maritalStatus?: number;
  nationality?: string;
  projects?: CandidateProject[];
}
