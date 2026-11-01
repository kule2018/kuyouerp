import request from '../utils/request';

/**
 * AI 模块前端 API
 * 路由基址由 request 的 baseURL('/kuyou') 统一拼接，最终为 /kuyou/ai/*
 */
export const aiChat = (payload: any) => request.post('/ai/chat', payload);
export const aiAgent = (payload: any) => request.post('/ai/agent', payload);
export const aiAnalyze = (payload: any) => request.post('/ai/analyze', payload);
export const aiRecognize = (payload: any) => request.post('/ai/recognize', payload);
export const aiRetrieve = (payload: any) => request.post('/ai/retrieve', payload);

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}
