import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ru, uz, type MessageKey } from './dict';
import { latinToCyrillic } from './translit';

export type Lang = 'uz' | 'uz-cyrl' | 'ru';
export const LANGS: Lang[] = ['uz', 'uz-cyrl', 'ru'];
export const LANG_NAMES: Record<Lang, string> = { uz: 'O‘zbekcha', 'uz-cyrl': 'Ўзбекча', ru: 'Русский' };

const STORAGE_KEY = 'rq.lang';
const uzCyrl = Object.fromEntries(Object.entries(uz).map(([k, v]) => [k, latinToCyrillic(v)])) as Record<MessageKey, string>;
const tables: Record<Lang, Record<MessageKey, string>> = { ru, uz, 'uz-cyrl': uzCyrl };

export function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(v as Lang) ? (v as Lang) : null;
  } catch {
    return null;
  }
}

/** Language before the user picks one: always Uzbek (Latin), whatever Telegram's language is. */
export function guessLang(_telegramCode?: string): Lang {
  return 'uz';
}

export function format(template: string, vars?: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars?.[k] ?? `{${k}}`));
}

interface I18n {
  lang: Lang;
  /** true once the user has chosen explicitly (first-launch screen is skipped) */
  chosen: boolean;
  setLang: (l: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children, initial, telegramCode }: { children: ReactNode; initial?: Lang; telegramCode?: string }) {
  const stored = initial ?? readStoredLang();
  const [lang, setLangState] = useState<Lang>(stored ?? guessLang(telegramCode));
  const [chosen, setChosen] = useState(stored !== null);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setChosen(true);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* storage may be blocked; choice lives for this session */ }
  }, []);

  const value = useMemo<I18n>(() => ({
    lang, chosen, setLang,
    t: (key, vars) => format(tables[lang][key], vars),
  }), [lang, chosen, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}
