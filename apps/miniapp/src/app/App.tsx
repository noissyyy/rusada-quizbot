import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { useI18n } from '../lib/i18n';
import { HomeScreen } from '../screens/HomeScreen';
import { LanguageScreen } from '../screens/LanguageScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { TestsScreen } from '../screens/TestsScreen';
import { TopicScreen } from '../screens/TopicScreen';
import { TestDetailsScreen } from '../screens/TestDetailsScreen';
import { QuizScreen } from '../screens/QuizScreen';
import { TimeUpScreen } from '../screens/TimeUpScreen';
import { ResultScreen } from '../screens/ResultScreen';
import { ReviewScreen } from '../screens/ReviewScreen';

/** Screens where the floating nav is hidden (active test, live, onboarding). */
const NAVLESS = [/^\/quiz\//, /^\/timeup\//, /^\/result\//, /^\/tests\/./, /^\/live/, /^\/language/];
const SPLASH_MS = 900;

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
        <Route path="/live" element={<PlaceholderScreen title="Эфир" />} />
        <Route path="/group" element={<PlaceholderScreen title="Группа" />} />
        <Route path="/rating" element={<PlaceholderScreen title="Рейтинг" />} />
        <Route path="/profile" element={<PlaceholderScreen title="Профиль" />} />
        <Route path="/notifications" element={<PlaceholderScreen title="Уведомления" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
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
