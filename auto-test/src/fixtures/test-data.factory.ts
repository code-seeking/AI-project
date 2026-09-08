import { CandidateCreateDTO } from '../types/candidate.types';
import { Position } from '../types/position.types';
import { InterviewScheduleRequest, InterviewFeedbackSubmitRequest } from '../types/interview.types';

let counter = 0;
const uid = () => `E2E_${Date.now()}_${++counter}`;

export const TestDataFactory = {
  candidateCreate(overrides?: Partial<CandidateCreateDTO>): CandidateCreateDTO {
    const tag = uid();
    return {
      name: `测试候选人_${tag}`,
      phone: `1380000${String(counter).padStart(4, '0')}`,
      email: `test.${tag}@example.com`,
      gender: 1,
      age: 28,
      education: '本科',
      school: '测试大学',
      major: '计算机科学',
      workYears: 5,
      currentCompany: '测试科技有限公司',
      currentPosition: '高级开发工程师',
      expectedPosition: '技术经理',
      expectedSalaryMin: 25000,
      expectedSalaryMax: 35000,
      skills: 'Java, Spring Boot, MySQL, Redis, TypeScript',
      source: 'E2E测试',
      ...overrides,
    };
  },

  position(overrides?: Partial<Position>): Partial<Position> {
    const tag = uid();
    return {
      title: `测试岗位_${tag}`,
      department: '技术部',
      salaryMin: 20000,
      salaryMax: 40000,
      skills: 'Java, TypeScript, Playwright',
      description: 'E2E 测试岗位描述',
      educationRequirement: '本科',
      experienceMin: 3,
      experienceMax: 8,
      requiredSkills: 'Java, Spring Boot, 微服务',
      responsibilities: '负责后端开发与测试',
      ...overrides,
    };
  },

  candidateProject(candidateId: number, overrides?: Partial<Record<string, unknown>>) {
    return {
      candidateId,
      companyName: '项目经历公司',
      department: '技术部',
      position: '开发工程师',
      startDate: '2022-01-01',
      endDate: '2024-06-30',
      projectName: 'E2E测试项目',
      projectRole: '核心开发',
      projectDescription: '负责核心模块开发',
      techStack: 'Java, Spring Boot, Vue, MySQL',
      achievements: '按时交付项目',
      leaveReason: '寻求新发展',
      ...overrides,
    };
  },

  interviewSchedule(overrides: Partial<InterviewScheduleRequest> & {
    recommendationId: number;
    candidateId: number;
    positionId: number;
  }): InterviewScheduleRequest {
    return {
      round: 1,
      interviewType: '现场',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      interviewer: 'E2E面试官',
      durationMinutes: 60,
      locationOrLink: '会议室101',
      remark: 'E2E测试面试',
      ...overrides,
    };
  },

  interviewFeedback(interviewId: number, overrides?: Partial<InterviewFeedbackSubmitRequest>): InterviewFeedbackSubmitRequest {
    return {
      interviewId,
      interviewer: 'E2E评审员',
      overallScore: 85,
      technicalScore: 80,
      communicationScore: 90,
      teamworkScore: 85,
      strength: '技术能力扎实',
      weakness: '沟通表达可提升',
      evaluation: '综合评价良好',
      result: '通过',
      suggestedRound: 0,
      ...overrides,
    };
  },
};
