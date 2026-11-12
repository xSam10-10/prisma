import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Channel } from '../core/types';
import { actressKey, buildActresses, namesToVerify, type Actress } from '../core/actresses';
import { buildStudios, studioKey, studiosToVerify, type SiteInfo, type Studio } from '../core/studios';
import { adultInfo } from '../core/tmdb';
import { tpdbKey, tpdbPerformer, tpdbSite, type Performer } from '../core/tpdb';
import { idbGet, idbSet } from '../core/storage';
import { colorFor, initials, rgba } from '../ui/bits';
import { focusEl, focusFirst, pushBack } from '../ui/nav';

// Filtros da categoria de adultos: atrizes (0.32.0) e produtoras (0.34.0).
// Cada um é uma fileira que mostra só o que cabe na tela (até 10), sem rolar para o lado,
// e um botão "Ver todas/todos" que abre uma página com todos, em várias fileiras.
// Com o token da ThePornDB, as fotos, os logotipos e quem está em cada cena chegam aos poucos
// (até 150 títulos novos por vez; o que já foi visto fica guardado).

const ENRICH = 250;

/** Mapa guardado no aparelho (nomes já conferidos na ThePornDB). */
function stored<T>(idbKey: string) {
  let cache: Map<string, T | null> | null = null;
  return {
    async load(): Promise<Map<string, T | null>> {
      if (!cache) {
        const raw = (await idbGet<Record<string, T | null>>(idbKey)) ?? {};
        cache = new Map(Object.keys(raw).map((k) => [k, raw[k]] as [string, T | null]));
        // Atrizes guardadas antes da 0.33.0 não têm a foto em pé: confere de novo.
        if (idbKey === 'tpdbPerf2') cache.forEach((v, k) => v && !(v as unknown as Performer).portrait && cache!.delete(k));
      }
      return cache;
    },
    save() {
      if (!cache) return;
      const o: Record<string, T | null> = {};
      cache.forEach((v, k) => (o[k] = v));
      void idbSet(idbKey, o);
    },
  };
}
// 'tpdbPerf2' (0.35.2): a lista antiga podia ter homens com o sexo em branco; confere de novo.
const perfStore = stored<Performer>('tpdbPerf2');
const siteStore = stored<SiteInfo>('tpdbSite');

/** Atrizes e produtoras da categoria (vão crescendo enquanto a ThePornDB responde). */
export function useAdultFilters(items: Channel[], on: boolean): { actresses: Actress[]; studios: Studio[]; busy: boolean } {
  const [perfOf, setPerfOf] = useState<Map<string, Performer[]>>(new Map());
  const [siteOf, setSiteOf] = useState<Map<string, SiteInfo>>(new Map());
  const [verified, setVerified] = useState<Map<string, Performer | null>>(new Map());
  const [sitesOk, setSitesOk] = useState<Map<string, SiteInfo | null>>(new Map());
  const [busy, setBusy] = useState(false);
  const ids = items.map((i) => i.id).join('|');
  useEffect(() => {
    if (!on) return;
    let alive = true;
    const per = new Map<string, Performer[]>();
    const sites = new Map<string, SiteInfo>();
    const withKey = !!tpdbKey();
    void (async () => {
      const ver = await perfStore.load();
      const sv = await siteStore.load();
      if (alive) {
        setVerified(new Map(ver));
        setSitesOk(new Map(sv));
      }
      if (!withKey) return;
      setBusy(true);
      // Mais novos primeiro; o cache faz os já vistos voltarem na hora.
      const pool = [...items].sort((a, b) => (b.added ?? 0) - (a.added ?? 0)).slice(0, ENRICH * 4);
      let fresh = 0;
      let n = 0;
      let next = 0;
      const push = () => {
        setPerfOf(new Map(per));
        setSiteOf(new Map(sites));
      };
      const worker = async () => {
        while (alive && next < pool.length && fresh < ENRICH) {
          const it = pool[next++];
          const t0 = Date.now();
          const info = await adultInfo(it).catch(() => null);
          if (Date.now() - t0 > 30) fresh++; // foi buscar na internet
          if (!alive) return;
          if (info?.performers?.length) per.set(it.id, info.performers);
          if (info?.studio) sites.set(it.id, info.studio);
          if (++n % 15 === 0) push();
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (!alive) return;
      push();
      // Nomes tirados do título: confere na ThePornDB (e pega a foto / o logotipo).
      // 3 de cada vez; a fileira vai crescendo enquanto confere.
      const names = namesToVerify(items, per, ver, 150);
      let ni = 0;
      let done = 0;
      const vworker = async () => {
        while (alive && ni < names.length) {
          const name = names[ni++];
          ver.set(actressKey(name), await tpdbPerformer(name).catch(() => null));
          if (++done % 20 === 0 && alive) setVerified(new Map(ver));
        }
      };
      await Promise.all([vworker(), vworker(), vworker()]);
      perfStore.save();
      if (alive) setVerified(new Map(ver));
      for (const name of studiosToVerify(items, sv)) {
        if (!alive) break;
        sv.set(studioKey(name), await tpdbSite(name).catch(() => null));
      }
      // Produtora que veio da cena, mas sem logotipo: procura o logotipo pelo nome.
      const noLogo: string[] = [];
      sites.forEach((s) => {
        if (!s.logo && !sv.has(studioKey(s.name)) && noLogo.indexOf(s.name) < 0) noLogo.push(s.name);
      });
      for (const name of noLogo.slice(0, 20)) {
        if (!alive) break;
        sv.set(studioKey(name), await tpdbSite(name).catch(() => null));
      }
      siteStore.save();
      if (alive) {
        setSitesOk(new Map(sv));
        setBusy(false);
      }
    })();
    return () => {
      alive = false;
      setBusy(false);
    };
  }, [ids, on]); // eslint-disable-line react-hooks/exhaustive-deps
  const actresses = useMemo(() => (on ? buildActresses(items, perfOf, verified, !!tpdbKey()) : []), [items, perfOf, verified, on]);
  const studios = useMemo(() => {
    if (!on) return [];
    const people = new Set(actresses.map((a) => a.key));
    const list = buildStudios(items, siteOf, sitesOk, !!tpdbKey(), people);
    // Logotipo achado depois pelo nome.
    for (const s of list) if (!s.logo) s.logo = sitesOk.get(s.key)?.logo ?? undefined;
    return list;
  }, [items, siteOf, sitesOk, actresses, on]);
  return { actresses, studios, busy };
}

// ---------------------------------------------------------------- Peças visuais

/** Item genérico dos filtros (atriz ou produtora). */
interface Pick {
  key: string;
  name: string;
  img?: string;
  count: number;
}
type Kind = 'actress' | 'studio';
const toPicks = (l: (Actress | Studio)[]): Pick[] => l.map((x) => ({ key: x.key, name: x.name, img: 'photo' in x ? x.photo : (x as Studio).logo, count: x.ids.size }));

function Face({ p, size }: { p: Pick; size: number }) {
  const [bad, setBad] = useState(false);
  const c = colorFor(p.name);
  return (
    <span className="act-face" style={{ width: size, height: size, background: `linear-gradient(160deg, ${rgba(c, 0.85)}, ${rgba(c, 0.35)})` }}>
      {p.img && !bad ? <img src={p.img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} /> : <b style={{ fontSize: Math.round(size * 0.34) }}>{initials(p.name)}</b>}
    </span>
  );
}

/** Cartão da produtora: logotipo (ou o nome, desenhado) num retângulo. */
function Logo({ p, w, h }: { p: Pick; w: number; h: number }) {
  const [bad, setBad] = useState(false);
  const c = colorFor(p.name);
  return (
    <span className="st-tile" style={{ width: w, height: h, background: `linear-gradient(135deg, ${rgba(c, 0.55)}, ${rgba(c, 0.18)})` }}>
      {p.img && !bad ? (
        <img src={p.img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />
      ) : (
        <b style={{ fontSize: Math.max(12, Math.min(Math.round(h * 0.36), Math.round((w * 1.5) / Math.max(4, p.name.length)))) }}>{p.name}</b>
      )}
    </span>
  );
}

interface Dims {
  /** Largura do botão (sem a margem). */
  w: number;
  face: number;
  tileW: number;
  tileH: number;
}
const dimsOf = (kind: Kind, mobile: boolean): Dims =>
  kind === 'actress'
    ? { face: mobile ? 50 : 72, w: (mobile ? 50 : 72) + 26, tileW: 0, tileH: 0 }
    : { face: 0, w: mobile ? 104 : 132, tileW: mobile ? 104 : 132, tileH: mobile ? 44 : 56 };

function PickButton({ p, kind, d, on, onPick, active }: { p: Pick; kind: Kind; d: Dims; on: boolean; onPick: () => void; active?: boolean }) {
  return (
    <button className={'act' + (kind === 'studio' ? ' st' : '') + (on ? ' on' : '')} data-nav="" data-nav-active={active ? '' : undefined} aria-label={`${p.name}, ${p.count} filmes`} onClick={onPick} style={{ width: d.w }}>
      {kind === 'actress' ? <Face p={p} size={d.face} /> : <Logo p={p} w={d.tileW} h={d.tileH} />}
      <span className="act-name">{kind === 'studio' ? `${p.name} · ${p.count}` : p.name}</span>
      {kind === 'actress' && <span className="act-count">{p.count}</span>}
    </button>
  );
}

/** Botão redondo/retangular com texto (Todas, Ver todas). */
function TextButton({ kind, d, label, sub, big, on, active, onClick }: { kind: Kind; d: Dims; label: string; sub?: string; big: string; on?: boolean; active?: boolean; onClick: () => void }) {
  return (
    <button className={'act' + (kind === 'studio' ? ' st' : '') + (on ? ' on' : '')} data-nav="" data-nav-active={active ? '' : undefined} onClick={onClick} style={{ width: d.w }}>
      {kind === 'actress' ? (
        <span className="act-face all" style={{ width: d.face, height: d.face }}><b style={{ fontSize: Math.round(d.face * (big.length > 3 ? 0.26 : 0.34)) }}>{big}</b></span>
      ) : (
        <span className="st-tile all" style={{ width: d.tileW, height: d.tileH }}><b style={{ fontSize: Math.round(d.tileH * 0.32) }}>{big}</b></span>
      )}
      <span className="act-name">{label}</span>
      {kind === 'actress' && <span className="act-count">{sub}</span>}
    </button>
  );
}

/** Largura do elemento (acompanha a janela). */
function useWidth(el: HTMLElement | null): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [el]);
  return w;
}

const ROW_MAX = 10;
const GAP = 12;

/** Fileira acima da grade: Todas · as primeiras que cabem (até 10) · Ver todas. */
export function FilterRow({ kind, list, busy, selected, onSelect, mobile }: { kind: Kind; list: (Actress | Studio)[]; busy: boolean; selected: string; onSelect: (key: string) => void; mobile: boolean }) {
  const [all, setAll] = useState(false);
  // Ref por estado: a fileira pode aparecer depois (lista vazia no começo).
  const [row, setRow] = useState<HTMLDivElement | null>(null);
  const width = useWidth(row);
  const d = dimsOf(kind, mobile);
  const picks = useMemo(() => toPicks(list), [list]);
  const fem = kind === 'actress';
  // Quantas cabem sem cortar: tira "Todas" e "Ver todas".
  const fit = width ? Math.max(0, Math.floor((width + GAP) / (d.w + GAP)) - 2) : 0;
  const n = Math.min(ROW_MAX, fit);
  const shown = picks.slice(0, n);
  // A escolhida aparece sempre na fileira (no lugar da última, se estiver fora).
  const sel = picks.find((p) => p.key === selected);
  if (sel && n > 0 && shown.indexOf(sel) < 0) shown[n - 1] = sel;
  if (!list.length && !busy) return null;
  const word = fem ? 'atrizes' : 'produtoras';
  return (
    <>
      <div ref={setRow} className={'act-row' + (kind === 'studio' ? ' st-row' : '')} data-nav-group="" aria-label={fem ? 'Atrizes' : 'Produtoras'}>
        <TextButton kind={kind} d={d} big="Todas" label="Todas" sub={busy ? 'buscando…' : `${list.length} ${word}`} on={!selected} active={!selected} onClick={() => onSelect('')} />
        {shown.map((p) => (
          <PickButton key={p.key} p={p} kind={kind} d={d} on={p.key === selected} active={p.key === selected} onPick={() => onSelect(p.key === selected ? '' : p.key)} />
        ))}
        {list.length > 0 && <TextButton kind={kind} d={d} big={list.length > shown.length ? `+${list.length - shown.length}` : '☰'} label="Ver todas" sub={fem ? `${list.length} ${word}` : undefined} onClick={() => setAll(true)} />}
      </div>
      {all && <PickPage kind={kind} picks={picks} selected={selected} mobile={mobile} onClose={() => setAll(false)} onSelect={(k) => { setAll(false); onSelect(k); }} />}
    </>
  );
}

/** Página com todas (várias fileiras) e um campo para procurar pelo nome. */
function PickPage({ kind, picks, selected, onSelect, onClose, mobile }: { kind: Kind; picks: Pick[]; selected: string; onSelect: (k: string) => void; onClose: () => void; mobile: boolean }) {
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const d = dimsOf(kind, mobile);
  const fem = kind === 'actress';
  const k = actressKey(q);
  const found = (k ? picks.filter((p) => actressKey(p.name).indexOf(k) >= 0) : picks).slice(0, 600);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // Foco na escolhida (ou na primeira), e não no campo de texto (o teclado da TV abriria).
    requestAnimationFrame(() => focusEl(grid.current?.querySelector<HTMLElement>('[data-nav-active]')) || focusFirst(grid.current));
    const off = pushBack(() => {
      onClose();
      return true;
    });
    return () => {
      off();
      requestAnimationFrame(() => prev?.focus?.());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stage = document.querySelector('.stage');
  const page = (
    <div className="vod-detail screen-in pick-page" data-nav-scope="" ref={box}>
      <div className="pick-head">
        <button className="chip" data-nav="" onClick={onClose}>‹ Voltar</button>
        <span className="title" style={{ fontSize: mobile ? 24 : 32, fontWeight: 800 }}>{fem ? 'Atrizes' : 'Produtoras'}</span>
        <span className="muted">{picks.length.toLocaleString('pt-BR')}</span>
        <div className="field pick-search">
          <input data-nav="" type="search" value={q} placeholder={fem ? 'Nome da atriz' : 'Nome da produtora'} autoCapitalize="off" autoCorrect="off" onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div ref={grid} className="pick-grid scroll-y" data-nav-group="">
        {found.length === 0 && <span className="muted">{fem ? 'Nenhuma atriz com esse nome nesta categoria.' : 'Nenhuma produtora com esse nome nesta categoria.'}</span>}
        {found.map((p) => (
          <PickButton key={p.key} p={p} kind={kind} d={d} on={p.key === selected} active={p.key === selected} onPick={() => onSelect(p.key)} />
        ))}
      </div>
    </div>
  );
  return stage ? createPortal(page, stage) : page;
}
