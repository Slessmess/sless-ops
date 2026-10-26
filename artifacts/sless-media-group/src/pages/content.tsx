import { useState } from 'react';
import { useListMediaContent, useCreateMediaContent } from '@workspace/api-client-react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock, PageHead, useInvalidateAll } from '@/components/bits';
import { ContentCard, ContentForm } from '@/components/content';

export default function ContentPage() {
  const q = useListMediaContent({ query: { queryKey: ['/api/media/content'], refetchInterval: (query) => (query.state.data?.some((c) => c.status === 'generating') ? 4000 : 30000) } });
  const create = useCreateMediaContent();
  const inv = useInvalidateAll();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const items = (q.data ?? []).filter((c) => filter === 'all' || c.status === filter);
  return (
    <>
      <PageHead kicker="Library" title="Content">
        <Button data-testid="button-new-content" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New content</Button>
      </PageHead>
      <div className="mb-5 flex flex-wrap gap-2">
        {['all', 'draft', 'generating', 'needs_approval', 'approved', 'changes_requested', 'failed'].map((s) => (
          <button key={s} data-testid={`filter-${s}`} onClick={() => setFilter(s)} className={`rounded-sm border px-2.5 py-1 font-mono text-xs uppercase ${filter === s ? 'bg-foreground text-background' : 'bg-card'}`}>{s.replace('_', ' ')}</button>
        ))}
      </div>
      {q.isLoading ? <LoadingBlock /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : items.length === 0 ? (
        <EmptyState title="Nothing here yet" body="Create a draft by hand, or generate one post and one video from your own photos as a launch preview.">
          <Button onClick={() => setOpen(true)} data-testid="button-empty-new">New content</Button>
        </EmptyState>
      ) : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((c) => <ContentCard key={c.id} c={c} />)}</div>}
      <ContentForm open={open} onOpenChange={setOpen} pending={create.isPending}
        onCreate={(data) => create.mutateAsync({ data }).then((r) => { inv(); return r; })} />
    </>
  );
}
