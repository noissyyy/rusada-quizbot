import { useNavigate } from 'react-router-dom';
import { api } from '../data/api';
import { useAsync } from '../lib/useAsync';
import { haptic } from '../lib/telegram/webapp';
import { Screen } from '../components/Screen';
import { Button, SectionHeader, Skeleton } from '../components/ui';
import { HomeHeader } from '../components/home/HomeHeader';
import { HeroBanner } from '../components/home/HeroBanner';
import { ContinueCard } from '../components/home/ContinueCard';
import { ModeCard } from '../components/home/ModeCard';
import { TopicCard } from '../components/home/TopicCard';

export function HomeScreen() {
  const state = useAsync(() => api().getHomeFeed());
  const nav = useNavigate();

  if (state.status === 'loading') return <HomeSkeleton />;
  if (state.status === 'error') {
    return (
      <Screen>
        <div role="alert" className="mt-24 text-center">
          <p className="text-heading font-bold">Не удалось загрузить данные</p>
          <p className="mt-1 text-caption text-muted">{state.error.message}</p>
          <Button className="mt-4" onClick={() => location.reload()}>Повторить</Button>
        </div>
      </Screen>
    );
  }

  const feed = state.data;
  return (
    <Screen className="space-y-6">
      <HomeHeader user={feed.user} unread={feed.unreadNotifications} />
      <HeroBanner onStart={() => { haptic.tap(); nav('/topics'); }} />

      {feed.continueAttempt && (
        <ContinueCard attempt={feed.continueAttempt} onContinue={() => nav(`/quiz/${feed.continueAttempt!.sessionId}`)} />
      )}

      <section aria-labelledby="modes-title">
        <div id="modes-title"><SectionHeader title="Режимы" /></div>
        <div className="space-y-2.5">
          {feed.modes.map((m) => (
            <ModeCard key={m.mode} info={m} onSelect={(mode) => nav(`/mode/${mode}`)} />
          ))}
        </div>
      </section>

      <section aria-label="Популярные темы">
        <SectionHeader
          title="Популярные темы"
          action={<button type="button" onClick={() => nav('/topics')} className="text-caption font-semibold text-primary">Все темы</button>}
        />
        <div className="grid grid-cols-2 gap-3">
          {feed.featuredTopics.map((t) => (
            <TopicCard key={t.id} topic={t} onOpen={(tp) => nav(`/topics/${tp.slug}`)} />
          ))}
        </div>
      </section>
    </Screen>
  );
}

function HomeSkeleton() {
  return (
    <Screen className="space-y-6" >
      <div aria-busy="true" aria-label="Загрузка" className="space-y-6">
        <div className="flex justify-between"><Skeleton className="h-9 w-40" /><Skeleton className="size-11" /></div>
        <div className="flex items-center gap-3"><Skeleton className="size-12 rounded-full" /><Skeleton className="h-10 w-48" /></div>
        <Skeleton className="h-48 rounded-hero" />
        <Skeleton className="h-20" />
        <div className="space-y-2.5"><Skeleton className="h-[76px]" /><Skeleton className="h-[76px]" /><Skeleton className="h-[76px]" /></div>
      </div>
    </Screen>
  );
}
