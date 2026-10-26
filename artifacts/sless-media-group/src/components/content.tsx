import { useState } from 'react';
import { useListMediaAssets, useListMediaClientAssets, useUpdateMediaContent, useDeleteMediaContent, useRenderMediaContent, type MediaContent, type MediaContentInput, MediaContentInputKind, MediaContentInputPlatform, MediaContentUpdatePlatform } from '@workspace/api-client-react';
import { Download, Pencil, Send, Check, MessageSquareWarning, Trash2, Film, ImageIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Confirm, Field, StatusBadge, selectCls, useInvalidateAll } from '@/components/bits';
import { errMsg, isYmd } from '@/lib/helpers';

export function ContentForm({ open, onOpenChange, onCreate, pending, canAssets = true, clientId }: {
  open: boolean; onOpenChange: (o: boolean) => void; pending: boolean; canAssets?: boolean; clientId?: string;
  onCreate: (d: MediaContentInput) => Promise<unknown>;
}) {
  const { data: ownAssets } = useListMediaAssets({ query: { enabled: open && canAssets && !clientId, queryKey: ['/api/media/assets'] } });
  const { data: clientAssets } = useListMediaClientAssets(clientId ?? '', { query: { queryKey: ['/api/media/admin/clients', clientId, 'assets'], enabled: open && !!clientId } });
  const photos = ((clientId ? clientAssets : ownAssets) ?? []).filter((a) => a.kind === 'photo');
  const [f, setF] = useState<MediaContentInput>({ kind: 'post', platform: 'instagram', title: '', caption: '', prompt: '', generate: false, assetId: null, scheduledDate: '' });
  const [err, setErr] = useState('');
  const { toast } = useToast();
  const set = (p: Partial<MediaContentInput>) => setF((s) => ({ ...s, ...p }));
  const submit = async () => {
    setErr('');
    if (!f.title.trim()) return setErr('Title is required.');
    if (f.scheduledDate && !isYmd(f.scheduledDate)) return setErr('Date must be a real YYYY-MM-DD date.');
    if (f.kind === 'video' && !f.assetId) return setErr('Video needs a photo. Pick one (upload in Assets first).');
    try {
      await onCreate({ ...f, assetId: f.assetId || null, scheduledDate: f.scheduledDate || null });
      toast({ title: f.generate ? 'Generation started' : 'Draft saved' });
      onOpenChange(false);
      setF({ ...f, title: '', caption: '', prompt: '', generate: false });
    } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl">New content</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><select data-testid="select-kind" className={selectCls} value={f.kind} onChange={(e) => set({ kind: e.target.value as MediaContentInput['kind'] })}>{Object.values(MediaContentInputKind).map((k) => <option key={k} value={k}>{k === 'post' ? 'Post (PNG)' : 'Video (15s silent MP4)'}</option>)}</select></Field>
          <Field label="Platform"><select data-testid="select-platform" className={selectCls} value={f.platform} onChange={(e) => set({ platform: e.target.value as MediaContentInput['platform'] })}>{Object.values(MediaContentInputPlatform).map((k) => <option key={k}>{k}</option>)}</select></Field>
        </div>
        <Field label="Title"><Input data-testid="input-title" maxLength={100} value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Photo" hint="Videos require a photo. Posts can use one too."><select data-testid="select-asset" className={selectCls} value={f.assetId ?? ''} onChange={(e) => set({ assetId: e.target.value || null })}><option value="">No photo</option>{photos.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Caption"><Textarea data-testid="input-caption" maxLength={4000} value={f.caption} onChange={(e) => set({ caption: e.target.value })} /></Field>
        <Field label="Schedule date (planning only)"><Input data-testid="input-date" placeholder="YYYY-MM-DD" value={f.scheduledDate ?? ''} onChange={(e) => set({ scheduledDate: e.target.value })} /></Field>
        <label className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm">
          <input type="checkbox" data-testid="checkbox-generate" className="mt-1" checked={f.generate} onChange={(e) => set({ generate: e.target.checked })} />
          <span>Generate AI copy from your menu and brief, then render a photo-based post or video. Preview cap: 1 AI post and 1 AI video per account, lifetime. Save manual drafts or render them without AI (10 renders per day).</span>
        </label>
        {f.generate && <Field label="Direction for the AI"><Textarea data-testid="input-prompt" maxLength={2000} value={f.prompt} onChange={(e) => set({ prompt: e.target.value })} /></Field>}
        {err && <p data-testid="text-form-error" className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button data-testid="button-save-content" disabled={pending} onClick={submit}>{pending ? 'Working...' : f.generate ? 'Generate' : 'Save draft'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContentCard({ c }: { c: MediaContent }) {
  const upd = useUpdateMediaContent();
  const del = useDeleteMediaContent();
  const render = useRenderMediaContent();
  const inv = useInvalidateAll();
  const { toast } = useToast();
  const [edit, setEdit] = useState(false);
  const [fb, setFb] = useState(false);
  const [t, setT] = useState(c.title);
  const [cap, setCap] = useState(c.caption);
  const [plat, setPlat] = useState<string>(c.platform);
  const [feedback, setFeedback] = useState(c.feedback);
  const [err, setErr] = useState('');
  const patch = (data: Parameters<typeof upd.mutate>[0]['data'], msg: string, done?: () => void) =>
    upd.mutate({ contentId: c.id, data }, { onSuccess: () => { inv(); toast({ title: msg }); done?.(); }, onError: (e) => setErr(errMsg(e)) });
  const Icon = c.kind === 'video' ? Film : ImageIcon;
  return (
    <article data-testid={`card-content-${c.id}`} className="rise flex flex-col overflow-hidden rounded-md border border-border bg-card">
      <div className="relative flex aspect-[4/5] items-center justify-center bg-secondary/10">
        {c.previewUrl ? (c.kind === 'video'
          ? <video key={c.previewUrl} controls muted playsInline loop className="h-full w-full object-cover">
              <source src={c.previewUrl} type="video/webm" />
               <source src={c.previewUrl.replace('preview=1', 'preview=mp4')} type="video/mp4" />
            </video>
          : <img src={c.previewUrl} alt={c.title} className="h-full w-full object-cover" />)
          : <div className="p-4 text-center text-xs text-muted-foreground"><Icon className="mx-auto mb-2 h-6 w-6" />{c.status === 'generating' ? 'Generating file...' : 'No file rendered yet'}</div>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2"><StatusBadge status={c.status} /><span className="font-mono text-[11px] uppercase text-muted-foreground">{c.kind} / {c.platform}</span></div>
        <h3 className="font-display text-xl leading-tight">{c.title}</h3>
        <p className="line-clamp-3 text-sm text-muted-foreground">{c.caption || 'No caption yet.'}</p>
        {c.scheduledDate && <p className="font-mono text-xs">Planned {c.scheduledDate}</p>}
        {c.error && <p className="text-xs text-destructive" data-testid={`text-error-${c.id}`}>{c.error}</p>}
        {c.feedback && <p className="rounded-sm bg-accent/30 p-2 text-xs">Feedback: {c.feedback}</p>}
        {err && <p className="text-xs text-destructive">{err}</p>}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          <Button asChild size="sm" variant="outline"><a href={c.downloadUrl} download data-testid={`link-download-${c.id}`}><Download className="mr-1 h-3.5 w-3.5" />{!c.previewUrl ? 'Caption TXT' : c.kind === 'video' ? 'MP4' : 'PNG'}</a></Button>
          {!!c.caption && <Button size="sm" variant="outline" data-testid={`button-copy-caption-${c.id}`} onClick={async () => {
            try { await navigator.clipboard.writeText(c.caption); toast({ title: 'Caption copied' }); }
            catch { setErr('Could not copy. Open Edit to select and copy the full caption.'); }
          }}>Copy caption</Button>}
          {c.status !== 'generating' && <Button size="sm" variant="outline" data-testid={`button-render-${c.id}`} disabled={render.isPending} onClick={() => render.mutate({ contentId: c.id }, { onSuccess: () => { inv(); toast({ title: 'File rendered — ready for review' }); }, onError: (e) => setErr(errMsg(e)) })}><RefreshCw className="mr-1 h-3.5 w-3.5" />{c.previewUrl ? 'Re-render' : 'Render'}</Button>}
          <Button size="sm" variant="outline" data-testid={`button-edit-${c.id}`} onClick={() => { setT(c.title); setCap(c.caption); setPlat(c.platform); setErr(''); setEdit(true); }}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
          {(c.status === 'draft' || c.status === 'changes_requested') && <Button size="sm" data-testid={`button-submit-${c.id}`} onClick={() => patch({ status: 'needs_approval' }, 'Submitted for approval')}><Send className="mr-1 h-3.5 w-3.5" />Submit</Button>}
          {c.status === 'needs_approval' && <>
            <Button size="sm" variant="secondary" data-testid={`button-approve-${c.id}`} onClick={() => patch({ status: 'approved' }, 'Approved')}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button>
            <Button size="sm" variant="outline" data-testid={`button-changes-${c.id}`} onClick={() => { setFeedback(c.feedback); setErr(''); setFb(true); }}><MessageSquareWarning className="mr-1 h-3.5 w-3.5" />Changes</Button></>}
          {c.status === 'approved' && <Button size="sm" variant="outline" data-testid={`button-reopen-${c.id}`} onClick={() => patch({ status: 'draft' }, 'Moved back to draft')}>Back to draft</Button>}
          <Confirm testid={`button-confirm-delete-${c.id}`} title="Delete this item?" body="The item and its rendered files are removed." onConfirm={() => del.mutate({ contentId: c.id }, { onSuccess: () => { inv(); toast({ title: 'Deleted' }); }, onError: (e) => setErr(errMsg(e)) })}
            trigger={<Button size="sm" variant="ghost" aria-label="Delete" data-testid={`button-delete-${c.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>} />
        </div>
      </div>
      <Dialog open={edit} onOpenChange={setEdit}><DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">Edit item</DialogTitle></DialogHeader>
        <Field label="Title"><Input data-testid="input-edit-title" maxLength={100} value={t} onChange={(e) => setT(e.target.value)} /></Field>
        <Field label="Platform"><select className={selectCls} value={plat} onChange={(e) => setPlat(e.target.value)}>{Object.values(MediaContentUpdatePlatform).map((k) => <option key={k}>{k}</option>)}</select></Field>
        <Field label="Caption"><Textarea data-testid="input-edit-caption" maxLength={4000} rows={6} value={cap} onChange={(e) => setCap(e.target.value)} /></Field>
         {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button data-testid="button-save-edit" disabled={upd.isPending || !t.trim()} onClick={() => patch({ title: t, caption: cap, platform: plat as typeof MediaContentUpdatePlatform[keyof typeof MediaContentUpdatePlatform] }, 'Saved', () => setEdit(false))}>Save</Button></DialogFooter>
      </DialogContent></Dialog>
      <Dialog open={fb} onOpenChange={setFb}><DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">Request changes</DialogTitle></DialogHeader>
        <Textarea data-testid="input-feedback" maxLength={2000} rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What should change?" />
         {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button data-testid="button-send-changes" disabled={upd.isPending || !feedback.trim()} onClick={() => patch({ status: 'changes_requested', feedback }, 'Changes requested', () => setFb(false))}>Send</Button></DialogFooter>
      </DialogContent></Dialog>
    </article>
  );
}
