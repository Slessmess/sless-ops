import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListOpsTasks, getListOpsTasksQueryKey, useCreateOpsTask, useApproveOpsTask, useRequestTaskChanges,
  type CreateOpsTask, type OpsTask,
} from '@workspace/api-client-react';
import { AlertTriangle, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ErrorState, Field, LoadingBlock, PageHead, StatusBadge, selectCls } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';

type Kind = CreateOpsTask['type'];
const KINDS: { v: Kind; label: string; note: string }[] = [
  { v: 'wp_page', label: 'WordPress page', note: 'New page, saved as a pending task.' },
  { v: 'wp_post', label: 'WordPress post', note: 'New post, saved as a pending task.' },
  { v: 'wp_update', label: 'WordPress update', note: 'Change an existing page or post by ID.' },
  { v: 'stripe_product', label: 'Stripe product', note: 'Product record only, no price.' },
  { v: 'stripe_link', label: 'Stripe payment link', note: 'Product, price and link in one task.' },
];
const WP_STATUSES = ['draft', 'publish', 'pending', 'private'] as const;
const UPDATE_KEYS = ['title', 'content', 'status', 'slug'] as const;

type Form = {
  type: Kind; title: string; content: string; slug: string; wp_status: string;
  wp_id: string; is_page: boolean; u_title: string; u_content: string; u_status: string; u_slug: string;
  name: string; description: string; dollars: string; redirect: string; shipping: boolean;
};
const blank = (type: Kind = 'wp_page'): Form => ({
  type, title: '', content: '', slug: '', wp_status: 'draft', wp_id: '', is_page: true,
  u_title: '', u_content: '', u_status: '', u_slug: '', name: '', description: '', dollars: '', redirect: '', shipping: false,
});

/** Exact dollars-string to integer cents, no float math. */
export function dollarsToCents(s: string): number | null {
  const m = /^\s*(\d{1,6})(?:\.(\d{1,2}))?\s*$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}
const centsLabel = (c?: number) => (c == null ? '' : `$${Math.floor(c / 100).toLocaleString()}.${String(c % 100).padStart(2, '0')}`);

function build(f: Form): { body?: CreateOpsTask; error?: string } {
  const t = f.type;
  if (t === 'wp_page' || t === 'wp_post') {
    if (!f.title.trim()) return { error: 'Title is required.' };
    if (!f.content.trim()) return { error: 'Content is required.' };
    const body: CreateOpsTask = { type: t, title: f.title.trim(), content: f.content, wp_status: f.wp_status as CreateOpsTask['wp_status'] };
    if (f.slug.trim()) body.slug = f.slug.trim();
    return { body };
  }
  if (t === 'wp_update') {
    const id = Number(f.wp_id);
    if (!/^\d+$/.test(f.wp_id.trim()) || !Number.isInteger(id) || id < 1) return { error: 'WordPress ID must be a positive whole number.' };
    const updates: Record<string, string> = {};
    if (f.u_title.trim()) updates.title = f.u_title.trim();
    if (f.u_content.trim()) updates.content = f.u_content;
    if (f.u_status) updates.status = f.u_status;
    if (f.u_slug.trim()) updates.slug = f.u_slug.trim();
    if (!Object.keys(updates).length) return { error: `Add at least one update (${UPDATE_KEYS.join(', ')}).` };
    return { body: { type: t, wp_id: id, is_page: f.is_page, updates } };
  }
  if (!f.name.trim()) return { error: 'Name is required.' };
  if (t === 'stripe_product') {
    const body: CreateOpsTask = { type: t, name: f.name.trim() };
    if (f.description.trim()) body.description = f.description.trim();
    return { body };
  }
  const amount = dollarsToCents(f.dollars);
  if (amount == null || amount < 1) return { error: 'Amount must be a dollar value like 24 or 24.50 (max two decimals).' };
  if (amount > 99999999) return { error: 'Amount is above the allowed maximum.' };
  const body: CreateOpsTask = { type: t, name: f.name.trim(), amount };
  if (f.redirect.trim()) {
    try { if (new URL(f.redirect.trim()).protocol !== 'https:') throw 0; } catch { return { error: 'Redirect must be a full https:// URL.' }; }
    body.redirect = f.redirect.trim();
  }
  if (f.shipping) body.shipping = true;
  return { body };
}

const errStatus = (e: unknown) => (e && typeof e === 'object' && 'status' in e ? Number((e as { status: unknown }).status) : 0);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Request failed');
const newKey = () => crypto.randomUUID();

function Forbidden() {
  return (
    <div data-testid="state-ops-forbidden" className="mx-auto mt-10 max-w-lg rounded-md border border-destructive/30 bg-card p-8 text-center">
      <Lock className="mx-auto mb-3 h-8 w-8 text-destructive" />
      <h2 className="font-display text-3xl">Not on the operations list</h2>
      <p className="mt-2 text-sm text-muted-foreground">This workbench is restricted to approved operations administrators. Your account is signed in, but no queue data is available to it.</p>
    </div>
  );
}

function Composer() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState<Form>(blank());
  const [key, setKey] = useState(newKey);
  const [sentFor, setSentFor] = useState<string | null>(null); // payload JSON tied to current key
  const [uncertain, setUncertain] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<OpsTask | null>(null);
  const inflight = useRef(false);
  const create = useCreateOpsTask({ request: { headers: { 'Idempotency-Key': key } } });
  const built = useMemo(() => build(f), [f]);
  const payload = built.body ? JSON.stringify(built.body) : null;
  const drifted = sentFor !== null && payload !== sentFor;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const reset = () => { setF(blank(f.type)); setKey(newKey()); setSentFor(null); setUncertain(false); setErr(null); create.reset(); };
  const startFresh = () => { setKey(newKey()); setSentFor(null); setUncertain(false); setErr(null); create.reset(); };

  const submit = async () => {
    if (inflight.current) return;
    if (!built.body) { setErr(built.error ?? 'Invalid task'); return; }
    if (drifted) { setErr('The form changed after an unconfirmed save. Start a new request first.'); return; }
    inflight.current = true; setErr(null); setSentFor(payload);
    try {
      const task = await create.mutateAsync({ data: built.body });
      setSaved(task);
      await qc.invalidateQueries({ queryKey: getListOpsTasksQueryKey() });
      toast({ title: 'Saved as pending', description: 'Nothing ran. Approve it in the queue when ready.' });
      setF(blank(f.type)); setKey(newKey()); setSentFor(null); setUncertain(false);
    } catch (e) {
      const s = errStatus(e);
      if (s >= 400 && s < 500 && s !== 408 && s !== 409 && s !== 429) { setErr(errMsg(e)); setSentFor(null); setUncertain(false); setKey(newKey()); }
      else { setUncertain(true); setErr(`${errMsg(e)}. The server may or may not have saved it. Retry is safe: it reuses the same request key.`); }
    } finally { inflight.current = false; }
  };

  const busy = create.isPending;
  const kind = KINDS.find((k) => k.v === f.type)!;
  const wp = f.type === 'wp_page' || f.type === 'wp_post';
  const cents = dollarsToCents(f.dollars);
  return (
    <section className="rounded-md border bg-card p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h2 className="font-display text-2xl">Prepare a task</h2><p className="text-xs text-muted-foreground">Saving only queues. Nothing touches WordPress or Stripe until you approve.</p></div>
      </div>
      <fieldset disabled={busy} className="space-y-4">
        <Field label="Task type" hint={kind.note}>
          <select data-testid="select-ops-type" className={selectCls} value={f.type} disabled={sentFor !== null}
            onChange={(e) => setF({ ...blank(e.target.value as Kind) })}>
            {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
          </select>
        </Field>
        {wp && <>
          <Field label="Title"><Input data-testid="input-ops-title" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={1000} /></Field>
          <Field label="Content"><Textarea data-testid="input-ops-content" rows={6} value={f.content} onChange={(e) => set('content', e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug" hint="Optional"><Input data-testid="input-ops-slug" value={f.slug} onChange={(e) => set('slug', e.target.value)} /></Field>
            <Field label="WordPress status"><select data-testid="select-ops-wp-status" className={selectCls} value={f.wp_status} onChange={(e) => set('wp_status', e.target.value)}>
              {WP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
          </div>
        </>}
        {f.type === 'wp_update' && <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WordPress ID"><Input data-testid="input-ops-wp-id" inputMode="numeric" value={f.wp_id} onChange={(e) => set('wp_id', e.target.value)} /></Field>
            <Field label="Target"><select data-testid="select-ops-is-page" className={selectCls} value={f.is_page ? 'page' : 'post'} onChange={(e) => set('is_page', e.target.value === 'page')}>
              <option value="page">Page</option><option value="post">Post</option></select></Field>
          </div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Updates - fill only what changes</p>
          <Field label="New title"><Input data-testid="input-ops-u-title" value={f.u_title} onChange={(e) => set('u_title', e.target.value)} /></Field>
          <Field label="New content"><Textarea data-testid="input-ops-u-content" rows={4} value={f.u_content} onChange={(e) => set('u_content', e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New status"><select data-testid="select-ops-u-status" className={selectCls} value={f.u_status} onChange={(e) => set('u_status', e.target.value)}>
              <option value="">No change</option>{WP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
            <Field label="New slug"><Input data-testid="input-ops-u-slug" value={f.u_slug} onChange={(e) => set('u_slug', e.target.value)} /></Field>
          </div>
        </>}
        {(f.type === 'stripe_product' || f.type === 'stripe_link') &&
          <Field label="Name"><Input data-testid="input-ops-name" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={250} /></Field>}
        {f.type === 'stripe_product' &&
          <Field label="Description" hint="Optional"><Textarea data-testid="input-ops-description" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} /></Field>}
        {f.type === 'stripe_link' && <>
          <Field label="Price (USD)" hint={cents != null && cents > 0 ? `Sent as ${cents} cents` : 'Dollars, e.g. 24.50'}>
            <Input data-testid="input-ops-amount" inputMode="decimal" placeholder="24.50" value={f.dollars} onChange={(e) => set('dollars', e.target.value)} /></Field>
          <Field label="Redirect after payment" hint="Optional, https only"><Input data-testid="input-ops-redirect" type="url" placeholder="https://" value={f.redirect} onChange={(e) => set('redirect', e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input data-testid="checkbox-ops-shipping" type="checkbox" checked={f.shipping} onChange={(e) => set('shipping', e.target.checked)} />Collect a shipping address</label>
        </>}
      </fieldset>
      {drifted && <div data-testid="warning-ops-drift" className="mt-4 flex gap-2 rounded-md border border-amber-600/40 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>You edited the form after a save whose result is unknown. The earlier version may already be queued. To send this version, start a new request intentionally, then check the queue for duplicates.</span></div>}
      {err && <p data-testid="text-ops-error" className="mt-4 text-sm text-destructive">{err}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {drifted
          ? <Button data-testid="button-ops-new-request" variant="outline" onClick={startFresh}>Start new request with these edits</Button>
          : <Button data-testid="button-ops-save" onClick={submit} disabled={busy}>{busy ? 'Saving...' : uncertain ? 'Retry same save' : 'Save as pending'}</Button>}
        <Button data-testid="button-ops-reset" variant="ghost" onClick={reset} disabled={busy}>Clear</Button>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground" title="Idempotency key">key {key.slice(0, 8)}</span>
      </div>
      {saved && <div data-testid="card-ops-saved" className="mt-5 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
        <div className="flex items-center justify-between"><span className="font-medium">Saved: {saved.title ?? saved.name ?? `#${saved.wp_id}`}</span><StatusBadge status={saved.status} /></div>
        <p className="mt-1 text-xs text-muted-foreground">Task {saved.id.slice(0, 8)} is waiting in the queue. It has not run.</p></div>}
    </section>
  );
}

function TaskRow({ t, onDone }: { t: OpsTask; onDone: () => void }) {
  const { toast } = useToast();
  const approve = useApproveOpsTask();
  const changes = useRequestTaskChanges();
  const [confirming, setConfirming] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const [fb, setFb] = useState('');
  const label = KINDS.find((k) => k.v === t.type)?.label ?? t.type;
  const target = t.type.startsWith('stripe') ? 'Stripe' : 'WordPress';
  const run = async () => {
    try { const r = await approve.mutateAsync({ taskId: t.id }); toast({ title: r.status === 'completed' ? 'Executed' : `Status: ${r.status}` }); }
    catch (e) { toast({ title: 'Approval failed', description: errMsg(e), variant: 'destructive' }); }
    finally { setConfirming(false); onDone(); }
  };
  const sendFb = async () => {
    try { await changes.mutateAsync({ taskId: t.id, data: { feedback: fb } }); setFbOpen(false); setFb(''); }
    catch (e) { toast({ title: 'Could not save feedback', description: errMsg(e), variant: 'destructive' }); }
    finally { onDone(); }
  };
  const actionable = t.status === 'pending' || t.status === 'change_requested';
  return (
    <li data-testid={`row-ops-task-${t.id}`} className="rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="ml-auto"><StatusBadge status={t.status} /></span>
      </div>
      <p className="mt-1 break-words font-medium">{t.title ?? t.name ?? `ID ${t.wp_id} (${t.is_page ? 'page' : 'post'})`}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t.amount != null && <>{centsLabel(t.amount)} </>}{t.wp_status && <>WP status {t.wp_status} </>}{t.slug && <>/{t.slug} </>}
        {t.updates && <>updates: {Object.keys(t.updates).join(', ')}</>}
      </p>
      {t.feedback && <p className="mt-2 border-l-2 border-primary/40 pl-2 text-xs">{t.feedback}</p>}
      {t.result && <p className="mt-2 break-all text-xs">{t.result.success ? 'Result: ' : 'Error: '}{t.result.link ?? t.result.url ?? t.result.error ?? String(t.result.id ?? '')}</p>}
      {actionable && <div className="mt-3 flex flex-wrap gap-2">
        {!confirming
          ? <Button size="sm" data-testid={`button-ops-approve-${t.id}`} onClick={() => setConfirming(true)}>Approve...</Button>
          : <div className="w-full rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-destructive" />This will run the task against live {target} now. It cannot be undone from here.</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="destructive" data-testid={`button-ops-confirm-${t.id}`} disabled={approve.isPending} onClick={run}>{approve.isPending ? 'Running...' : `Execute on ${target}`}</Button>
                <Button size="sm" variant="ghost" disabled={approve.isPending} onClick={() => setConfirming(false)}>Cancel</Button>
              </div></div>}
        {!confirming && <Button size="sm" variant="outline" data-testid={`button-ops-changes-${t.id}`} onClick={() => setFbOpen(!fbOpen)}>Request changes</Button>}
      </div>}
      {fbOpen && <div className="mt-3 space-y-2">
        <Textarea data-testid={`input-ops-feedback-${t.id}`} rows={3} maxLength={10000} value={fb} onChange={(e) => setFb(e.target.value)} placeholder="What needs to change" />
        <Button size="sm" data-testid={`button-ops-send-feedback-${t.id}`} disabled={changes.isPending} onClick={sendFb}>{changes.isPending ? 'Saving...' : 'Save feedback'}</Button>
      </div>}
    </li>
  );
}

export default function Operations() {
  const q = useListOpsTasks({ query: {
    queryKey: getListOpsTasksQueryKey(), refetchInterval: 15000, refetchOnWindowFocus: true,
    retry: (n, e) => { const s = errStatus(e); return s !== 401 && s !== 403 && n < 2; },
  } });
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const forbidden = errStatus(q.error) === 403;
  const tasks = useMemo(() => (q.data ?? []).filter((t) => filter === 'all' || t.status === 'pending' || t.status === 'change_requested' || t.status === 'processing'), [q.data, filter]);
  const refetch = useRef(q.refetch); refetch.current = q.refetch;
  useEffect(() => { const h = () => { if (document.visibilityState === 'visible') refetch.current(); }; document.addEventListener('visibilitychange', h); return () => document.removeEventListener('visibilitychange', h); }, []);
  if (forbidden) return <><PageHead kicker="Owner" title="Operations" /><Forbidden /></>;
  return (
    <>
      <PageHead kicker="Owner workbench" title="Operations queue" />
      {q.isLoading ? <LoadingBlock rows={4} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Composer />
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-display text-2xl">Queue</h2>
              <div className="ml-auto flex rounded-md border text-xs">
                {(['open', 'all'] as const).map((v) => <button key={v} data-testid={`button-ops-filter-${v}`} onClick={() => setFilter(v)} className={`px-3 py-1 ${filter === v ? 'bg-primary text-primary-foreground' : ''}`}>{v === 'open' ? 'Open' : 'All'}</button>)}
              </div>
              <Button size="icon" variant="ghost" aria-label="Refresh" data-testid="button-ops-refresh" onClick={() => q.refetch()}><RefreshCw className={`h-4 w-4 ${q.isFetching ? 'animate-spin' : ''}`} /></Button>
            </div>
            {!tasks.length ? <EmptyState title={filter === 'open' ? 'Nothing waiting' : 'No tasks yet'} body="Saved tasks land here as pending and wait for your approval." /> :
              <ul className="space-y-3">{tasks.map((t) => <TaskRow key={t.id} t={t} onDone={() => q.refetch()} />)}</ul>}
          </section>
        </div>
      )}
    </>
  );
}
