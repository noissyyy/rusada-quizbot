import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { useI18n } from '../lib/i18n';
import { HomeScreen } from '../screens/HomeScreen';
import { LanguageScreen } from '../screens/LanguageScreen';
import { SPLASH_ANIMATION_MS, SplashScreen } from '../screens/SplashScreen';
import { TestsScreen } from '../screens/TestsScreen';
import { TopicScreen, WorkScreen } from '../screens/TopicScreen';
import { TestDetailsScreen } from '../screens/TestDetailsScreen';
import { QuizScreen } from '../screens/QuizScreen';
import { TimeUpScreen } from '../screens/TimeUpScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { RatingScreen } from '../screens/RatingScreen';
import { HistoryScreen, ProfileScreen } from '../screens/ProfileScreen';
import { BookScreen, BooksScreen } from '../screens/BooksScreens';
import { PaywallScreen } from '../screens/PaywallScreen';
import { MistakesScreen } from '../screens/MistakesScreen';
import { WordGameScreen } from '../screens/WordGameScreen';
import { StressGameScreen } from '../screens/StressGameScreen';
import { DuelHubScreen, DuelScreen } from '../screens/DuelScreens';
import { ReviewScreen } from '../screens/ReviewScreen';
import { AccessProvider, useAccess } from '../lib/access';
import { ReaderScreen } from '../screens/ReaderScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ShareResultScreen } from '../screens/ShareResultScreen';
import { GroupHubScreen, GroupJoinScreen, GroupResultScreen } from '../screens/GroupScreens';
import { LiveHubScreen, LiveRoomScreen } from '../screens/LiveScreens';
import { OfflineBanner } from '../components/states/OfflineBanner';
import { getStartParam, routeForStart } from '../lib/telegram/webapp';

/** Screens where the floating nav is hidden (active test, live, onboarding). */
const NAVLESS = [/^\/quiz\//, /^\/timeup\//, /^\/result\//, /^\/tests\/./, /^\/live/, /^\/language/, /^\/group/, /^\/notifications/, /^\/books\/.+\/read/, /^\/subscribe/, /^\/mistakes/, /^\/games\//, /^\/duel\//];
// full animation; reduced-motion users get a short splash
const SPLASH_MS = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 600 : SPLASH_ANIMATION_MS;

/** Opens the screen a deep link points to (group test, live, test), once per launch. */
function StartParamRedirect() {
  const nav = useNavigate();
  useEffect(() => {
    const to = routeForStart(getStartParam());
    if (to) nav(to, { replace: true });
  }, [nav]);
  return null;
}

function Shell() {
  const { pathname } = useLocation();
  const { chosen } = useI18n();
  const showNav = !NAVLESS.some((r) => r.test(pathname));
  const { access, reload } = useAccess();
  // closed for this person: only the subscription page (and the language switch) is available
  if (chosen && access && !access.hasAccess && !access.trial && pathname !== '/language') return <PaywallScreen access={access} onChanged={reload} />;
  return (
    <>
      <Routes>
        <Route path="/" element={chosen ? <HomeScreen /> : <Navigate to="/language" replace />} />
        <Route path="/language" element={<LanguageScreen />} />
        <Route path="/mistakes" element={<MistakesScreen />} />
        <Route path="/games/word" element={<WordGameScreen />} />
        <Route path="/games/stress" element={<StressGameScreen />} />
        <Route path="/games/duel" element={<DuelHubScreen />} />
        <Route path="/duel/:id" element={<DuelScreen />} />
        <Route path="/subscribe" element={access ? <PaywallScreen access={access} onChanged={reload} back /> : null} />
        <Route path="/tests" element={<TestsScreen />} />
        <Route path="/topics/:slug" element={<TopicScreen />} />
        <Route path="/topics/:slug/works/:workId" element={<WorkScreen />} />
        <Route path="/tests/:id" element={<TestDetailsScreen />} />
        <Route path="/quiz/:id" element={<QuizScreen />} />
        <Route path="/timeup/:sid" element={<TimeUpScreen />} />
        <Route path="/result/:sid" element={<ResultScreen />} />
        <Route path="/result/:sid/review" element={<ReviewScreen />} />
        <Route path="/result/:sid/share" element={<ShareResultScreen />} />
        <Route path="/live" element={<LiveHubScreen />} />
        <Route path="/live/:id" element={<LiveRoomScreen />} />
        <Route path="/group" element={<GroupHubScreen />} />
        <Route path="/group/:aid" element={<GroupJoinScreen />} />
        <Route path="/group/:aid/result" element={<GroupResultScreen />} />
        <Route path="/books" element={<BooksScreen />} />
        <Route path="/books/:id" element={<BookScreen />} />
        <Route path="/books/:id/read" element={<ReaderScreen />} />
        <Route path="/rating" element={<RatingScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/profile/history" element={<HistoryScreen />} />
        <Route path="/notifications" element={<NotificationsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
      {chosen && <StartParamRedirect />}
      <OfflineBanner />
    </>
  );
}

export function App() {
  const [booting, setBooting] = useState(true);
  useEffect(() => { const id = setTimeout(() => setBooting(false), SPLASH_MS); return () => clearTimeout(id); }, []);
  if (booting) return <SplashScreen />;
  return (
    <BrowserRouter>
      <AccessProvider>
        <Shell />
      </AccessProvider>
    </BrowserRouter>
  );
}
