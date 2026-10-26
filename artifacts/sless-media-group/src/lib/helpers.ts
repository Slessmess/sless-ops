export const API = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
export function errMsg(e: unknown): string {
  const x = e as { data?: { error?: string }; message?: string } | null;
  return x?.data?.error || x?.message || 'Something went wrong. Try again.';
}
export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', generating: 'Generating', needs_approval: 'Needs approval', approved: 'Approved', changes_requested: 'Changes requested', failed: 'Failed',
};
export const STATUS_CLS: Record<string, string> = {
  draft: 'bg-muted text-foreground', generating: 'bg-accent text-accent-foreground', needs_approval: 'bg-primary/15 text-primary',
  approved: 'bg-secondary text-secondary-foreground', changes_requested: 'bg-destructive/15 text-destructive', failed: 'bg-destructive text-destructive-foreground',
};
export const fmtDate = (s: string) => new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const fmtSize = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
export const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
