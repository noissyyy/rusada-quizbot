import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { HomeScreen } from '../screens/HomeScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';

/** Routes where the floating nav must be hidden (active quiz, lobby). */
const NAVLESS = [/^\/quiz\//, /^\/live\//];

function Shell() {
  const { pathname } = useLocation();
  const showNav = !NAVLESS.some((r) => r.test(pathname));
  return (
    <>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/topics" element={<PlaceholderScreen title="Темы" />} />
        <Route path="/topics/:slug" element={<PlaceholderScreen title="Тема" />} />
        <Route path="/mode/:mode" element={<PlaceholderScreen title="Режим" />} />
        <Route path="/quiz/:sessionId" element={<PlaceholderScreen title="Тест" />} />
        <Route path="/leaderboard" element={<PlaceholderScreen title="Рейтинг" />} />
        <Route path="/profile" element={<PlaceholderScreen title="Профиль" />} />
        <Route path="*" element={<PlaceholderScreen title="Страница не найдена" />} />
      </Routes>
      {showNav && <BottomNav />}
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
