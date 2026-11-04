import { useNavigate } from 'react-router-dom';
import { Screen } from '../components/Screen';
import { Button } from '../components/ui';

/** Explicit "not built yet" screen so pending routes are visible, not silently broken. */
export function PlaceholderScreen({ title }: { title: string }) {
  const nav = useNavigate();
  return (
    <Screen>
      <div className="mt-24 text-center">
        <p className="text-title font-bold">{title}</p>
        <p className="mt-1 text-caption text-muted">Экран в разработке (Phase 1, следующий этап)</p>
        <Button variant="secondary" className="mt-4" onClick={() => nav('/')}>На главную</Button>
      </div>
    </Screen>
  );
}
