/**
 * 异步操作轮询工具
 * 用于等待 AI 匹配、报告生成等异步操作完成
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (result: T) => boolean,
  options: { intervalMs?: number; timeoutMs?: number; description?: string } = {}
): Promise<T> {
  const { intervalMs = 2000, timeoutMs = 60000, description = 'condition' } = options;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await fn();
    if (predicate(result)) return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Polling timeout: ${description} not met within ${timeoutMs}ms`);
}

/**
 * 等待指定毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
