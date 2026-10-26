import { motion } from 'framer-motion';
import { DROPS, IMG, type Drop } from './campaign';

const snap = { type: 'spring' as const, stiffness: 320, damping: 22 };

function Grain() {
  return <div className="grain" />;
}

/* Shot A: kinetic three-word hook stamped over a punching product photo */
function Hook({ d }: { d: Drop }) {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      style={{ background: d.field, color: d.ink }}
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 1.15 }}
      transition={{ duration: 0.45, ease: [0.7, 0, 0.2, 1] }}
    >
      {/* photo card: punches in, tilts, then pushes */}
      <motion.div
        className="absolute left-1/2 top-[52%]"
        style={{ width: '88vmin', x: '-50%', y: '-50%' }}
        initial={{ scale: 0.5, rotate: -14 }}
        animate={{ scale: [0.5, 1.04, 1, 1.12], rotate: [-14, 3, -2, 0] }}
        transition={{ duration: 5, times: [0, 0.12, 0.3, 1], ease: 'easeOut' }}
      >
        <img src={IMG(d.hero.photo)} className="w-full rounded-[3vmin] shadow-2xl" style={{ border: `1.2vmin solid ${d.accent}` }} />
      </motion.div>
      {/* hook words: discrete snaps 0.45s apart */}
      {d.hook.map((w, i) => (
        <motion.div
          key={w}
          className="absolute left-0 right-0 text-center display"
          style={{
            top: ['14%', i === 1 ? '62%' : '0', '78%'][i],
            fontSize: w.length > 8 ? '13vmin' : w.length > 5 ? '19vmin' : '26vmin',
            fontFamily: d.font,
            color: i === 1 ? d.accent : d.ink,
            WebkitTextStroke: i === 0 ? `0.5vmin ${d.ink}` : undefined,
            textShadow: '0 1.2vmin 0 rgba(10,10,10,.55)',
            textTransform: 'none',
            lineHeight: 0.9,
          }}
          initial={{ scale: 2.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...snap, delay: 0.25 + i * 0.45 }}
        >
          {w}
        </motion.div>
      ))}
      {/* 20% badge slams at 1.9s, spins slowly */}
      <motion.div
        className="absolute display flex flex-col items-center justify-center rounded-full"
        style={{ right: '5%', top: '40%', width: '30vmin', height: '30vmin', background: '#ffd700', color: '#0a0a0a', lineHeight: 0.85 }}
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: [-90, 12, 8] }}
        transition={{ ...snap, delay: 1.9 }}
      >
        <span style={{ fontSize: '11vmin' }}>20%</span>
        <span style={{ fontSize: '6vmin' }}>OFF</span>
      </motion.div>
      <motion.div
        className="absolute left-0 right-0 text-center body"
        style={{ top: '9%', fontSize: '3.4vmin', letterSpacing: '0.3em', fontWeight: 800 }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.6 }}
      >
        SLESS IS MORE · {d.holiday.toUpperCase()}
      </motion.div>
      <Grain />
    </motion.div>
  );
}

/* Shot B: offer stack — price slam, lineup, deadline strip */
function Offer({ d }: { d: Drop }) {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden"
      style={{ background: d.key === 'thanksgiving' ? d.accent : '#ffd700', color: '#0a0a0a' }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration: 0.4, ease: [0.8, 0, 0.2, 1] }}
    >
      {/* giant scrolling ticker */}
      <motion.div
        className="absolute display whitespace-nowrap"
        style={{ top: '3%', fontSize: '22vmin', opacity: 0.14 }}
        initial={{ x: '0%' }}
        animate={{ x: '-40%' }}
        transition={{ duration: 5, ease: 'linear' }}
      >
        NO CODE NEEDED · NO CODE NEEDED · NO CODE NEEDED
      </motion.div>
      <motion.div
        className="absolute left-[6%] display"
        style={{ top: '12%', fontSize: '9vmin', lineHeight: 0.95 }}
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ ...snap, delay: 0.3 }}
      >
        <div className="script" style={{ fontSize: '7vmin', textTransform: 'none' }}>{d.flourish}</div>
        {d.holiday.toUpperCase()} TOPS
        <div style={{ fontSize: '4vmin' }} className="body font-extrabold mt-[1vmin]">
          {d.hero.name}
        </div>
      </motion.div>
      <motion.div
        className="absolute left-[6%] display"
        style={{ top: '25%', fontSize: '30vmin', lineHeight: 1 }}
        initial={{ scale: 3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...snap, delay: 0.75 }}
      >
        <span style={{ fontSize: '9vmin', verticalAlign: 'top' }}>FROM $</span>
        {d.hero.from}
      </motion.div>
      <motion.div
        className="absolute body font-extrabold"
        style={{ left: '7%', top: '42%', fontSize: '4.5vmin', textDecoration: 'line-through', opacity: 0.6 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1.3 }}
      >
        was ${d.hero.was}
      </motion.div>
      {/* product lineup */}
      <div className="absolute left-[6%] right-[6%] flex gap-[3vmin]" style={{ top: '48%' }}>
        {[{ photo: d.hero.photo, name: 'Featured', from: d.hero.from }, ...d.side].map((p, i) => (
          <motion.div
            key={p.photo}
            className="flex-1 rounded-[2.5vmin] overflow-hidden bg-[#f6f3eb]"
            style={{ border: '0.8vmin solid #0a0a0a' }}
            initial={{ y: 200, rotate: 10, opacity: 0 }}
            animate={{ y: 0, rotate: (i - 1) * 2, opacity: 1 }}
            transition={{ ...snap, delay: 1.5 + i * 0.4 }}
          >
            <img src={IMG(p.photo)} className="w-full aspect-square object-cover" />
            <div className="body font-extrabold px-[2vmin] py-[1.5vmin]" style={{ fontSize: '3vmin' }}>
              {p.name} · ${p.from}
            </div>
          </motion.div>
        ))}
      </div>
      {/* deadline strip */}
      <motion.div
        className="absolute left-0 right-0 text-center display"
        style={{ top: '74%', background: '#0a0a0a', color: '#ffd700', fontSize: '6vmin', padding: '2.2vmin 0' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.35, delay: 3, ease: [0.8, 0, 0.2, 1] }}
      >
        BEFORE THE CLOCK STRIKES · OCT 25 11:59 PM ET
      </motion.div>
      <motion.div
        className="absolute left-0 right-0 flex items-center justify-center gap-[2vmin] body font-extrabold"
        style={{ top: '83%', fontSize: '3.6vmin' }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.5 }}
      >
        <img src={IMG('logo.png')} style={{ width: '12vmin' }} />
        SLESSISMORE.ORG
      </motion.div>
      <Grain />
    </motion.div>
  );
}

export const SCENES: Record<string, React.ComponentType> = Object.fromEntries(
  DROPS.flatMap((d) => [
    [`${d.key}Hook`, () => <Hook d={d} />],
    [`${d.key}Offer`, () => <Offer d={d} />],
  ]),
);
