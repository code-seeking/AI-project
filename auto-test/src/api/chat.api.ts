import { ApiClient } from './api-client';
import { ApiResult } from '../types/api.types';
import { ChatReply } from '../types/chat.types';

export class ChatApi {
  constructor(private client: ApiClient) {}

  async send(message: string, sessionId?: string): Promise<ApiResult<ChatReply>> {
    return this.client.post<ChatReply>('/chat/send', { message, sessionId });
  }

  async getHistory(sessionId: string): Promise<ApiResult<Array<Record<string, unknown>>>> {
    return this.client.get<Array<Record<string, unknown>>>('/chat/history', { sessionId });
  }
}
