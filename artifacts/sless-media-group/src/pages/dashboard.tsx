import { Link } from 'wouter';
import { useGetMediaDashboard } from '@workspace/api-client-react';
import { ErrorState, LoadingBlock, PageHead } from '@/components/bits';
import { fmtDate } from '@/lib/helpers';

export default function Dashboard() {
  const q = useGetMediaDashboard({ query: { queryKey: ['/api/media/dashboard'], refetchInterval: 30000 } });
  if (q.isLoading) return <LoadingBlock />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const stats = [['Content items', d.contentCount], ['Pending approvals', d.pendingApprovals], ['Planned dates', d.scheduledCount], ['Link clicks', d.linkClicks]];
  return (
    <>
      <PageHead kicker={d.restaurant?.name ?? 'Welcome'} title="Dashboard" />
      {!d.restaurant && <div data-testid="card-onboard" className="mb-8 rounded-md bg-secondary p-6 text-secondary-foreground"><h2 className="font-display text-2xl">Start with your restaurant</h2><p className="mt-1 text-sm">Add your name, tone and menu text so generated content sounds like you.</p><Link href="/restaurant" className="mt-3 inline-block underline">Set up profile</Link></div>}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-4">
        {stats.map(([l, v]) => <div key={l as string} className="bg-card p-5"><p className="font-display text-5xl" data-testid={`stat-${(l as string).toLowerCase().replace(/ /g, '-')}`}>{v}</p><p className="mt-1 font-mono text-[11px] uppercase text-muted-foreground">{l}</p></div>)}
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-6">
          <h2 className="font-display text-2xl">AI preview allowance</h2>
          <p className="mb-4 text-sm text-muted-foreground">Lifetime cap per restaurant. Manual drafts are unlimited.</p>
          {([['Posts', d.usage.posts, d.usage.postLimit], ['Videos', d.usage.videos, d.usage.videoLimit]] as const).map(([l, u, m]) => (
            <div key={l} className="mb-3"><div className="flex justify-between font-mono text-xs"><span>{l}</span><span data-testid={`usage-${l.toLowerCase()}`}>{u} / {m}</span></div><div className="h-2 bg-muted"><div className="h-2 bg-primary" style={{ width: `${m ? Math.min(100, (u / m) * 100) : 0}%` }} /></div></div>
          ))}
          <p className="mt-3 font-mono text-xs uppercase" data-testid="text-plan">{d.plan === 'managed_requested' ? 'Managed service requested' : 'Launch preview'} / billing {d.billingActive ? 'active' : 'inactive'}</p>
        </section>
        <section className="rounded-md border border-border bg-card p-6">
          <h2 className="font-display text-2xl">Recent activity</h2>
          {d.recentActivity.length === 0 ? <p className="mt-3 text-sm text-muted-foreground" data-testid="state-empty">No activity yet. Upload a photo to begin.</p> :
            <ul className="mt-3 divide-y divide-border">{d.recentActivity.map((a) => <li key={a.id} className="py-2 text-sm"><span>{a.message}</span><span className="ml-2 font-mono text-xs text-muted-foreground">{fmtDate(a.createdAt)}</span></li>)}</ul>}
        </section>
      </div>
    </>
  );
}
