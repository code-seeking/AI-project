import { APIRequestContext, request as pwRequest, expect } from '@playwright/test';
import { ApiResult } from '../types/api.types';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 确保环境变量已加载 (使用 process.cwd() 因为 Playwright 编译后 __dirname 不可靠)
const env = process.env.ENV || 'local';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${env}`) });

/**
 * 核心 HTTP 客户端，封装 Playwright APIRequestContext
 * 统一处理后端 Result<T> 信封结构
 *
 * 注意: Playwright 的 baseURL 只做 origin 替换，会丢失路径部分。
 * 因此我们手动拼接完整 URL: baseUrl + endpointPath
 */
export class ApiClient {
  private ctx!: APIRequestContext;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || process.env.BASE_URL || 'http://localhost:8080/api').replace(/\/+$/, '');
  }

  async init(): Promise<ApiClient> {
    this.ctx = await pwRequest.newContext({
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });
    return this;
  }

  /** 拼接完整 URL: baseUrl + path */
  private url(endpointPath: string): string {
    return `${this.baseUrl}${endpointPath}`;
  }

  async get<T>(endpointPath: string, params?: Record<string, string | number>): Promise<ApiResult<T>> {
    const queryParams: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) queryParams[k] = String(v);
      }
    }
    const resp = await this.ctx.get(this.url(endpointPath), { params: queryParams });
    expect(resp.ok(), `GET ${endpointPath} failed: ${resp.status()}`).toBeTruthy();
    return resp.json() as Promise<ApiResult<T>>;
  }

  async post<T>(endpointPath: string, body?: unknown): Promise<ApiResult<T>> {
    const resp = await this.ctx.post(this.url(endpointPath), { data: body });
    expect(resp.ok(), `POST ${endpointPath} failed: ${resp.status()}`).toBeTruthy();
    return resp.json() as Promise<ApiResult<T>>;
  }

  async put<T>(endpointPath: string, body?: unknown): Promise<ApiResult<T>> {
    const resp = await this.ctx.put(this.url(endpointPath), { data: body });
    expect(resp.ok(), `PUT ${endpointPath} failed: ${resp.status()}`).toBeTruthy();
    return resp.json() as Promise<ApiResult<T>>;
  }

  async delete(endpointPath: string): Promise<ApiResult<void>> {
    const resp = await this.ctx.delete(this.url(endpointPath));
    expect(resp.ok(), `DELETE ${endpointPath} failed: ${resp.status()}`).toBeTruthy();
    return resp.json() as Promise<ApiResult<void>>;
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }
}
