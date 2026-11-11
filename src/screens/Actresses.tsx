import { useEffect, useMemo, useRef, useState } from 'react';
import type { Channel } from '../core/types';
import { actressKey, buildActresses, namesToVerify, type Actress } from '../core/actresses';
import { adultInfo } from '../core/tmdb';
import { tpdbKey, tpdbPerformer, type Performer } from '../core/tpdb';
import { idbGet, idbSet } from '../core/storage';
import { colorFor, initials, rgba } from '../ui/bits';
import { Modal } from '../ui/Dialog';

// Fileira de atrizes (0.32.0), só dentro da categoria de adultos: "Todas" + fotos redondas.
// OK numa atriz mostra só os filmes dela. Com o token da ThePornDB, as fotos e quem está em cada
// cena chegam aos poucos (até 150 títulos novos por vez; o que já foi visto fica guardado).

const ENRICH = 150;
let verifiedCache: Map<string, Performer | null> | null = null;
async function loadVerified(): Promise<Map<string, Performer | null>> {
  if (!verifiedCache) {
    const raw = (await idbGet<Record<string, Performer | null>>('tpdbPerf')) ?? {};
    verifiedCache = new Map(Object.keys(raw).map((k) => [k, raw[k]] as [string, Performer | null]));
  }
  return verifiedCache;
}
function saveVerified() {
  if (!verifiedCache) return;
  const o: Record<string, Performer | null> = {};
  verifiedCache.forEach((v, k) => (o[k] = v));
  void idbSet('tpdbPerf', o);
}

/** Atrizes da categoria (vai crescendo enquanto a ThePornDB responde). */
export function useActresses(items: Channel[], on: boolean): { list: Actress[]; busy: boolean } {
  const [perfOf, setPerfOf] = useState<Map<string, Performer[]>>(new Map());
  const [verified, setVerified] = useState<Map<string, Performer | null>>(new Map());
  const [busy, setBusy] = useState(false);
  const ids = items.map((i) => i.id).join('|');
  useEffect(() => {
    if (!on) return;
    let alive = true;
    const per = new Map<string, Performer[]>();
    const withKey = !!tpdbKey();
    void (async () => {
      const ver = await loadVerified();
      if (alive) setVerified(new Map(ver));
      if (!withKey) return;
      setBusy(true);
      // Mais novos primeiro; o cache faz os já vistos voltarem na hora.
      const pool = [...items].sort((a, b) => (b.added ?? 0) - (a.added ?? 0)).slice(0, ENRICH * 4);
      let fresh = 0;
      let n = 0;
      let next = 0;
      const worker = async () => {
        while (alive && next < pool.length && fresh < ENRICH) {
          const it = pool[next++];
          const t0 = Date.now();
          const info = await adultInfo(it).catch(() => null);
          if (Date.now() - t0 > 30) fresh++; // foi buscar na internet
          if (!alive) return;
          if (info?.performers?.length) per.set(it.id, info.performers);
          if (++n % 15 === 0) setPerfOf(new Map(per));
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (!alive) return;
      setPerfOf(new Map(per));
      // Nomes tirados do título: confere na ThePornDB (e pega a foto).
      for (const name of namesToVerify(items, per, ver)) {
        if (!alive) break;
        const p = await tpdbPerformer(name).catch(() => null);
        ver.set(actressKey(name), p);
      }
      saveVerified();
      if (alive) {
        setVerified(new Map(ver));
        setBusy(false);
      }
    })();
    return () => {
      alive = false;
      setBusy(false);
    };
  }, [ids, on]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => (on ? buildActresses(items, perfOf, verified, !!tpdbKey()) : []), [items, perfOf, verified, on]);
  return { list, busy };
}

function Face({ a, size }: { a: Actress; size: number }) {
  const [bad, setBad] = useState(false);
  const c = colorFor(a.name);
  return (
    <span className="act-face" style={{ width: size, height: size, background: `linear-gradient(160deg, ${rgba(c, 0.85)}, ${rgba(c, 0.35)})` }}>
      {a.photo && !bad ? <img src={a.photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} /> : <b style={{ fontSize: Math.round(size * 0.34) }}>{initials(a.name)}</b>}
    </span>
  );
}

function ActressButton({ a, on, size, onPick }: { a: Actress; on: boolean; size: number; onPick: () => void }) {
  return (
    <button className={'act' + (on ? ' on' : '')} data-nav="" data-nav-active={on ? '' : undefined} aria-label={`${a.name}, ${a.ids.size} filmes`} onClick={onPick} style={{ width: size + 26 }}>
      <Face a={a} size={size} />
      <span className="act-name">{a.name}</span>
      <span className="act-count">{a.ids.size}</span>
    </button>
  );
}

const ROW_MAX = 40;

/** Fileira acima da grade: Todas · atrizes · Procurar. */
export function ActressRow({ list, busy, selected, onSelect, mobile }: { list: Actress[]; busy: boolean; selected: string; onSelect: (key: string) => void; mobile: boolean }) {
  const [search, setSearch] = useState(false);
  const size = mobile ? 54 : 72;
  const sel = list.find((a) => a.key === selected);
  // A escolhida aparece sempre na fileira, mesmo fora das 40 primeiras.
  const shown = list.slice(0, ROW_MAX);
  if (sel && shown.indexOf(sel) < 0) shown.unshift(sel);
  if (!list.length && !busy) return null;
  return (
    <>
      <div className="act-row scroll-x" data-nav-group="" aria-label="Atrizes">
        <button className={'act' + (!selected ? ' on' : '')} data-nav="" data-nav-active={!selected ? '' : undefined} onClick={() => onSelect('')} style={{ width: size + 26 }}>
          <span className="act-face all" style={{ width: size, height: size }}><b style={{ fontSize: Math.round(size * 0.3) }}>Todas</b></span>
          <span className="act-name">Todas</span>
          <span className="act-count">{busy ? 'buscando…' : `${list.length} atrizes`}</span>
        </button>
        {shown.map((a) => (
          <ActressButton key={a.key} a={a} on={a.key === selected} size={size} onPick={() => onSelect(a.key === selected ? '' : a.key)} />
        ))}
        {list.length > 0 && (
          <button className="act" data-nav="" onClick={() => setSearch(true)} style={{ width: size + 26 }}>
            <span className="act-face all" style={{ width: size, height: size }}><b style={{ fontSize: Math.round(size * 0.38) }}>🔎</b></span>
            <span className="act-name">Procurar</span>
            <span className="act-count">todas</span>
          </button>
        )}
      </div>
      {search && <ActressSearch list={list} selected={selected} onClose={() => setSearch(false)} onSelect={(k) => { onSelect(k); setSearch(false); }} mobile={mobile} />}
    </>
  );
}

function ActressSearch({ list, selected, onSelect, onClose, mobile }: { list: Actress[]; selected: string; onSelect: (k: string) => void; onClose: () => void; mobile: boolean }) {
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const k = actressKey(q);
  const found = (k ? list.filter((a) => a.key.indexOf(k) >= 0) : list).slice(0, 120);
  return (
    <Modal title="Atrizes" onClose={onClose} width={mobile ? 360 : 900}>
      <div className="field" style={{ marginTop: 10 }}>
        <input data-nav="" type="search" value={q} placeholder="Nome da atriz" autoCapitalize="off" autoCorrect="off" onChange={(e) => setQ(e.target.value)} />
      </div>
      <div ref={box} className="act-grid scroll-y">
        {found.length === 0 && <span className="muted">Nenhuma atriz com esse nome nesta categoria.</span>}
        {found.map((a) => (
          <ActressButton key={a.key} a={a} on={a.key === selected} size={mobile ? 54 : 72} onPick={() => onSelect(a.key)} />
        ))}
      </div>
    </Modal>
  );
}
