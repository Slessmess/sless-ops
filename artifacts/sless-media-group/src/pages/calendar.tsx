import { useState } from 'react';
import { useListMediaContent, useUpdateMediaContent } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingBlock, PageHead, StatusBadge, useInvalidateAll } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { errMsg, isYmd } from '@/lib/helpers';

export default function CalendarPage() {
  const q = useListMediaContent({ query: { queryKey: ['/api/media/content'] } });
  const upd = useUpdateMediaContent();
  const inv = useInvalidateAll();
  const { toast } = useToast();
  const [dates, setDates] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const go = (id: string, scheduledDate: string | null) => {
    setErr('');
    if (scheduledDate && !isYmd(scheduledDate)) return setErr('Use a real date as YYYY-MM-DD.');
    upd.mutate({ contentId: id, data: { scheduledDate } }, { onSuccess: () => { inv(); toast({ title: scheduledDate ? 'Date planned' : 'Unscheduled' }); }, onError: (e) => setErr(errMsg(e)) });
  };
  const all = q.data ?? [];
  const planned = all.filter((c) => c.scheduledDate).sort((a, b) => a.scheduledDate!.localeCompare(b.scheduledDate!));
  const unplanned = all.filter((c) => !c.scheduledDate);
  const renderRow = (c: (typeof all)[number]) => (
    <div key={c.id} data-testid={`row-cal-${c.id}`} className="flex flex-wrap items-center gap-3 border-b border-border py-3">
      <span className="w-28 font-mono text-sm">{c.scheduledDate ?? 'unplanned'}</span>
      <span className="min-w-0 flex-1 truncate font-display text-lg">{c.title}</span><StatusBadge status={c.status} />
      <Input className="w-36" placeholder="YYYY-MM-DD" data-testid={`input-cal-date-${c.id}`} value={dates[c.id] ?? ''} onChange={(e) => setDates({ ...dates, [c.id]: e.target.value })} />
      <Button size="sm" data-testid={`button-plan-${c.id}`} disabled={!dates[c.id] || upd.isPending} onClick={() => go(c.id, dates[c.id])}>Plan</Button>
      {c.scheduledDate && <Button size="sm" variant="outline" data-testid={`button-unschedule-${c.id}`} disabled={upd.isPending} onClick={() => go(c.id, null)}>Unschedule</Button>}
    </div>
  );
  return (
    <>
      <PageHead kicker="Planning only" title="Calendar" />
      <p className="mb-5 rounded-sm bg-muted p-3 text-sm">Dates are a plan for you. Sless Media Group never posts for you and has no social connections.</p>
      {err && <p className="mb-3 text-sm text-destructive" data-testid="text-error">{err}</p>}
      {q.isLoading ? <LoadingBlock /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : all.length === 0 ? <EmptyState title="Nothing to plan" body="Create content first, then give it a date." /> : (
        <>
          <h2 className="font-display text-2xl">Planned</h2>
          {planned.length ? planned.map(renderRow) : <p className="py-3 text-sm text-muted-foreground">No dates planned.</p>}
          <h2 className="mt-8 font-display text-2xl">Unplanned</h2>
          {unplanned.map(renderRow)}
        </>
      )}
    </>
  );
}
