import type { Channel, EpgEntry, Playlist } from './types';
import { normalizeServer } from './xtream';

// "Voltar na programação" (catch-up / timeshift): assistir um programa que já passou,
// quando a lista oferece (Xtream: tv_archive; M3U: catchup-days + catchup-source).

export function canCatchup(ch: Channel): boolean {
  return !!ch.catchupDays && ch.catchupDays > 0;
}

/** O programa ainda está dentro da janela de gravação do canal? */
export function inArchive(ch: Channel, e: EpgEntry, now = Date.now()): boolean {
  return canCatchup(ch) && e.end <= now && e.start >= now - ch.catchupDays! * 86400000;
}

/** Data/hora no fuso do servidor: "2026-11-08:14-30". */
function serverTime(ms: number, tz?: string): string {
  try {
    if (tz && typeof Intl !== 'undefined') {
      const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
      const p: Record<string, string> = {};
      for (const x of f.formatToParts(new Date(ms))) p[x.type] = x.value;
      return `${p.year}-${p.month}-${p.day}:${p.hour === '24' ? '00' : p.hour}-${p.minute}`;
    }
  } catch {
    /* fuso desconhecido: usa o local */
  }
  const d = new Date(ms);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}:${z(d.getHours())}-${z(d.getMinutes())}`;
}

function fillTemplate(tpl: string, e: EpgEntry, now: number): string {
  const s = Math.floor(e.start / 1000);
  const end = Math.floor(e.end / 1000);
  const d = new Date(e.start);
  const z = (n: number) => String(n).padStart(2, '0');
  const map: Record<string, string> = {
    utc: String(s), start: String(s), timestamp: String(Math.floor(now / 1000)), lutc: String(Math.floor(now / 1000)), now: String(Math.floor(now / 1000)),
    utcend: String(end), end: String(end), duration: String(end - s), offset: String(Math.floor(now / 1000) - s),
    Y: String(d.getUTCFullYear()), m: z(d.getUTCMonth() + 1), d: z(d.getUTCDate()), H: z(d.getUTCHours()), M: z(d.getUTCMinutes()), S: z(d.getUTCSeconds()),
  };
  return tpl.replace(/\$?\{(\w+)\}/g, (all, k: string) => (k in map ? map[k] : all));
}

/** Endereço do programa gravado. */
export function catchupUrl(pl: Playlist, ch: Channel, e: EpgEntry, now = Date.now()): string | null {
  if (!inArchive(ch, e, now)) return null;
  if (pl.source.type === 'xtream') {
    const c = pl.source;
    const id = ch.id.replace(/^l/, '');
    const minutes = Math.max(1, Math.round((e.end - e.start) / 60000));
    return `${normalizeServer(c.server)}/timeshift/${encodeURIComponent(c.username)}/${encodeURIComponent(c.password)}/${minutes}/${serverTime(e.start, pl.account?.timezone)}/${id}.ts`;
  }
  const src = ch.catchupSource;
  const type = (ch.catchupType || '').toLowerCase();
  if (src && /^https?:/i.test(src)) return fillTemplate(src, e, now);
  if (src && (type === 'append' || !type)) return ch.url + fillTemplate(src, e, now);
  if (type === 'shift' || type === 'default' || !src) {
    const sep = ch.url.includes('?') ? '&' : '?';
    return `${ch.url}${sep}utc=${Math.floor(e.start / 1000)}&lutc=${Math.floor(now / 1000)}`;
  }
  return null;
}

/** Item para o player (modo filme: barra de tempo, avançar/voltar). */
export function catchupItem(pl: Playlist, ch: Channel, e: EpgEntry): Channel | null {
  const url = catchupUrl(pl, ch, e);
  if (!url) return null;
  return { id: `cu:${ch.id}:${e.start}`, kind: 'movie', name: e.title, group: `${ch.name} · gravado`, logo: ch.logo, url };
}
