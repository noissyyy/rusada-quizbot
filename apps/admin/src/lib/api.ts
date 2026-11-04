/** Admin API client. JWT from a bot login link, kept in localStorage for this browser only. */
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
const KEY = 'rq.admin.token';

export type Role = 'student' | 'host' | 'admin' | 'superadmin';
export interface AdminUser { id: string; telegramId: number; name: string; username: string | null; photoUrl: string | null; role: Role; isBlocked: boolean; tests: number; accuracy: number | null; lastSeenAt: string }

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function getToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try { if (token) localStorage.setItem(KEY, token); else localStorage.removeItem(KEY); } catch { /* private mode */ }
}

let onUnauthorized: () => void = () => undefined;
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

async function raw(method: string, path: string, body?: unknown, isForm = false): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body) });
  } catch {
    throw new HttpError(0, 'Нет связи с сервером');
  }
  if (res.status === 401) { setToken(null); onUnauthorized(); }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const d = data.detail;
    const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: { msg?: string }) => x.msg).join('; ') : res.statusText;
    throw new HttpError(res.status, msg || `Ошибка ${res.status}`);
  }
  return res;
}

export async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await raw(method, path, body);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const get = <T,>(p: string) => http<T>('GET', p);
export const post = <T,>(p: string, b: unknown = {}) => http<T>('POST', p, b);
export const put = <T,>(p: string, b: unknown) => http<T>('PUT', p, b);
export const patch = <T,>(p: string, b: unknown) => http<T>('PATCH', p, b);
export const del = <T,>(p: string) => http<T>('DELETE', p);

export async function upload<T>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await raw('POST', path, fd, true);
  return res.json() as Promise<T>;
}

/** Downloads a file response (export, template) through the browser. */
export async function download(method: 'GET' | 'POST', path: string, filename: string, body?: unknown) {
  const res = await raw(method, path, body);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function wsUrl(path: string) {
  const origin = BASE || location.origin;
  return origin.replace(/^http/, 'ws') + path;
}

export const roleName: Record<Role, string> = { student: 'Ученик', host: 'Ведущий', admin: 'Администратор', superadmin: 'Супер-администратор' };
export const roleRank: Record<Role, number> = { student: 0, host: 1, admin: 2, superadmin: 3 };
export const can = (u: AdminUser | null, need: Role) => Boolean(u && roleRank[u.role] >= roleRank[need]);

/** An authenticated image (e.g. a payment receipt) as an object URL for <img>. Revoke it when done. */
export async function blobUrl(path: string): Promise<string> {
  const res = await raw('GET', path);
  return URL.createObjectURL(await res.blob());
}
