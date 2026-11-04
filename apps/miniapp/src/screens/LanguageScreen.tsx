import { api } from '../data/api';
import { clsx } from 'clsx';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LANGS, useI18n, type Lang } from '../lib/i18n';
import { Flag } from '../components/brand/Flag';
import { Screen } from '../components/Screen';
import { Button, Icon } from '../components/ui';

/** Each option is written in its own language so anyone can find theirs. */
const OPTIONS: Record<Lang, { name: string; script: string }> = {
  uz: { name: 'O‘zbekcha', script: 'Lotin alifbosi' },
  'uz-cyrl': { name: 'Ўзбекча', script: 'Кирилл алифбоси' },
  ru: { name: 'Русский', script: 'Русский язык' },
};

export function LanguageScreen() {
  const { lang, setLang, t } = useI18n();
  const [picked, setPicked] = useState<Lang>(lang);
  const nav = useNavigate();
  const lp = { uz: 'Tilni tanlang', 'uz-cyrl': 'Тилни танланг', ru: 'Выберите язык' } as const;
  const others = LANGS.filter((l) => l !== picked).map((l) => lp[l]).join(' · ');

  return (
    <Screen withNav={false} className="flex min-h-dvh flex-col gap-[22px]">
      <section className="flex flex-col items-center gap-2.5 pt-2 text-center">
        <img src="/brand/rusada-uc-square.png" alt="Rusada" className="size-[72px] rounded-[22px] object-cover shadow-brand" />
        <h1 className="mt-2 font-display text-[28px] font-bold leading-8 tracking-tight">{lp[picked]}</h1>
        <p className="text-[14px] text-muted">{others}</p>
      </section>

      <div role="radiogroup" aria-label={lp[picked]} className="flex flex-col gap-3">
        {LANGS.map((l) => {
          const on = picked === l;
          return (
            <button key={l} type="button" role="radio" aria-checked={on} onClick={() => setPicked(l)}
              className={clsx('flex items-center gap-3.5 rounded-[20px] border-2 px-4 py-3.5 text-left transition-colors',
                on ? 'border-primary bg-primary-50' : 'border-transparent bg-surface shadow-card')}>
              <Flag lang={l} />
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold">{OPTIONS[l].name}</span>
                <span className="block text-caption text-ink-2">{OPTIONS[l].script}</span>
              </span>
              <span aria-hidden className={clsx('grid size-6 place-items-center rounded-full', on ? 'bg-primary text-white' : 'border-2 border-line')}>
                {on && <Icon name="check" size={14} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <p className="flex gap-2.5 rounded-control bg-surface px-3.5 py-3 text-caption text-ink-2">
        <Icon name="sparkle" size={18} className="mt-0.5 shrink-0 text-primary" />
        {t('lang.note')}
      </p>

      <Button size="lg" block className="mt-auto" onClick={() => { setLang(picked); void api().updateSettings({ lang: picked }).catch(() => undefined); if ((window.history.state?.idx ?? 0) > 0) nav(-1); else nav('/', { replace: true }); }}>
        {t('lang.continue')}
      </Button>
    </Screen>
  );
}
