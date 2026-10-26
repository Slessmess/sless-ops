import { type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { STATUS_CLS, STATUS_LABEL, errMsg } from '@/lib/helpers';

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/api/media') });
}

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="rise mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{kicker}</p>
        <h1 className="font-display text-4xl font-semibold md:text-5xl">{title}</h1>
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span data-testid={`status-${status}`} className={`inline-block rounded-sm px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${STATUS_CLS[status] ?? 'bg-muted'}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-md bg-muted" />)}</div>;
}

export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div data-testid="state-error" className="flex flex-col items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-6">
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <p className="text-sm">{errMsg(error)}</p>
      <Button variant="outline" onClick={retry} data-testid="button-retry">Retry</Button>
    </div>
  );
}

export function EmptyState({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div data-testid="state-empty" className="rounded-md border border-dashed border-foreground/30 bg-card p-10 text-center">
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      <div className="mt-5 flex justify-center gap-2">{children}</div>
    </div>
  );
}

export function Confirm({ trigger, title, body, onConfirm, testid }: { trigger: ReactNode; title: string; body: string; onConfirm: () => void; testid: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{body}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid={testid} onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const selectCls = 'h-9 w-full rounded-md border border-input bg-card px-2 text-sm';

export function LaunchBanner({ text }: { text?: string }) {
  return (
    <div data-testid="banner-launch-preview" className="border-b border-foreground/20 bg-accent px-4 py-2 text-center font-mono text-xs uppercase tracking-wider text-accent-foreground">
      Launch preview — billing is not active, no subscriptions exist, nothing posts to social accounts. {text}
    </div>
  );
}
