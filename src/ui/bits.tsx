import { useEffect, useState } from 'react';
import type { Channel } from '../core/types';

export function Symbol({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 120) / 140} viewBox="0 0 140 120" aria-hidden="true" style={{ isolation: 'isolate' }}>
      <polygon points="20,20 20,100 88,60" fill="#FF6B3D" />
      <polygon points="38,20 38,100 106,60" fill="#F5B83D" style={{ mixBlendMode: 'screen' }} />
      <polygon points="56,20 56,100 124,60" fill="#3DD6C4" style={{ mixBlendMode: 'screen' }} />
    </svg>
  );
}

export function Brand({ size = 34 }: { size?: number }) {
  return (
    <div className="brand">
      <Symbol size={size} />
      <span style={{ fontSize: (size * 26) / 34 }}>prisma</span>
    </div>
  );
}

const PALETTE = ['#2B5BD7', '#C8264B', '#7A2E9C', '#B4531F', '#0E7490', '#3D7BFF', '#1F8A5B', '#8A6D1F', '#333344'];

export function initials(name: string): string {
  const clean = name
    .replace(/\b(HD|FHD|UHD|SD|4K|H265|HEVC|\[.*?\]|\(.*?\))\b/gi, '')
    .replace(/[^A-Za-z0-9\u00C0-\u024F ]/g, ' ')
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (!words.length) return '•';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

/** Logo do canal; sem logo (ou se a imagem falhar) mostra as iniciais. */
export function ChannelLogo({ ch, size = 40 }: { ch: Channel; size?: number }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [ch.logo]);
  const style = { width: size, height: size, background: ch.logo && !broken ? undefined : colorFor(ch.name) };
  return (
    <span className="logo-box" style={style}>
      {ch.logo && !broken ? (
        <img src={ch.logo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        initials(ch.name)
      )}
    </span>
  );
}

export function Ambient({ variant = 'live' }: { variant?: 'live' | 'home' | 'soft' }) {
  const spots =
    variant === 'live'
      ? [
          { left: 700, top: 40, w: 560, h: 460, c: '#7A2E9C', blur: 110, o: 0.6 },
          { left: 160, top: 380, w: 560, h: 420, c: '#3DD6C4', blur: 130, o: 0.2 },
        ]
      : variant === 'home'
        ? [
            { left: -80, top: -120, w: 620, h: 520, c: '#FF6B3D', blur: 140, o: 0.28 },
            { left: 760, top: 260, w: 620, h: 520, c: '#3DD6C4', blur: 140, o: 0.22 },
          ]
        : [{ left: 420, top: 200, w: 640, h: 480, c: '#3D2BFF', blur: 150, o: 0.25 }];
  // Gradiente radial em vez de blur: funciona na TV de 2017 e pesa menos.
  return (
    <div className="ambient" aria-hidden="true">
      {spots.map((s, i) => {
        const pad = s.blur;
        return (
          <i
            key={i}
            style={{
              left: s.left - pad, top: s.top - pad, width: s.w + pad * 2, height: s.h + pad * 2, opacity: s.o,
              background: `radial-gradient(ellipse closest-side, ${s.c} 0%, ${s.c} 35%, transparent 100%)`,
            }}
          />
        );
      })}
    </div>
  );
}

export const Icon = {
  search: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  bookmark: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  ),
  star: (filled: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  ),
  expand: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  ),
};

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
