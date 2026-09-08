/** 通用 API 响应信封 */
export interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

/** 分页响应（MyBatis-Plus Page 格式） */
export interface PageResult<T> {
  records: T[];
  total: number;
  pages: number;
  size: number;
  current: number;
}

/** 全量分析任务进度 */
export interface TaskProgress {
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  message: string;
}
