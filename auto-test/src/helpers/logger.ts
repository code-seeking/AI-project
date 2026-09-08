/**
 * 结构化测试日志
 */
export class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  info(message: string, data?: unknown): void {
    console.log(`[INFO] [${this.prefix}] ${message}`, data !== undefined ? JSON.stringify(data) : '');
  }

  warn(message: string, data?: unknown): void {
    console.warn(`[WARN] [${this.prefix}] ${message}`, data !== undefined ? JSON.stringify(data) : '');
  }

  error(message: string, data?: unknown): void {
    console.error(`[ERROR] [${this.prefix}] ${message}`, data !== undefined ? JSON.stringify(data) : '');
  }

  debug(message: string, data?: unknown): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[DEBUG] [${this.prefix}] ${message}`, data !== undefined ? JSON.stringify(data) : '');
    }
  }
}
