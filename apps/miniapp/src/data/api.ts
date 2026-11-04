import type { HomeFeed } from '@rq/shared-types';

/**
 * API boundary. Screens depend on this interface only; `mockApi` is swapped for
 * an HTTP implementation (FastAPI, `Authorization: tma <initData>`) in Phase 3.
 */
export interface QuizApi {
  getHomeFeed(): Promise<HomeFeed>;
}

let impl: QuizApi | null = null;
export function setApi(api: QuizApi) { impl = api; }
export function api(): QuizApi {
  if (!impl) throw new Error('QuizApi not configured — call setApi() in main.tsx');
  return impl;
}
