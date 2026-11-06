import type { GameResultOut } from '@rq/shared-types';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';

/** End-of-round card shared by the single-player games: score, XP earned, best, again. */
export function GameOver({ title, score, detail, result, onAgain, img = 'R01' }: {
  title: string; score: number; detail?: string; result: GameResultOut | null; onAgain: () => void; img?: string;
}) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col items-center gap-2 rounded-hero bg-surface p-6 text-center shadow-card">
      <img src={`/3d/rq-3d-${img}.webp`} alt="" className="size-20 object-contain" />
      <b className="font-display text-[22px]">{title}</b>
      <span className="font-display text-[48px] font-extrabold leading-none tabular-nums">{score}</span>
      {detail && <span className="text-[14px] text-ink-2">{detail}</span>}
      {result && (
        <div className="mt-1 flex gap-2">
          <span className="rounded-full bg-primary-50 px-3 py-1 text-[13px] font-bold text-primary">{t('xp.earned', { n: result.xpEarned })}</span>
          <span className="rounded-full bg-canvas px-3 py-1 text-[13px] font-bold text-ink-2">{t('game.best', { n: result.best })}</span>
        </div>
      )}
      <button type="button" onClick={onAgain} className="mt-3 h-14 w-full rounded-control bg-primary text-[16px] font-bold text-white shadow-primary">{t('game.again')}</button>
      <Link to="/games" className="h-11 text-[15px] font-bold leading-[44px] text-ink">{t('game.toGames')}</Link>
    </section>
  );
}
