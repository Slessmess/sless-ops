import { useState } from 'react';
import { useListMediaClients, getListMediaClientContentQueryKey, useListMediaClientContent, useCreateMediaClientContent, useGetMediaDashboard } from '@workspace/api-client-react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingBlock, PageHead, useInvalidateAll } from '@/components/bits';
import { ContentCard, ContentForm } from '@/components/content';
import { fmtDate } from '@/lib/helpers';

function ClientContent({ clientId }: { clientId: string }) {
  const q = useListMediaClientContent(clientId, { query: { queryKey: getListMediaClientContentQueryKey(clientId), refetchInterval: 10000 } });
  const create = useCreateMediaClientContent();
  const inv = useInvalidateAll();
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-3xl">Client content</h2>
        <Button data-testid="button-new-client-content" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Create for client</Button></div>
      {q.isLoading ? <LoadingBlock /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title="No content for this client" body="Create a draft or generate from their photos." /> :
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{q.data.map((c) => <ContentCard key={c.id} c={c} />)}</div>}
      <ContentForm open={open} onOpenChange={setOpen} pending={create.isPending} clientId={clientId}
        onCreate={(data) => create.mutateAsync({ clientId, data }).then((r) => { inv(); return r; })} />
    </section>
  );
}

export default function Admin() {
  const dash = useGetMediaDashboard({ query: { queryKey: ['/api/media/dashboard'] } });
  const q = useListMediaClients({ query: { queryKey: ['/api/media/clients'], enabled: !!dash.data?.isAdmin, refetchInterval: 20000 } });
  const [sel, setSel] = useState<string | null>(null);
  if (dash.isLoading) return <LoadingBlock />;
  if (!dash.data?.isAdmin) return <EmptyState title="Owner only" body="This area is limited to the Sless Media Group owner." />;
  const clients = q.data ?? [];
  const client = clients.find((c) => c.id === sel);
  return (
    <>
      <PageHead kicker="Owner" title="Clients" />
      {q.isLoading ? <LoadingBlock /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !clients.length ? <EmptyState title="No clients yet" body="Restaurants that request managed service appear here." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {clients.map((c) => (
            <button key={c.id} data-testid={`button-client-${c.id}`} onClick={() => setSel(c.id)} className={`rounded-md border p-4 text-left ${sel === c.id ? 'border-primary bg-primary/5' : 'bg-card'}`}>
              <p className="font-display text-xl">{c.restaurant.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{c.contentCount} items / {c.pendingApprovals} pending / {c.requestedAt ? 'requested ' + fmtDate(c.requestedAt) : 'no request'}</p>
              {c.managedBrief && <p className="mt-2 line-clamp-3 text-sm">{c.managedBrief}</p>}
            </button>
          ))}
        </div>
      )}
      {client && <ClientContent key={client.id} clientId={client.restaurant.id} />}
    </>
  );
}
