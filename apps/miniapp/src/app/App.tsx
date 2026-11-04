import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { useI18n } from '../lib/i18n';
import { HomeScreen } from '../screens/HomeScreen';
import { LanguageScreen } from '../screens/LanguageScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { TestsScreen } from '../screens/TestsScreen';
import { TopicScreen } from '../screens/TopicScreen';
import { TestDetailsScreen } from '../screens/TestDetailsScreen';
import { QuizScreen } from '../screens/QuizScreen';
import { TimeUpScreen } from '../screens/TimeUpScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { ReviewScreen } from '../screens/ReviewScreen';
import { RatingScreen } from '../screens/RatingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ShareResultScreen } from '../screens/ShareResultScreen';
import { GroupHubScreen, GroupJoinScreen, GroupResultScreen } from '../screens/GroupScreens';
import { LiveHubScreen, LiveRoomScreen } from '../screens/LiveScreens';
import { OfflineBanner } from '../components/states/OfflineBanner';
import { getStartParam, routeForStart } from '../lib/telegram/webapp';

/** Screens where the floating nav is hidden (active test, live, onboarding). */
const NAVLESS = [/^\/quiz\//, /^\/timeup\//, /^\/result\//, /^\/tests\/./, /^\/live/, /^\/language/, /^\/group/, /^\/notifications/];
const SPLASH_MS = 900;

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
  return (
    <>
      <Routes>
        <Route path="/" element={chosen ? <HomeScreen /> : <Navigate to="/language" replace />} />
        <Route path="/language" element={<LanguageScreen />} />
        <Route path="/tests" element={<TestsScreen />} />
        <Route path="/topics/:slug" element={<TopicScreen />} />
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
        <Route path="/rating" element={<RatingScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
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
      <Shell />
    </BrowserRouter>
  );
}
