import { expect } from '@playwright/test';
import { ApiResult } from '../types/api.types';

/**
 * 断言 API 响应为成功状态 (code=200)
 * @returns data 字段
 */
export function assertSuccess<T>(result: ApiResult<T>): T {
  expect(result.code, `Expected code=200 but got ${result.code}, message: ${result.message}`).toBe(200);
  return result.data;
}

/**
 * 断言 API 响应为错误状态
 */
export function assertError(result: ApiResult<unknown>, expectedCode?: number): void {
  if (expectedCode !== undefined) {
    expect(result.code).toBe(expectedCode);
  } else {
    expect(result.code).not.toBe(200);
  }
}

/**
 * 断言 API 响应 code=200 且 data 非 null
 */
export function assertSuccessWithData<T>(result: ApiResult<T>): T {
  const data = assertSuccess(result);
  expect(data).toBeTruthy();
  return data;
}
