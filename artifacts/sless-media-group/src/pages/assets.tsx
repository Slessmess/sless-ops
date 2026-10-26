import { useRef, useState } from 'react';
import { useListMediaAssets, useRequestMediaUpload, useCompleteMediaUpload, useDeleteMediaAsset, type MediaUploadInput } from '@workspace/api-client-react';
import { Upload, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Confirm, EmptyState, ErrorState, LoadingBlock, PageHead, useInvalidateAll } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { errMsg, fmtSize } from '@/lib/helpers';

const OK = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export default function Assets() {
  const q = useListMediaAssets({ query: { queryKey: ['/api/media/assets'] } });
  const reqUp = useRequestMediaUpload();
  const complete = useCompleteMediaUpload();
  const del = useDeleteMediaAsset();
  const inv = useInvalidateAll();
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setErr(''); setBusy(true);
    for (const file of Array.from(files)) {
      try {
        if (!OK.includes(file.type)) throw new Error(`${file.name}: only JPEG, PNG, WebP photos or PDF menus.`);
        if (file.size > 10485760) throw new Error(`${file.name}: over the 10MB limit.`);
        const kind = file.type === 'application/pdf' ? 'menu' : 'photo';
        const { assetId, uploadURL } = await reqUp.mutateAsync({ data: { name: file.name.slice(0, 200), size: file.size, contentType: file.type as MediaUploadInput['contentType'], kind } });
        const put = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!put.ok) throw new Error(`${file.name}: upload failed (${put.status}).`);
        await complete.mutateAsync({ assetId });
        toast({ title: `Uploaded ${file.name}` });
      } catch (e) { setErr(errMsg(e)); }
    }
    setBusy(false); inv();
    if (ref.current) ref.current.value = '';
  };
  return (
    <>
      <PageHead kicker="Private library" title="Assets">
        <input ref={ref} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden" data-testid="input-file" onChange={(e) => onFiles(e.target.files)} />
        <Button data-testid="button-upload" disabled={busy} onClick={() => ref.current?.click()}><Upload className="mr-1 h-4 w-4" />{busy ? 'Uploading...' : 'Upload'}</Button>
      </PageHead>
      <p className="mb-5 text-sm text-muted-foreground">Your real food photos (JPEG, PNG, WebP) and menu PDFs, up to 10MB each. Only you can see them.</p>
      {err && <p className="mb-4 rounded-sm bg-destructive/10 p-3 text-sm text-destructive" data-testid="text-upload-error">{err}</p>}
      {q.isLoading ? <LoadingBlock /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState title="No photos yet" body="Upload the dishes you actually serve. Videos are built from your photos." />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {q.data.map((a) => (
            <div key={a.id} data-testid={`card-asset-${a.id}`} className="group overflow-hidden rounded-md border border-border bg-card">
              <div className="flex aspect-square items-center justify-center bg-muted">
                {a.kind === 'photo' ? <img src={a.url} alt={a.name} className="h-full w-full object-cover" /> : <a href={a.url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 text-sm"><FileText className="h-8 w-8" />Open PDF</a>}
              </div>
              <div className="flex items-center justify-between gap-1 p-2"><div className="min-w-0"><p className="truncate text-xs">{a.name}</p><p className="font-mono text-[10px] text-muted-foreground">{a.kind} / {fmtSize(a.size)}</p></div>
                <Confirm testid={`button-confirm-delete-asset-${a.id}`} title="Delete this file?" body="Content already using it may block deletion." onConfirm={() => del.mutate({ assetId: a.id }, { onSuccess: () => { inv(); toast({ title: 'Deleted' }); }, onError: (e) => setErr(errMsg(e)) })}
                  trigger={<button aria-label="Delete" data-testid={`button-delete-asset-${a.id}`}><Trash2 className="h-4 w-4" /></button>} /></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
