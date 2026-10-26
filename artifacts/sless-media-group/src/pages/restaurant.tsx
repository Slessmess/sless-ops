import { useEffect, useState } from 'react';
import { useGetMediaDashboard, useSaveMediaRestaurant, type RestaurantInput } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState, Field, LoadingBlock, PageHead, useInvalidateAll } from '@/components/bits';
import { useToast } from '@/hooks/use-toast';
import { errMsg } from '@/lib/helpers';

const empty: RestaurantInput = { name: '', cuisine: '', location: '', tone: '', description: '', menu: '', website: '' };
export default function RestaurantPage() {
  const q = useGetMediaDashboard({ query: { queryKey: ['/api/media/dashboard'] } });
  const save = useSaveMediaRestaurant();
  const inv = useInvalidateAll();
  const { toast } = useToast();
  const [f, setF] = useState<RestaurantInput>(empty);
  const [err, setErr] = useState('');
  const r = q.data?.restaurant;
  const rid = r?.id;
  useEffect(() => {
    if (r) { const { name, cuisine, location, tone, description, menu, website } = r; setF({ name, cuisine, location, tone, description, menu, website }); }
  }, [rid]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.isLoading) return <LoadingBlock />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const bind = (k: keyof RestaurantInput) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }), 'data-testid': `input-${k}` });
  return (
    <>
      <PageHead kicker={r ? 'Profile' : 'Onboarding'} title={r ? 'Your restaurant' : 'Tell us about your restaurant'} />
      <form className="grid max-w-3xl gap-4" onSubmit={(e) => { e.preventDefault(); setErr(''); save.mutate({ data: f }, { onSuccess: () => { inv(); toast({ title: 'Restaurant saved' }); }, onError: (x) => setErr(errMsg(x)) }); }}>
        <Field label="Name"><Input required maxLength={100} {...bind('name')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cuisine"><Input maxLength={100} {...bind('cuisine')} /></Field>
          <Field label="Location"><Input maxLength={200} {...bind('location')} /></Field>
        </div>
        <Field label="Tone of voice" hint="e.g. warm, plainspoken, a little cheeky"><Input maxLength={200} {...bind('tone')} /></Field>
        <Field label="Description"><Textarea rows={3} maxLength={2000} {...bind('description')} /></Field>
        <Field label="Menu text" hint="AI generation reads this text. Uploaded menu PDFs are reference only."><Textarea rows={10} maxLength={10000} {...bind('menu')} /></Field>
        <Field label="Website"><Input maxLength={500} {...bind('website')} /></Field>
        {err && <p className="text-sm text-destructive" data-testid="text-error">{err}</p>}
        <div><Button type="submit" data-testid="button-save-restaurant" disabled={save.isPending || !f.name.trim()}>{save.isPending ? 'Saving...' : 'Save restaurant'}</Button></div>
      </form>
    </>
  );
}
