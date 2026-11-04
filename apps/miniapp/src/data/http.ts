import type { LiveState } from '@rq/shared-types';
import { getInitData } from '../lib/telegram/webapp';
import { ApiError, OfflineError, type QuizApi } from './api';

/**
 * FastAPI client. Every request carries the raw Telegram initData; the server
 * validates its signature. Outside Telegram, local development may set
 * VITE_DEV_TELEGRAM_ID (works only when the API runs with ALLOW_DEV_AUTH=1).
 */
export function createHttpApi(baseUrl: string): QuizApi {
  const base = baseUrl.replace(/\/$/, '');

  function authHeader(): string {
    const init = getInitData();
    if (init) return `tma ${init}`;
    const dev = import.meta.env.VITE_DEV_TELEGRAM_ID as string | undefined;
    return dev ? `dev ${dev}` : '';
  }

  async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers: { Authorization: authHeader(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new OfflineError();
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, typeof data.detail === 'string' ? data.detail : res.statusText);
    return data as T;
  }

  const get = <T,>(p: string) => req<T>('GET', p);
  const post = <T,>(p: string, b: unknown = {}) => req<T>('POST', p, b);

  return {
    getHomeFeed: () => get('/api/home'),
    getTopics: () => get('/api/topics'),
    getTopic: (slug) => get(`/api/topics/${encodeURIComponent(slug)}`),
    searchTests: (q) => get(`/api/tests?q=${encodeURIComponent(q)}`),
    getTest: (id) => get(`/api/tests/${encodeURIComponent(id)}`),
    startSession: (target) => post('/api/sessions', target),
    submitAnswer: (sid, questionId, optionId) => post(`/api/sessions/${sid}/answers`, { questionId, optionId }),
    finishSession: (sid, opts) => post(`/api/sessions/${sid}/finish`, opts),
    getResult: (sid) => get(`/api/sessions/${sid}/result`),

    getRating: (kind, period) => get(`/api/rating?kind=${kind}&period=${period}`),
    getProfile: () => get('/api/profile'),
    updateSettings: (patch) => req('PATCH', '/api/profile/settings', patch),
    getNotifications: () => get('/api/notifications'),
    readAllNotifications: () => post('/api/notifications/read-all'),

    getGroupHub: () => get('/api/group'),
    getGroupAssignment: (id) => get(`/api/group/${id}`),
    getGroupResult: (id) => get(`/api/group/${id}/result`),
    shareGroupResult: (id) => post(`/api/group/${id}/share`),

    listLive: () => get('/api/live'),
    joinLive: (code) => post('/api/live/join', { code }),
    getLive: (id) => get(`/api/live/${id}`),
    liveReady: (id) => post(`/api/live/${id}/ready`),
    liveAnswer: (id, index, optionId) => post(`/api/live/${id}/answer`, { index, optionId }),
    subscribeLive(id, onState) {
      let closed = false;
      let ws: WebSocket | null = null;
      let retry = 0;
      let ping: ReturnType<typeof setInterval> | undefined;
      // Fallback: while the socket is down (proxy without WebSocket, bad network) poll the state.
      const poll = setInterval(() => {
        if (ws?.readyState !== WebSocket.OPEN) req<LiveState>('GET', `/api/live/${id}`).then((s) => !closed && onState(s), () => undefined);
      }, 1500);
      const connect = () => {
        const url = `${base.replace(/^http/, 'ws') || location.origin.replace(/^http/, 'ws')}/api/live/${id}/ws`;
        try { ws = new WebSocket(url); } catch { ws = null; return; }
        ws.onopen = () => { retry = 0; ws?.send(authHeader()); ping = setInterval(() => ws?.send('ping'), 20_000); };
        ws.onmessage = (e) => { try { onState(JSON.parse(e.data as string) as LiveState); } catch { /* ignore */ } };
        ws.onclose = () => {
          clearInterval(ping);
          if (!closed) setTimeout(connect, Math.min(10_000, 500 * 2 ** retry++)); // reconnect → same question, no double score
        };
      };
      connect();
      return () => { closed = true; clearInterval(ping); clearInterval(poll); ws?.close(); };
    },
  };
}
