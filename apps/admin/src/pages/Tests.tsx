import { useNavigate, useSearchParams } from 'react-router-dom';
import { can, get, post } from '../lib/api';
import { useLoad, useMe, useToast } from '../lib/hooks';
import type { QuizRow } from '../lib/types';
import { TestsManager } from '../components/TestsManager';
import { Button, Card, ErrorBox, PageHeader, Spinner } from '../components/ui';

export function TestsPage() {
  const me = useMe();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { state, reload } = useLoad(() => get<QuizRow[]>('/api/admin/tests'));
  const rows = state.status === 'ok' ? state.data : [];
  const editor = can(me, 'admin');
  const drafts = rows.filter((r) => r.status === 'draft');
  const publishDrafts = async () => {
    if (!confirm(`Опубликовать все черновики (${drafts.length})? Их вопросы тоже станут видны ученикам.`)) return;
    const r = await post<{ done: number }>('/api/admin/tests/bulk', { ids: drafts.map((d) => d.id), action: 'publish' });
    toast(`Опубликовано: ${r.done}`); reload();
  };
  return (
    <>
      <PageHeader title="Тесты" sub={`${rows.filter((r) => r.status === 'published').length} опубликовано · ${drafts.length} черновиков · удобнее работать внутри раздела: «Разделы» → раздел`}>
        {editor && drafts.length > 0 && <Button tone="soft" icon="check" onClick={publishDrafts}>Опубликовать все черновики · {drafts.length}</Button>}
        {editor && <Button icon="plus" onClick={() => nav('/tests/new')}>Новый тест</Button>}
      </PageHeader>
      <Card>
        {state.status === 'loading' && <Spinner />}
        {state.status === 'error' && <ErrorBox error={state.error} onRetry={reload} />}
        {state.status === 'ok' && <TestsManager rows={rows} reload={reload} initialFilter={(params.get('status') as 'draft' | null) ?? ''} />}
      </Card>
    </>
  );
}
