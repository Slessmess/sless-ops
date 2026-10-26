import { useState } from 'react';
import { useListMediaLinks, useCreateMediaLink, MediaLinkInputPlatform, type MediaLinkInput } from '@workspace/api-client-react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, Field, LoadingBlock, PageHead, selectCls, useInvalidateAll } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { errMsg } from '@/lib/helpers';

export default function Links() {
  const q = useListMediaLinks({ query: { queryKey: ['/api/media/links'] } });
  const create = useCreateMediaLink();
  const inv = useInvalidateAll();
  const { toast } = useToast();
  const [f, setF] = useState<MediaLinkInput>({ label: '', destination: '', platform: 'instagram' });
  const [err, setErr] = useState('');
  return (
    <>
      <PageHead kicker="Click tracking" title="Links" />
      <p className="mb-5 text-sm text-muted-foreground">Each link counts clicks when someone follows it. Clicks are not orders, reservations or other conversions.</p>
      <form className="mb-8 grid gap-3 rounded-md border border-border bg-card p-5 md:grid-cols-[1fr_2fr_auto_auto] md:items-end" onSubmit={(e) => { e.preventDefault(); setErr(''); create.mutate({ data: f }, { onSuccess: () => { inv(); setF({ ...f, label: '', destination: '' }); toast({ title: 'Link created' }); }, onError: (x) => setErr(errMsg(x)) }); }}>
        <Field label="Label"><Input required maxLength={100} data-testid="input-link-label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
        <Field label="Destination URL"><Input required maxLength={1000} placeholder="https://" data-testid="input-link-destination" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} /></Field>
        <Field label="Platform"><select className={selectCls} data-testid="select-link-platform" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value as MediaLinkInput['platform'] })}>{Object.values(MediaLinkInputPlatform).map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Button type="submit" data-testid="button-create-link" disabled={create.isPending}>Create</Button>
        {err && <p className="text-sm text-destructive md:col-span-4" data-testid="text-error">{err}</p>}
      </form>
      {q.isLoading ? <LoadingBlock /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title="No links yet" body="Create a tracked link to put in a bio or caption." /> : (
        <div className="divide-y divide-border rounded-md border border-border bg-card">
          {q.data.map((l) => (
            <div key={l.id} data-testid={`row-link-${l.id}`} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="font-display text-lg">{l.label}</p><p className="truncate font-mono text-xs text-muted-foreground">{l.url} to {l.destination}</p></div>
              <span className="font-mono text-xs uppercase">{l.platform}</span>
              <span className="font-display text-3xl" data-testid={`text-clicks-${l.id}`}>{l.clicks}<span className="ml-1 font-mono text-[10px] text-muted-foreground">clicks</span></span>
              <Button size="sm" variant="outline" data-testid={`button-copy-${l.id}`} onClick={() => { navigator.clipboard?.writeText(l.url.startsWith('http') ? l.url : window.location.origin + l.url); toast({ title: 'Copied' }); }}><Copy className="mr-1 h-3.5 w-3.5" />Copy</Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
