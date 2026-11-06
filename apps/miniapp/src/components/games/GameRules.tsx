import { createContext, useContext, useState, type ReactNode } from 'react';
import { GAMES } from '../../lib/games';
import { useI18n } from '../../lib/i18n';
import type { MessageKey } from '../../lib/i18n/dict';
import { haptic } from '../../lib/telegram/webapp';
import { toneStyle, GradientDecor } from '../ui';

const KEY = 'rq-rules-off';
const readOff = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]; } catch { return []; } };
const writeOff = (v: string[]) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* this session only */ } };

const Ctx = createContext<(() => void) | null>(null);
/** Inside a game: opens its rules again (the «?» in ScreenHeader). */
export const useGameRules = () => useContext(Ctx);

/**
 * Shows how to play before the game itself mounts, so timers (memory peek, word search clock)
 * start only after the player has read it. «Don’t show again» is remembered per game on this device.
 */
export function GameRules(props: { game: string; children: ReactNode }) {
  // keyed: going from one game straight to another must not reuse the previous game's «already read» state
  return <RulesGate key={props.game} {...props} />;
}

function RulesGate({ game, children }: { game: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => !readOff().includes(game));
  const [started, setStarted] = useState(() => !open);
  const close = (hide: boolean) => {
    if (hide) writeOff([...new Set([...readOff(), game])]);
    setOpen(false); setStarted(true); haptic.tap();
  };
  return (
    <Ctx.Provider value={() => setOpen(true)}>
      {started && children}
      {open && <RulesSheet game={game} first={!started} onClose={close} />}
    </Ctx.Provider>
  );
}

function RulesSheet({ game, first, onClose }: { game: string; first: boolean; onClose: (hide: boolean) => void }) {
  const { t } = useI18n();
  const info = GAMES.find((g) => g.key === game);
  const [hide, setHide] = useState(readOff().includes(game));
  const steps = [1, 2, 3].map((n) => `rules.${game}.${n}` as MessageKey);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rules-title" className="fixed inset-0 z-50 flex items-end justify-center bg-night/55 backdrop-blur-[2px] sm:items-center">
      <div className="w-full max-w-[480px] overflow-hidden rounded-t-[28px] bg-canvas sm:rounded-[28px]" style={{ paddingBottom: 'calc(var(--safe-bottom) + 18px)' }}>
        <div style={toneStyle(info?.tone ?? 'primary')} className="relative h-[132px] overflow-hidden px-5 pt-5 text-white">
          <GradientDecor />
          {info && <img src={`/3d/rq-3d-${info.img}.webp`} alt="" className="absolute -bottom-3 right-3 size-[124px] object-contain" />}
          <span className="relative inline-flex h-7 items-center rounded-full bg-white/20 px-3 text-[12px] font-bold">{t('rules.badge')}</span>
          <h2 id="rules-title" className="relative mt-2 max-w-[62%] font-display text-[24px] font-extrabold leading-[28px]">{info ? t(info.title) : ''}</h2>
        </div>
        <ol className="flex flex-col gap-2.5 px-4 pt-4">
          {steps.map((k, i) => (
            <li key={k} className="flex gap-3 rounded-[18px] bg-surface p-3.5 shadow-card">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-[14px] font-extrabold text-white">{i + 1}</span>
              <span className="pt-1 text-[14px] leading-5 text-ink">{t(k)}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2 px-4 pt-4">
          <button type="button" onClick={() => onClose(hide)} className="h-14 rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{first ? t('rules.go') : t('rules.ok')}</button>
          <label className="flex h-10 cursor-pointer items-center justify-center gap-2 text-[13px] font-semibold text-ink-2">
            <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
            {t('rules.dontShow')}
          </label>
        </div>
      </div>
    </div>
  );
}
