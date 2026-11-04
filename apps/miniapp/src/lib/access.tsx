import type { AccessInfo } from '@rq/shared-types';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../data/api';

interface AccessCtx { access: AccessInfo | null; reload: () => void }
const Ctx = createContext<AccessCtx>({ access: null, reload: () => undefined });

/** Loads what this person may do; re-checks when any request says access has ended (402). */
export function AccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const reload = useCallback(() => { api().getAccess().then(setAccess, () => setAccess(null)); }, []);
  useEffect(() => {
    reload();
    window.addEventListener('rq:paywall', reload);
    return () => window.removeEventListener('rq:paywall', reload);
  }, [reload]);
  return <Ctx.Provider value={{ access, reload }}>{children}</Ctx.Provider>;
}

export const useAccess = () => useContext(Ctx);
