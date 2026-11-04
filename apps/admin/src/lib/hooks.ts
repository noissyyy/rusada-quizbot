import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AdminUser } from './api';

export type Load<T> = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ok'; data: T };

/** Fetch with reload(); keeps the previous data visible while reloading. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<Load<T>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    fn().then((data) => alive && setState({ status: 'ok', data }), (error: Error) => alive && setState({ status: 'error', error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload, setData: (data: T) => setState({ status: 'ok', data }) };
}

export const MeContext = createContext<AdminUser | null>(null);
export const useMe = () => useContext(MeContext);

type ToastFn = (msg: string, tone?: 'ok' | 'error') => void;
export const ToastContext = createContext<ToastFn>(() => undefined);
export const useToast = () => useContext(ToastContext);

export const fmtNum = (n: number) => n.toLocaleString('ru-RU');
export const fmtDate = (iso: string | null | undefined, withTime = true) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }) : '—';
export function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return 'сейчас';
  if (m < 60) return `${m} мин назад`;
  if (m < 1440) return `${Math.floor(m / 60)} ч назад`;
  if (m < 2880) return 'вчера';
  return fmtDate(iso, false);
}
