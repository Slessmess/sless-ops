import { useState } from 'react';
import { useGetMediaPlans, useGetMediaDashboard, useRequestMediaManagedService, useCreateMediaCheckout } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState, LoadingBlock, PageHead, useInvalidateAll } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { errMsg } from '@/lib/helpers';

export function PlanCards({ showCheckout = false }: { showCheckout?: boolean }) {
  const q = useGetMediaPlans();
  const checkout = useCreateMediaCheckout();
  if (q.isLoading) return <LoadingBlock rows={2} />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <p data-testid="text-launch-note" className="mb-5 rounded-sm bg-accent/40 p-3 text-sm">{q.data.launchNote} Billing is {q.data.billingActive ? 'active' : 'inactive'}; publishing is {q.data.automaticPublishing ? 'automatic' : 'manual (you download and post yourself)'}.</p>
      <div className="grid gap-6 md:grid-cols-2">
        {q.data.plans.map((p, i) => (
          <div key={p.id} data-testid={`card-plan-${p.id}`} className={`rounded-md border p-7 ${i ? 'bg-secondary text-secondary-foreground' : 'bg-card'}`}>
            <p className="font-mono text-xs uppercase tracking-widest opacity-70">Not yet available to buy</p>
            <h3 className="font-display text-3xl">{p.name}</h3>
            <p className="my-3 font-display text-6xl">${p.price}<span className="font-mono text-sm">/month</span></p>
            <p className="font-mono text-sm">{p.videos} short videos + {p.posts} posts</p>
            <p className="mt-3 text-sm opacity-90">{p.description}</p>
            {showCheckout && <Button className="mt-5" variant={i ? 'default' : 'outline'} data-testid={`button-checkout-${p.id}`} disabled={!q.data.billingActive || checkout.isPending} onClick={() => checkout.mutate({ data: { plan: p.id } })}>Billing inactive</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Plans() {
  const dash = useGetMediaDashboard({ query: { queryKey: ['/api/media/dashboard'] } });
  const req = useRequestMediaManagedService();
  const inv = useInvalidateAll();
  const { toast } = useToast();
  const [brief, setBrief] = useState('');
  const [err, setErr] = useState('');
  const sent = dash.data?.plan === 'managed_requested';
  return (
    <>
      <PageHead kicker="Launch preview" title="Plans" />
      <PlanCards showCheckout />
      <section className="mt-10 max-w-2xl">
        <h2 className="font-display text-3xl">Managed brief</h2>
        <p className="mb-3 text-sm text-muted-foreground">Tell us what you want covered. This records interest only; it does not start a subscription or charge anything.</p>
        {sent && <p className="mb-3 rounded-sm bg-secondary p-3 text-sm text-secondary-foreground" data-testid="text-brief-sent">Request recorded. Your brief: {dash.data?.managedBrief}</p>}
        <Textarea rows={6} minLength={10} maxLength={4000} data-testid="input-brief" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Seasonal menu, slow weeknights, what the owner wants to be known for..." />
        {err && <p className="mt-2 text-sm text-destructive" data-testid="text-error">{err}</p>}
        <Button className="mt-3" data-testid="button-submit-brief" disabled={req.isPending || brief.trim().length < 10} onClick={() => { setErr(''); req.mutate({ data: { brief } }, { onSuccess: () => { inv(); setBrief(''); toast({ title: 'Brief sent' }); }, onError: (e) => setErr(errMsg(e)) }); }}>{sent ? 'Update brief' : 'Send brief'}</Button>
      </section>
    </>
  );
}
