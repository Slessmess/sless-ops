import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const F = 'src/components/video/AdScenes.tsx';
const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  halloweenHook: { title: 'Halloween hook', filePath: F },
  halloweenOffer: { title: 'Halloween offer', filePath: F },
  thanksgivingHook: { title: 'Thanksgiving hook', filePath: F },
  thanksgivingOffer: { title: 'Thanksgiving offer', filePath: F },
  christmasHook: { title: 'Christmas hook', filePath: F },
  christmasOffer: { title: 'Christmas offer', filePath: F },
};

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function Status({ sceneKeys, activeIndex, activeDuration, activeStartTime, totalDuration, tick, paused, onJumpTo }: {
  sceneKeys: string[]; activeIndex: number; activeDuration: number; activeStartTime: number;
  totalDuration: number; tick: number; paused: boolean; onJumpTo: (i: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const baseRef = useRef(0);
  useEffect(() => { setElapsed(0); baseRef.current = 0; }, [tick]);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const id = window.setInterval(() => setElapsed(baseRef.current + performance.now() - start), 60);
    return () => { window.clearInterval(id); baseRef.current += performance.now() - start; };
  }, [tick, paused]);
  const progress = activeDuration ? Math.min(1, elapsed / activeDuration) : 0;
  const total = Math.min(totalDuration, activeStartTime + Math.min(elapsed, activeDuration));
  return (
    <>
      <div className="flex-1 flex items-center gap-1.5">
        {sceneKeys.map((k, i) => (
          <button key={k} onClick={() => onJumpTo(i)} aria-label={`Jump to scene ${i + 1}`}
            className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden relative hover:h-4 transition-all">
            <div className="absolute inset-y-0 left-0 bg-white/90 rounded-full" style={{ width: `${i === activeIndex ? progress * 100 : 0}%` }} />
          </button>
        ))}
      </div>
      <div className="text-xl text-white/60 font-mono tabular-nums shrink-0">{activeIndex + 1}/{sceneKeys.length}</div>
      <div className="min-w-[11ch] text-right text-xl text-white/80 font-mono tabular-nums shrink-0" role="timer">
        {fmt(total)} / {fmt(totalDuration)}
      </div>
    </>
  );
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const c = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);

  const handleJumpTo = useCallback((i: number) => {
    c.jumpTo(i);
    const k = c.sceneKeys[i];
    const d = SCENE_DETAILS[k];
    if (d) window.parent.postMessage({ type: 'REPLIT_VIDEO_SCENE_SELECTED', payload: { sceneIndex: i, sceneCount: c.sceneKeys.length, sceneTitle: d.title, filePath: d.filePath, lineNumber: 1 } }, '*');
  }, [c.jumpTo, c.sceneKeys]);

  useEffect(() => {
    if (!c.paused) return;
    const frozen = document.getAnimations().filter((a) => a.playState === 'running');
    frozen.forEach((a) => a.pause());
    return () => frozen.forEach((a) => a.play());
  }, [c.paused]);

  if (!isIframed) return <VideoTemplate />;
  const visible = !collapsed || hovering;
  const btn = 'w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg shrink-0';

  return (
    <div className="relative w-full h-screen">
      <VideoTemplate key={c.mountKey} durations={c.durations} loop paused={c.paused} muted={muted} onSceneChange={c.onSceneChange} />
      <div className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end" style={{ height: '25%' }}
        onPointerEnter={() => setHovering(true)} onPointerLeave={() => setHovering(false)}>
        <div className="flex-1" />
        <div className={`flex items-center gap-3 bg-black/50 backdrop-blur-sm px-5 py-4 transition-all duration-200 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
          <button className={btn} onClick={c.togglePause} aria-label={c.paused ? 'Play' : 'Pause'}>{c.paused ? <Play className="w-8 h-8" /> : <Pause className="w-8 h-8" />}</button>
          <button className={`${btn} ${c.locked ? 'bg-white/15 text-white' : ''}`} onClick={c.toggleLock} aria-label="Loop current scene" aria-pressed={c.locked}><Repeat className="w-8 h-8" /></button>
          <button className={btn} onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}</button>
          <div className="w-px self-stretch bg-white/15" />
          <Status sceneKeys={c.sceneKeys} activeIndex={c.activeIndex} activeDuration={c.activeDuration} activeStartTime={c.activeStartTime} totalDuration={c.totalDuration} tick={c.tick} paused={c.paused} onJumpTo={handleJumpTo} />
          <button className={btn} onClick={() => { setCollapsed((x) => !x); setHovering(false); }} aria-label="Toggle controls">{collapsed ? <ChevronUp className="w-10 h-10" /> : <ChevronDown className="w-10 h-10" />}</button>
        </div>
      </div>
    </div>
  );
}
