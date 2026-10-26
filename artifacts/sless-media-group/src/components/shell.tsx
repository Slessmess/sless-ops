import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk, useUser } from '@clerk/react';
import { useGetMediaDashboard } from '@workspace/api-client-react';
import { CalendarDays, Images, LayoutDashboard, Link2, LogOut, Menu, Package, Shield, Store, ClipboardCheck, X, Clapperboard } from 'lucide-react';
import { LaunchBanner } from '@/components/bits';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const { data } = useGetMediaDashboard();
  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/restaurant', label: 'Restaurant', icon: Store },
    { href: '/assets', label: 'Assets', icon: Images },
    { href: '/content', label: 'Content', icon: Clapperboard },
    { href: '/calendar', label: 'Calendar', icon: CalendarDays },
    { href: '/links', label: 'Links', icon: Link2 },
    { href: '/plans', label: 'Plans', icon: Package },
    ...(data?.isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : []),
    { href: '/operations', label: 'Operations', icon: ClipboardCheck },
  ];
  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((i) => {
        const on = loc === i.href;
        return (
          <Link key={i.href} href={i.href} onClick={() => setOpen(false)} data-testid={`link-nav-${i.label.toLowerCase()}`}
            className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${on ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent'}`}>
            <i.icon className="h-4 w-4" />{i.label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <div className="min-h-[100dvh] md:flex">
      <aside className="hidden w-60 shrink-0 flex-col justify-between bg-sidebar p-5 text-sidebar-foreground md:flex md:sticky md:top-0 md:h-[100dvh]">
        <div>
          <Link href="/dashboard" className="mb-8 flex items-center gap-2"><img src={`${base}/logo.svg`} className="h-8 w-8" alt="" /><span className="font-display text-xl leading-none">Sless Media<br />Group</span></Link>
          {nav}
        </div>
        <div className="space-y-2 text-xs">
          <p className="truncate text-sidebar-foreground/60" data-testid="text-user-email">{user?.primaryEmailAddress?.emailAddress}</p>
          <button data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: base || '/' })} className="flex items-center gap-2 text-sidebar-foreground/80 hover:text-sidebar-foreground"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <LaunchBanner />
        <div className="flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
          <span className="font-display text-lg">Sless Media Group</span>
          <button aria-label="Menu" data-testid="button-menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
        {open && <div className="bg-sidebar p-4 text-sidebar-foreground md:hidden">{nav}<button onClick={() => signOut({ redirectUrl: base || '/' })} className="mt-4 text-sm">Sign out</button></div>}
        <main className="mx-auto max-w-6xl p-5 md:p-10">{children}</main>
      </div>
    </div>
  );
}
