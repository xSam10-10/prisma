import { useEffect, useRef, useState } from 'react';
import { IS_WEBOS } from '../core/platform';
import { DEFAULT_SETTINGS, useSettings, type Settings as S } from '../core/settings';
import type { Channel, Playlist } from '../core/types';
import { useLayout } from '../ui/layout';
import { dirOf, focusFirst } from '../ui/nav';
import { T } from '../ui/tokens';
import { VERSION } from '../version';

// Ajustes do PRISMA: Tela · Player · Aparência · Lista · Sobre.
// Cada opção é um seletor: OK (ou clique) avança; ◀ ▶ no controle trocam.

type Section = 'tela' | 'player' | 'aparencia' | 'lista' | 'sobre';

const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: 'tela', label: 'Tela', hint: 'Tamanho, margens e formato da interface' },
  { id: 'player', label: 'Player', hint: 'Vídeo e informações na tela cheia' },
  { id: 'aparencia', label: 'Aparência', hint: 'Estrutura e tema' },
  { id: 'lista', label: 'Lista', hint: 'Sua assinatura IPTV' },
  { id: 'sobre', label: 'Sobre', hint: 'Versão e diagnóstico da tela' },
];

interface Opt<V> {
  v: V;
  label: string;
}

function Choice<V>({ label, help, value, options, onChange, disabled }: { label: string; help?: string; value: V; options: Opt<V>[]; onChange: (v: V) => void; disabled?: boolean }) {
  const i = Math.max(0, options.findIndex((o) => o.v === value));
  const go = (d: number) => onChange(options[(i + d + options.length) % options.length].v);
  const L = useLayout();
  const mobile = L.form === 'mobile';
  return (
    <div className="opt-row" style={{ display: 'flex', alignItems: mobile ? 'stretch' : 'center', flexDirection: mobile ? 'column' : 'row' }}>
      <div className="gy-4" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, marginRight: mobile ? 0 : 20, marginBottom: mobile ? 10 : 0 }}>
        <span style={{ fontSize: mobile ? 16 : 18, fontWeight: 700 }}>{label}</span>
        {help && <span className="muted" style={{ fontSize: mobile ? 14 : 15, lineHeight: 1.35 }}>{help}</span>}
      </div>
      <button
        className="choice"
        data-nav=""
        disabled={disabled}
        aria-label={`${label}: ${options[i].label}`}
        onClick={() => go(1)}
        onKeyDown={(e) => {
          const d = dirOf(e);
          if (d === 'left' || d === 'right') {
            e.preventDefault();
            go(d === 'left' ? -1 : 1);
          }
        }}
      >
        <span className="arrow" aria-hidden="true">‹</span>
        <span style={{ flexGrow: 1, textAlign: 'center' }}>{options[i].label}</span>
        <span className="arrow" aria-hidden="true">›</span>
      </button>
    </div>
  );
}

function Info({ rows }: { rows: [string, string][] }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  return (
    <>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', fontSize: mobile ? 15 : 17, padding: '4px 0' }}>
          <span className="muted" style={{ width: mobile ? undefined : 230, flexShrink: 0 }}>{k}</span>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: mobile ? 'normal' : 'nowrap', wordBreak: 'break-all' }}>{v}</span>
        </div>
      ))}
    </>
  );
}

export function Settings({
  playlist, onReload, onChange, onRemove, reloading,
}: {
  playlist: Playlist;
  onReload: () => void;
  onChange: () => void;
  onRemove: () => void;
  reloading: boolean;
}) {
  const [sec, setSec] = useState<Section>('tela');
  const { settings: st, update } = useSettings();
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => focusFirst(root.current, '.sec.on'));
  }, []);

  const set = <K extends keyof S>(k: K) => (v: S[K]) => update({ [k]: v } as Partial<S>);

  let panel: React.ReactNode;
  if (sec === 'tela') {
    panel = (
      <>
        <Choice
          label="Formato da interface"
          help="Automático escolhe pela tela: TV e computador (inclusive ultrawide e 4K) ou celular. Force um deles se preferir."
          value={st.layoutForm}
          options={[{ v: 'auto', label: 'Automático' }, { v: 'tv', label: 'TV e computador' }, { v: 'mobile', label: 'Celular' }]}
          onChange={set('layoutForm')}
        />
        <Choice
          label="Tamanho da interface"
          help="Aumenta ou diminui textos e botões. Útil em TV grande vista de longe ou monitor muito perto."
          value={st.uiScale}
          options={[0.8, 0.9, 1, 1.1, 1.2, 1.3].map((v) => ({ v, label: v === 1 ? 'Automático' : `${Math.round(v * 100)}%` }))}
          onChange={set('uiScale')}
        />
        <Choice
          label="Margem de segurança"
          help="Algumas TVs cortam as bordas da imagem. Se o menu ou os botões aparecerem cortados, aumente."
          value={st.safeMargin}
          options={[0, 0.025, 0.05, 0.075].map((v) => ({ v, label: v === 0 ? 'Nenhuma' : `${(v * 100).toLocaleString('pt-BR')}%` }))}
          onChange={set('safeMargin')}
        />
      </>
    );
  } else if (sec === 'player') {
    panel = (
      <>
        <Choice
          label="Informações na tela cheia"
          help="O que aparece por cima do vídeo ao abrir ou trocar de canal. Em “Nenhuma”, a imagem fica limpa; OK ou um toque mostra os botões."
          value={st.osd}
          options={[{ v: 'full', label: 'Completas' }, { v: 'name', label: 'Só o canal' }, { v: 'none', label: 'Nenhuma' }]}
          onChange={set('osd')}
        />
        <Choice
          label="Tempo das informações"
          help="Quantos segundos as informações e os botões ficam na tela."
          value={st.osdSeconds}
          options={[3, 5, 8, 12].map((v) => ({ v, label: `${v} segundos` }))}
          onChange={set('osdSeconds')}
        />
        <Choice
          label="Formato do vídeo"
          help="Ajustar mostra a imagem inteira (pode sobrar faixa preta, comum em ultrawide). Preencher ocupa a tela toda cortando as bordas. Esticar deforma a imagem."
          value={st.videoFit}
          options={[{ v: 'contain', label: 'Ajustar' }, { v: 'cover', label: 'Preencher' }, { v: 'fill', label: 'Esticar' }]}
          onChange={set('videoFit')}
        />
        <Choice
          label="Formato preferido ao vivo"
          help="A lista Xtream oferece HLS e MPEG-TS para cada canal. Se um travar, teste o outro."
          value={st.liveFormat}
          options={[{ v: 'auto', label: 'Automático' }, { v: 'hls', label: 'HLS (m3u8)' }, { v: 'ts', label: 'MPEG-TS' }]}
          onChange={set('liveFormat')}
        />
        <Choice
          label="Ao abrir o PRISMA"
          help="Começar direto no último canal assistido, em tela cheia."
          value={st.resumeLast}
          options={[{ v: false, label: 'Mostrar o menu' }, { v: true, label: 'Último canal' }]}
          onChange={set('resumeLast')}
        />
      </>
    );
  } else if (sec === 'aparencia') {
    panel = (
      <>
        <Choice
          label="Estrutura"
          help="A · Vidro Líquido está pronta. B · Cinema e C · Hub chegam no passo 5 da Fase 1."
          value="A"
          options={[{ v: 'A', label: 'A · Vidro Líquido' }]}
          onChange={() => {}}
        />
        <Choice
          label="Logotipos dos canais"
          help="Oficiais: usa os logos embutidos no PRISMA (e os que você escolher) antes dos que vieram na lista. Da lista: o contrário."
          value={st.logoSource}
          options={[{ v: 'official', label: 'Oficiais primeiro' }, { v: 'list', label: 'Da lista primeiro' }]}
          onChange={set('logoSource')}
        />
        <Choice
          label="Tema"
          help="Prisma é o padrão. O tema Netflix (já desenhado) e outros chegam no passo 5."
          value="prisma"
          options={[{ v: 'prisma', label: 'Prisma' }]}
          onChange={() => {}}
        />
      </>
    );
  } else if (sec === 'lista') {
    const s = playlist.source;
    const a = playlist.account;
    const count = (k: Channel['kind']) => playlist.items.filter((i) => i.kind === k).length.toLocaleString('pt-BR');
    const kind = s.type === 'xtream' ? 'Xtream (Smarters / XCIPTV)' : s.type === 'm3u' ? 'Link M3U' : 'Arquivo M3U';
    const rows: [string, string][] = [
      ['Nome', s.name],
      ['Tipo', kind],
      ...(s.type === 'xtream' ? ([['Servidor', s.server], ['Usuário', s.username]] as [string, string][]) : []),
      ...(s.type === 'm3u' ? ([['Link', s.url.replace(/(password=)[^&]+/i, '$1••••')]] as [string, string][]) : []),
      ...(a?.expiresAt ? ([['Vence em', new Date(a.expiresAt).toLocaleDateString('pt-BR')]] as [string, string][]) : []),
      ...(a?.maxConnections ? ([['Telas ao mesmo tempo', `${a.activeConnections ?? 0} em uso de ${a.maxConnections}`]] as [string, string][]) : []),
      ['Conteúdo', `${count('live')} canais · ${count('movie')} filmes · ${count('series')} séries`],
      ['Atualizada', new Date(playlist.loadedAt).toLocaleString('pt-BR')],
    ];
    panel = (
      <>
        <Info rows={rows} />
        <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn primary" data-nav="" disabled={reloading || s.type === 'm3u-file'} onClick={onReload}>
            {reloading ? 'Atualizando…' : 'Atualizar lista agora'}
          </button>
          <button className="btn" data-nav="" onClick={onChange}>Trocar lista</button>
          <button className="btn" data-nav="" onClick={onRemove}>Remover lista</button>
        </div>
      </>
    );
  } else {
    const platform = IS_WEBOS ? 'TV LG (webOS)' : /electron/i.test(navigator.userAgent) ? 'Programa para Windows' : 'Navegador';
    panel = (
      <>
        <Info
          rows={[
            ['Versão do PRISMA', VERSION],
            ['Aparelho', platform],
            ['Tela', `${Math.round(L.realW * L.dpr)} × ${Math.round(L.realH * L.dpr)} pixels (densidade ${L.dpr.toLocaleString('pt-BR')}×)`],
            ['Proporção', proportion(L.realW, L.realH)],
            ['Logotipos', 'tv-logo/tv-logos (CC BY-SA), uso pessoal'],
            ['Interface', `${L.form === 'tv' ? 'TV e computador' : 'Celular'} · área ${Math.round(L.W)} × ${Math.round(L.H)} · escala ${L.scale.toFixed(2)}×`],
          ]}
        />
        <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn" data-nav="" onClick={() => update(DEFAULT_SETTINGS)}>Restaurar ajustes padrão</button>
        </div>
      </>
    );
  }

  const tabs = SECTIONS.map((x) => (
    <button
      key={x.id}
      className={'sec' + (x.id === sec ? ' on' : '')}
      data-nav=""
      aria-current={x.id === sec ? 'page' : undefined}
      onFocus={() => setSec(x.id)}
      onClick={() => setSec(x.id)}
    >
      <span style={{ fontWeight: 700 }}>{x.label}</span>
      {!mobile && <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>{x.hint}</span>}
    </button>
  ));

  if (mobile) {
    return (
      <div ref={root} className="gy-12" style={{ position: 'absolute', left: L.px, right: L.px, top: L.top, bottom: L.bottom, display: 'flex', flexDirection: 'column' }}>
        <span className="title" style={{ fontSize: 24 }}>Ajustes</span>
        <div className="scroll-x" role="tablist" style={{ flexShrink: 0 }}>{tabs}</div>
        <div className="scroll-y opts" style={{ flexGrow: 1, minHeight: 0 }}>{panel}</div>
      </div>
    );
  }

  return (
    <div ref={root} style={{ position: 'absolute', left: L.px, right: L.px, top: L.top + 10, bottom: L.bottom, display: 'flex' }}>
      <div className="gy-10" style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', marginRight: 24 }}>
        <span className="title" style={{ fontSize: 26, marginBottom: 6 }}>Ajustes</span>
        {tabs}
      </div>
      <div className="glass" style={{ flexGrow: 1, minWidth: 0, borderRadius: T.radiusPanel, padding: '20px 28px', display: 'flex', flexDirection: 'column' }}>
        <div className="scroll-y opts" style={{ flexGrow: 1, minHeight: 0, padding: 6, margin: -6 }}>{panel}</div>
      </div>
    </div>
  );
}

function proportion(w: number, h: number): string {
  const r = Math.max(w, h) / Math.min(w, h);
  const known: [number, string][] = [[16 / 9, '16:9'], [16 / 10, '16:10'], [4 / 3, '4:3'], [21 / 9, '21:9 (ultrawide)'], [32 / 9, '32:9 (super ultrawide)'], [19.5 / 9, '19,5:9 (celular)'], [20 / 9, '20:9 (celular)']];
  let best = known[0];
  for (const k of known) if (Math.abs(k[0] - r) < Math.abs(best[0] - r)) best = k;
  const name = Math.abs(best[0] - r) < 0.06 ? best[1] : `${r.toFixed(2)}:1`;
  return `${name}${h > w ? ' · em pé' : ''}`;
}
