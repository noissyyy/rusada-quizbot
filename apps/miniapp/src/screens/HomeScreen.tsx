import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { Screen } from '../components/Screen';
import { Avatar, Skeleton } from '../components/ui';
import { ErrorView } from '../components/states/StateViews';
import { HomeHeader } from '../components/home/HomeHeader';
import { StartCard } from '../components/home/StartCard';
import { ContinueCard } from '../components/home/ContinueCard';
import { TestRow } from '../components/home/TestRow';
import { ModeTile } from '../components/home/ModeTile';
import { Link } from 'react-router-dom';

export function HomeScreen() {
  const state = useAsync(() => api().getHomeFeed());
  const { t } = useI18n();

  if (state.status === 'loading') return <HomeSkeleton label={t('loading')} />;
  if (state.status === 'error') {
    return <ErrorView error={state.error} onRetry={state.reload} />;
  }

  const feed = state.data;
  const fullName = [feed.user.firstName, feed.user.lastName].filter(Boolean).join(' ');
  return (
    <Screen className="flex flex-col gap-5">
      <HomeHeader unread={feed.unreadNotifications} />
      <section className="flex items-center gap-3">
        <Avatar name={fullName} src={feed.user.photoUrl} size={52} />
        <h1 className="font-display text-display font-bold tracking-tight">{t('home.greeting', { name: feed.user.firstName })}</h1>
      </section>

      {feed.quickStart && <StartCard quick={feed.quickStart} />}
      {feed.continueAttempt && <ContinueCard attempt={feed.continueAttempt} />}

      <section className="mt-1.5 flex flex-col gap-3" aria-labelledby="popular-title">
        <div className="flex items-center justify-between">
          <h2 id="popular-title" className="font-display text-title font-bold tracking-tight">{t('home.popular')}</h2>
          <Link to="/tests" className="text-[14px] font-bold text-primary">{t('home.allTests')}</Link>
        </div>
        {feed.popularTests.map((test) => <TestRow key={test.id} test={test} />)}
      </section>

      <section className="mt-1.5 flex flex-col gap-3" aria-labelledby="modes-title">
        <h2 id="modes-title" className="font-display text-title font-bold tracking-tight">{t('home.modes')}</h2>
        <div className="grid grid-cols-3 gap-2.5">
          <ModeTile mode="individual" />
          <ModeTile mode="live" live={feed.liveNow > 0} />
          <ModeTile mode="group" />
        </div>
      </section>
    </Screen>
  );
}

function HomeSkeleton({ label }: { label: string }) {
  return (
    <Screen>
      <div aria-busy="true" aria-label={label} className="flex flex-col gap-5">
        <div className="flex justify-between"><Skeleton className="h-11 w-36" /><Skeleton className="h-11 w-28" /></div>
        <div className="flex items-center gap-3"><Skeleton className="size-[52px] rounded-full" /><Skeleton className="h-8 w-52" /></div>
        <Skeleton className="h-[140px] rounded-hero" />
        <Skeleton className="h-24" />
        <Skeleton className="h-[78px]" /><Skeleton className="h-[78px]" /><Skeleton className="h-[78px]" />
      </div>
    </Screen>
  );
}
