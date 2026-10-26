import { Link } from 'wouter';
import { PlanCards } from '@/pages/plans';
import { LaunchBanner } from '@/components/bits';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const steps = [
  ['Upload your real photos', 'The dishes you actually plate. JPEG, PNG or WebP, plus your menu PDF for reference.'],
  ['Paste your menu text', 'The AI reads your words and your tone, not a generic template.'],
  ['Get PNG posts and 15-second silent MP4s', 'Built from your photos. Not filmed footage, not stock.'],
  ['Review, approve, download', 'You post it yourself. Nothing is published for you.'],
];
export default function Home() {
  return (
    <div className="min-h-[100dvh]">
      <LaunchBanner />
      <header className="mx-auto flex max-w-6xl items-center justify-between p-5">
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-base sm:text-xl"><img src={`${base}/logo.svg`} alt="" className="h-8 w-8" />Sless Media Group</span>
        <nav className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[11px] sm:gap-4 sm:text-sm">
          <Link href="/sign-in" data-testid="link-sign-in" className="underline-offset-4 hover:underline">Sign in</Link>
          <Link href="/sign-up" data-testid="link-sign-up" className="rounded-sm bg-foreground px-4 py-2 text-background">Try the preview</Link>
        </nav>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-[1.2fr_1fr] md:py-20">
        <div className="rise">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-primary">Social content for restaurants</p>
          <h1 className="font-display text-6xl font-extrabold leading-[0.95] md:text-8xl">Your plates are<br /><em className="font-medium text-primary">the content.</em></h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">Turn your actual food photos and menu into vertical videos and posts. Do it yourself, or have the owner manage it for you.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/sign-up" data-testid="link-hero-start" className="rounded-sm bg-primary px-6 py-3 text-primary-foreground">Start free preview</Link><a href="#plans" className="rounded-sm border border-foreground px-6 py-3">See plans</a></div>
        </div>
        <div className="relative rise" style={{ animationDelay: '.15s' }}>
          <img src={`${base}/hero-plate.jpg`} alt="Example photo of pasta, used for illustration" className="aspect-[4/5] w-full rounded-md object-cover" />
          <span className="absolute bottom-3 left-3 bg-background px-2 py-1 font-mono text-[10px] uppercase">Example image</span>
        </div>
      </section>
      <section className="bg-sidebar py-16 text-sidebar-foreground"><div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-[1fr_1.3fr]">
        <div><h2 className="font-display text-5xl">How it works</h2><img src={`${base}/kitchen.jpg`} alt="Example kitchen photo" className="mt-6 aspect-[4/3] w-full rounded-md object-cover" /><p className="mt-1 font-mono text-[10px] uppercase opacity-60">Example image</p></div>
        <ol className="space-y-6">{steps.map(([t, b], i) => <li key={t} className="flex gap-4 border-b border-sidebar-border pb-5"><span className="font-display text-4xl text-sidebar-primary">{i + 1}</span><div><h3 className="font-display text-2xl">{t}</h3><p className="text-sm opacity-75">{b}</p></div></li>)}</ol>
      </div></section>
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-5xl">What is and is not included</h2>
        <div className="mt-6 grid gap-6 text-sm md:grid-cols-2">
          <ul className="space-y-2 rounded-md border bg-card p-6"><li className="font-display text-xl">Included in the preview</li><li>PNG posts and silent 15-second vertical MP4s from your photos</li><li>Captions, approval flow, planning calendar</li><li>Click-tracking links (clicks only, not sales)</li><li>1 AI post and 1 AI video per restaurant, lifetime</li></ul>
          <ul className="space-y-2 rounded-md border bg-card p-6"><li className="font-display text-xl">Not included</li><li>Automatic publishing or social account connections</li><li>Active billing or subscriptions</li><li>Filmed or synthetic video, audio, or music</li><li>Results or performance claims</li></ul>
        </div>
      </section>
      <section id="plans" className="mx-auto max-w-6xl px-5 pb-20"><h2 className="mb-6 font-display text-5xl">Two ways to work</h2><PlanCards /></section>
      <footer className="border-t p-6 text-center font-mono text-xs uppercase text-muted-foreground">Sless Media Group / launch preview</footer>
    </div>
  );
}
