import { ProtectionPanel } from './Protection';
import { SubscriptionCard } from './Subscription';
import { CloudRows } from "./CloudSync";
import { forgetSource, savedSources, sourceKey } from '../core/sources';
import { useEffect, useRef, useState } from 'react';
import { IS_WEBOS, IS_ANDROID } from '../core/platform';
import { DEFAULT_SETTINGS, useSettings, type Settings as S } from '../core/settings';
import type { Channel, Playlist, SourceConfig } from '../core/types';
import { useLayout } from '../ui/layout';
import { dirOf, focusFirst } from '../ui/nav';
import { T } from '../ui/tokens';
import { THEMES } from '../ui/themes';
import { ProfilesPanel } from './Profiles';
import { clearTmdbCache, testKey, tmdbKey } from '../core/tmdb';
import { testTpdbKey, tpdbKey } from '../core/tpdb';
import { prefSet } from '../core/storage';
import { ConfirmButton } from '../ui/Dialog';
import { applyBackup, exportBackup, pickBackupFile } from '../core/backup';
import { clearScheduleCache, guideCoverage } from '../core/schedule';
import { PUBLIC_GUIDES, extraGuides, extraStatus, loadXmltv, setExtraGuides } from '../core/xmltv';
import { runningVersion } from '../core/updater';
import { loadTops, onTops, topsStatus } from '../core/tops';
import { UpdatePanel } from './UpdatePanel';
import { clearEpgCache } from '../core/epg';
import { clearXmltv } from '../core/xmltv';

// Ajustes do PRISMA: Tela · Player · Aparência · Lista · Sobre.
// Cada opção é um seletor: OK (ou clique) avança; ◀ ▶ no controle trocam.

export type Section = 'tela' | 'player' | 'aparencia' | 'perfis' | 'protecao' | 'lista' | 'servicos' | 'dados' | 'sobre';

const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: 'tela', label: 'Tela', hint: 'Tamanho, margens e formato da interface' },
  { id: 'player', label: 'Player', hint: 'Vídeo e informações na tela cheia' },
  { id: 'aparencia', label: 'Aparência', hint: 'Estrutura e tema' },
  { id: 'perfis', label: 'Perfis', hint: 'Quem está assistindo' },
  { id: 'protecao', label: 'Proteção', hint: 'Senha, categorias protegidas e escondidas' },
  { id: 'lista', label: 'Lista', hint: 'Sua assinatura IPTV' },
  { id: 'servicos', label: 'Serviços', hint: 'TMDB, tops e recomendações, placar' },
  { id: 'dados', label: 'Dados e limpeza', hint: 'Histórico, favoritos e cache' },
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

/** Ações de limpeza (o App é quem guarda esses dados). */
export interface DataActions {
  counts: { recents: number; favs: number; sections: number; sectionLinks: number; progress: number };
  clearRecents: () => void;
  clearFavs: () => void;
  clearSections: () => void;
  clearSectionOrder: () => void;
  clearProgress: () => void;
  clearAll: () => void;
}

export function Settings({
  playlist, onReload, onChange, onSwitch, onRemove, reloading, data, initialSection,
}: {
  playlist: Playlist;
  onReload: () => void;
  onChange: () => void;
  /** Trocar para outra lista já usada. */
  onSwitch?: (src: SourceConfig) => void;
  onRemove: () => void;
  reloading: boolean;
  data: DataActions;
  /** Abrir direto numa seção (ex.: 'sobre' pelo aviso de atualização). */
  initialSection?: Section;
}) {
  const [sec, setSec] = useState<Section>(initialSection ?? 'tela');
  const [, setTickL] = useState(0);
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
          label="Visual da tela cheia"
          help="Vale para a barra do canal e para a lista de canais por cima do vídeo (OK na tela cheia). Clássica: cinza translúcido, no estilo dos receptores (logo, número, Atual/próximo e a fileira de funções). Prisma: escuro, com as cores do tema escolhido. Cartão: ao trocar de canal sobe um cartão elegante com o programa e o tempo (OK abre a lista e Menu as funções, como na Clássica)."
          value={st.osdStyle}
          options={[{ v: 'classic', label: 'Clássica' }, { v: 'prisma', label: 'Prisma' }, { v: 'card', label: 'Cartão' }]}
          onChange={set('osdStyle')}
        />
        <Choice
          label="Tempo das informações"
          help="Quantos segundos as informações e os botões ficam na tela."
          value={st.osdSeconds}
          options={[3, 5, 8, 12].map((v) => ({ v, label: `${v} segundos` }))}
          onChange={set('osdSeconds')}
        />
        {IS_ANDROID && (
          <Choice
            label="Player de filmes e séries"
            help="Android: o player do Android (ExoPlayer) troca áudio e legenda de qualquer filme e é mais estável; a engrenagem dele tem áudio, legendas e velocidade. Se algum filme não tocar, volte para o player do PRISMA."
            value={st.androidPlayer ?? 'exo'}
            options={[{ v: 'exo', label: 'Do Android (ExoPlayer)' }, { v: 'web', label: 'Do PRISMA' }]}
            onChange={set('androidPlayer')}
          />
        )}
        <Choice
          label="Tamanho da legenda"
          help="Vale para as legendas dos filmes, séries e canais, inclusive as carregadas de um arquivo."
          value={st.subSize}
          options={[{ v: 'p', label: 'Pequena' }, { v: 'm', label: 'Média' }, { v: 'g', label: 'Grande' }, { v: 'gg', label: 'Muito grande' }]}
          onChange={set('subSize')}
        />
        <Choice
          label="Cor e fundo da legenda"
          help="Contorno deixa a letra legível sem tampar a imagem; faixa preta ajuda em cenas claras."
          value={st.subColor + '|' + st.subBg}
          options={[
            { v: 'white|shadow', label: 'Branca com contorno' },
            { v: 'yellow|shadow', label: 'Amarela com contorno' },
            { v: 'white|box', label: 'Branca em faixa preta' },
            { v: 'yellow|box', label: 'Amarela em faixa preta' },
            { v: 'white|none', label: 'Branca simples' },
          ]}
          onChange={(v: string) => {
            const [c, b] = v.split('|');
            update({ subColor: c as 'white' | 'yellow', subBg: b as 'none' | 'shadow' | 'box' });
          }}
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
          help="Menu Horizontal: menu em pílula no topo. Menu Vertical: menu lateral de ícones. No celular é sempre o Menu Horizontal."
          value={st.structure === 'C' ? 'C' : 'A'}
          options={[{ v: 'A', label: 'Menu Horizontal' }, { v: 'C', label: 'Menu Vertical' }]}
          onChange={set('structure')}
        />
        <Choice
          label="Sons de navegação"
          help="Um clique bem suave ao mover o foco com o controle e ao confirmar com OK, como na Apple TV."
          value={st.navSounds ? 'on' : 'off'}
          options={[{ v: 'off', label: 'Desligados' }, { v: 'on', label: 'Ligados' }]}
          onChange={(v) => update({ navSounds: v === 'on' })}
        />
        <Choice
          label="Tema"
          help="Só muda a aparência (cores, botões e cantos). Vale para este perfil."
          value={st.theme}
          options={THEMES.map((t) => ({ v: t.id, label: t.name }))}
          onChange={set('theme')}
        />
        <div className="opt-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
          {THEMES.map((t) => (
            <button key={t.id} className={'theme-swatch' + (st.theme === t.id ? ' on' : '')} data-nav="" onClick={() => update({ theme: t.id })} style={{ background: t.bg, borderColor: st.theme === t.id ? t.text : 'rgba(255,255,255,0.15)' }}>
              <span style={{ background: t.primary }} />
              <span style={{ background: t.live }} />
              <span style={{ background: t.ambient[0] }} />
              <b style={{ color: t.text, fontFamily: t.titleFont }}>{t.name}</b>
            </button>
          ))}
        </div>
        <Choice
          label="Logotipos dos canais"
          help="Oficiais: usa os logos embutidos no PRISMA (e os que você escolher) antes dos que vieram na lista. Da lista: o contrário."
          value={st.logoSource}
          options={[{ v: 'official', label: 'Oficiais primeiro' }, { v: 'list', label: 'Da lista primeiro' }]}
          onChange={set('logoSource')}
        />
        <Choice
          label="Visual de cada streaming"
          help="Em Filmes e Séries, ao entrar num streaming. Marcante: o mais perto do app oficial — fonte, cores, capas em pé ou deitadas, foco do controle, destaque grande no topo e nomes das fileiras. Só as cores: troca cores, cantos e letra (como na 0.27). Original: o PRISMA não muda nada."
          value={st.streamSkin}
          options={[{ v: 'marcante', label: 'Marcante' }, { v: 'cores', label: 'Só as cores' }, { v: 'off', label: 'Original' }]}
          onChange={set('streamSkin')}
        />
        <Choice
          label="Logotipos dos streamings"
          help="Nos botões de Netflix, HBO Max, Disney+… em Filmes e Séries. Coloridos: as cores de cada marca. Brancos: todos em branco, mais discreto e minimalista."
          value={st.streamLogos}
          options={[{ v: 'color', label: 'Coloridos' }, { v: 'mono', label: 'Brancos' }]}
          onChange={set('streamLogos')}
        />
      </>
    );
  } else if (sec === 'perfis') {
    panel = <ProfilesPanel />;
  } else if (sec === 'protecao') {
    panel = <ProtectionPanel playlist={playlist} />;
  } else if (sec === 'lista') {
    const s = playlist.source;
    const count = (k: Channel['kind']) => playlist.items.filter((i) => i.kind === k).length.toLocaleString('pt-BR');
    const kind = s.type === 'xtream' ? 'Xtream (Smarters / XCIPTV)' : s.type === 'm3u' ? 'Link M3U' : 'Arquivo M3U';
    const rows: [string, string][] = [
      ['Nome', s.name],
      ['Tipo', kind],
      ...(s.type === 'xtream' ? ([['Servidor', s.server], ['Usuário', s.username]] as [string, string][]) : []),
      ...(s.type === 'm3u' ? ([['Link', s.url.replace(/(password=)[^&]+/i, '$1••••')]] as [string, string][]) : []),
      ['Conteúdo', `${count('live')} canais · ${count('movie')} filmes · ${count('series')} séries`],
      ['Atualizada', new Date(playlist.loadedAt).toLocaleString('pt-BR')],
      ['Guia de programação', guideSummary(playlist)],
      ['Gravações (voltar na programação)', archiveSummary(playlist)],
    ];
    panel = (
      <>
        <SubscriptionCard playlist={playlist} />
        <Info rows={rows} />
        {(() => {
          const others = savedSources().filter((x) => sourceKey(x) !== sourceKey(s));
          if (!others.length) return null;
          return (
            <>
              <span className="prot-h">Suas outras listas</span>
              <div className="prot-list">
                {others.map((x) => (
                  <div key={sourceKey(x)} className="prot-row">
                    <span className="prot-name">{x.name || (x.type === 'xtream' ? x.server : 'Lista M3U')}</span>
                    <span className="muted prot-count" style={{ width: 'auto' }}>{x.type === 'xtream' ? 'Xtream' : x.type === 'm3u' ? 'Link M3U' : 'Arquivo'}</span>
                    {x.type !== 'm3u-file' && <button className="chip" data-nav="" onClick={() => onSwitch?.(x)}>Usar esta</button>}
                    <button className="chip" data-nav="" onClick={() => { forgetSource(x); setSec('lista'); setTickL((v) => v + 1); }}>Esquecer</button>
                  </div>
                ))}
              </div>
            </>
          );
        })()}
        <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn primary" data-nav="" disabled={reloading || s.type === 'm3u-file'} onClick={onReload}>
            {reloading ? 'Atualizando…' : 'Atualizar lista agora'}
          </button>
          <button className="btn" data-nav="" onClick={onChange}>+ Adicionar ou trocar lista</button>
          <button className="btn" data-nav="" onClick={onRemove}>Remover lista</button>
        </div>
        <ExtraGuides playlist={playlist} />
      </>
    );
  } else if (sec === 'servicos') {
    panel = <Services />;
  } else if (sec === 'dados') {
    const n = data.counts;
    const Row = ({ label, help, children }: { label: string; help: string; children: React.ReactNode }) => (
      <div className="opt-row" style={{ display: 'flex', alignItems: mobile ? 'stretch' : 'center', flexDirection: mobile ? 'column' : 'row' }}>
        <div className="gy-4" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, marginRight: mobile ? 0 : 20, marginBottom: mobile ? 10 : 0 }}>
          <span style={{ fontSize: mobile ? 16 : 18, fontWeight: 700 }}>{label}</span>
          <span className="muted" style={{ fontSize: mobile ? 14 : 15, lineHeight: 1.35 }}>{help}</span>
        </div>
        {children}
      </div>
    );
    panel = (
      <>
        <CloudRows Row={Row} />
        <BackupRows Row={Row} />
        <Row label="Limpar histórico" help={`Esvazia “Vistos por último” e o “Continuar assistindo” do Início. ${n.recents} canais no histórico.`}>
          <ConfirmButton label="Limpar histórico" onConfirm={data.clearRecents} done="Histórico limpo" />
        </Row>
        <Row label="Limpar favoritos" help={`Remove todos os canais favoritos (estrela). ${n.favs} favoritos.`}>
          <ConfirmButton label="Limpar favoritos" onConfirm={data.clearFavs} done="Favoritos limpos" />
        </Row>
        <Row label="Apagar seções criadas" help={`Remove as ${n.sections} seções que você criou e os ${n.sectionLinks} canais acrescentados às seções.`}>
          <ConfirmButton label="Apagar seções" onConfirm={data.clearSections} done="Seções apagadas" />
        </Row>
        <Row label="Restaurar ordem das seções" help="Volta as seções para a ordem original da lista (mantém as criadas).">
          <ConfirmButton label="Restaurar ordem" onConfirm={data.clearSectionOrder} done="Ordem restaurada" />
        </Row>
        <Row label="Limpar progresso de filmes e séries" help={`Esquece onde você parou em filmes e episódios. ${n.progress} itens com progresso.`}>
          <ConfirmButton label="Limpar progresso" onConfirm={data.clearProgress} done="Progresso limpo" />
        </Row>
        <Row label="Limpar guia de programação" help="Apaga o guia guardado na memória. Ele é baixado de novo quando você abrir um canal.">
          <ConfirmButton label="Limpar guia" onConfirm={() => { clearEpgCache(); clearXmltv(); }} done="Guia limpo" />
        </Row>
        <Row label="Restaurar ajustes" help="Volta Tela, Player e Aparência para o padrão.">
          <ConfirmButton label="Restaurar ajustes" onConfirm={() => update(DEFAULT_SETTINGS)} done="Ajustes restaurados" />
        </Row>
        <Row label="Apagar tudo deste aparelho" help="Remove a lista, histórico, favoritos, seções, progresso e ajustes. O app volta como novo; a sua assinatura não é afetada.">
          <ConfirmButton label="Apagar tudo" confirmLabel="Tem certeza? Toque de novo" onConfirm={data.clearAll} />
        </Row>
      </>
    );
  } else {
    const platform = IS_WEBOS ? 'TV LG (webOS)' : IS_ANDROID ? 'Android' : /electron/i.test(navigator.userAgent) ? 'Programa para Windows' : 'Navegador';
    panel = (
      <>
        <Info
          rows={[
            ['Versão do PRISMA', runningVersion()],
            ['Aparelho', platform],
            ['Tela', `${Math.round(L.realW * L.dpr)} × ${Math.round(L.realH * L.dpr)} pixels (densidade ${L.dpr.toLocaleString('pt-BR')}×)`],
            ['Proporção', proportion(L.realW, L.realH)],
            ['Logotipos', 'tv-logo/tv-logos (CC BY-SA), uso pessoal'],
            ['Interface', `${L.form === 'tv' ? 'TV e computador' : 'Celular'} · área ${Math.round(L.W)} × ${Math.round(L.H)} · escala ${L.scale.toFixed(2)}×`],
          ]}
        />
        <UpdatePanel />
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
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', marginRight: 24, minHeight: 0 }}>
        <span className="title" style={{ fontSize: 26, marginBottom: 12, flexShrink: 0 }}>Ajustes</span>
        {/* As seções rolam quando não cabem (TV de 720p, interface aumentada). */}
        <div className="scroll-y gy-10 sec-col" style={{ flexGrow: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 6, margin: -6 }}>{tabs}</div>
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

/** Ajustes › Serviços: chave do TMDB (capas, trailers, Top 10) e informação do placar. */
function Services() {
  const { settings: st, update } = useSettings();
  const [key, setKey] = useState(st.tmdbKey || tmdbKey());
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'bad'>(st.tmdbKey ? 'ok' : 'idle');
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const save = async () => {
    const k = key.trim();
    if (!k) {
      update({ tmdbKey: '' });
      prefSet('tmdbKey', '');
      setState('idle');
      return;
    }
    setState('testing');
    const ok = await testKey(k);
    setState(ok ? 'ok' : 'bad');
    if (ok) {
      update({ tmdbKey: k });
      prefSet('tmdbKey', k); // vale para todos os perfis
      clearTmdbCache();
    }
  };
  return (
    <>
      <div className="opt-row gy-10" style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: mobile ? 16 : 18, fontWeight: 700 }}>TMDB · capas, sinopses, trailers e Top 10</span>
        <span className="muted" style={{ fontSize: 15, lineHeight: 1.45 }}>
          Crie uma conta grátis em <b>themoviedb.org</b> › Configurações › API › “Chave da API (v3)” e cole aqui. Com a sincronização pela nuvem ligada (Ajustes › Dados), ela vai sozinha para a TV e o celular.
        </span>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="field" style={{ flexGrow: 1, minWidth: 260, marginRight: 12 }}>
            <input data-nav="" value={key} placeholder="Chave da API (v3), 32 caracteres" autoCapitalize="off" autoCorrect="off" onChange={(e) => { setKey(e.target.value); setState('idle'); }} />
          </div>
          <button className="btn primary" data-nav="" onClick={save} disabled={state === 'testing'} style={{ marginTop: mobile ? 10 : 0 }}>
            {state === 'testing' ? 'Testando…' : key.trim() ? 'Salvar e testar' : 'Remover chave'}
          </button>
        </div>
        {state === 'ok' && <span style={{ color: T.primary, fontWeight: 700, fontSize: 15 }}>✓ TMDB ligado: capas, trailers e Top 10 ativados.</span>}
        {state === 'bad' && <span style={{ color: T.live, fontWeight: 700, fontSize: 15 }}>Chave recusada pelo TMDB (ou sem internet). Confira se é a “Chave da API (v3)”.</span>}
      </div>
      <TpdbRow mobile={mobile} />
      <TopsRow mobile={mobile} />
      <div className="opt-row gy-6" style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: mobile ? 16 : 18, fontWeight: 700 }}>Placar ao vivo</span>
        <span className="muted" style={{ fontSize: 15, lineHeight: 1.45 }}>
          Automático, sem chave: placares públicos da ESPN (Brasileirão, Libertadores, Copa do Brasil, Champions, ligas europeias, NBA, NFL, UFC), cruzados com os jogos do guia.
        </span>
      </div>
    </>
  );
}

/** Ajustes › Serviços: ThePornDB (0.31.0) — capas oficiais dos títulos de adulto que vêm com capa genérica. */
function TpdbRow({ mobile }: { mobile: boolean }) {
  const [key, setKey] = useState(tpdbKey());
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'bad'>(tpdbKey() ? 'ok' : 'idle');
  const save = async () => {
    const k = key.trim();
    if (!k) {
      prefSet('tpdbKey', '');
      setState('idle');
      return;
    }
    setState('testing');
    const ok = await testTpdbKey(k);
    setState(ok ? 'ok' : 'bad');
    if (ok) {
      prefSet('tpdbKey', k);
      clearTmdbCache(); // procura de novo as capas que ficaram sem
    }
  };
  return (
    <div className="opt-row gy-10" style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: mobile ? 16 : 18, fontWeight: 700 }}>ThePornDB · capas da categoria de adultos</span>
      <span className="muted" style={{ fontSize: 15, lineHeight: 1.45 }}>
        Para os títulos de adulto que a lista manda com capa genérica: primeiro o PRISMA procura no TMDB; o que faltar, aqui. Crie uma conta grátis em <b>theporndb.net</b> › seu perfil › API Tokens e cole o token. As capas continuam atrás da senha de Proteção.
      </span>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="field" style={{ flexGrow: 1, minWidth: 260, marginRight: 12 }}>
          <input data-nav="" type={show ? 'text' : 'password'} value={key} placeholder="Token da API" autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => { setKey(e.target.value); setState('idle'); }} />
        </div>
        <button className="btn" data-nav="" onClick={() => setShow((s) => !s)} style={{ marginTop: mobile ? 10 : 0, marginRight: 12 }}>
          {show ? 'Ocultar' : 'Mostrar'}
        </button>
        <button className="btn" data-nav="" onClick={save} disabled={state === 'testing'} style={{ marginTop: mobile ? 10 : 0 }}>
          {state === 'testing' ? 'Testando…' : key.trim() ? 'Salvar e testar' : 'Remover token'}
        </button>
      </div>
      {state === 'ok' && <span style={{ color: T.primary, fontWeight: 700, fontSize: 15 }}>✓ ThePornDB ligada.</span>}
      {state === 'bad' && <span style={{ color: T.live, fontWeight: 700, fontSize: 15 }}>Token recusado (ou sem internet).</span>}
    </div>
  );
}

/** Ajustes › Serviços: situação dos tops (Top 10 dos streamings, gêneros e canais). */
function TopsRow({ mobile }: { mobile: boolean }) {
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => onTops(() => force((x) => x + 1)), []);
  useEffect(() => {
    loadTops().then(() => force((x) => x + 1));
  }, []);
  const { data, error } = topsStatus();
  const fmt = (t: number | string) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="opt-row gy-10" style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: mobile ? 16 : 18, fontWeight: 700 }}>Tops e recomendações</span>
      <span className="muted" style={{ fontSize: 15, lineHeight: 1.45 }}>
        Top 10 oficial da Netflix no Brasil, mais populares de cada streaming, gêneros (terror, comédia…), lançamentos, doramas, animes e o ranking de canais. Atualizados automaticamente várias vezes por dia, sem chave; aparecem em Filmes e Séries (botão 🔥 Top) e no Início, só com o que está na sua lista.
      </span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>
        {data
          ? `${data.lists.length} listas · geradas em ${fmt(data.updated)} · baixadas neste aparelho em ${fmt(data.at)}`
          : busy
            ? 'Baixando…'
            : `Ainda não baixadas${error ? ` (${error})` : ''}.`}
      </span>
      {data && error && <span style={{ color: T.live, fontSize: 14 }}>Última tentativa falhou ({error}); usando as listas já baixadas.</span>}
      <div className="wrap-row" style={{ display: 'flex' }}>
        <button
          className="btn"
          data-nav=""
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await loadTops(true);
            setBusy(false);
          }}
        >
          {busy ? 'Atualizando…' : 'Atualizar agora'}
        </button>
      </div>
    </div>
  );
}

/** Ajustes › Dados: levar favoritos, seções e Minha lista para outro aparelho. */
function BackupRows({ Row }: { Row: (p: { label: string; help: string; children: React.ReactNode }) => React.ReactElement }) {
  const [msg, setMsg] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  if (IS_WEBOS)
    return (
      <Row label="Levar para outro aparelho" help="Na TV LG não dá para escolher arquivos. Exporte no computador ou no celular; os dados deste perfil continuam aqui.">
        <span />
      </Row>
    );
  const importText = (text: string, mode: 'merge' | 'replace') => {
    try {
      setMsg(applyBackup(text, mode) + ' Reabrindo…');
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <>
      <Row label="Exportar meus dados" help="Gera um arquivo com favoritos, seções, Minha lista, histórico, progresso, lembretes e ajustes deste perfil. A senha da lista não vai no arquivo.">
        <button className="btn primary" data-nav="" onClick={() => exportBackup().then(setMsg, (e: Error) => setMsg('Não deu para exportar: ' + e.message))}>
          Exportar
        </button>
      </Row>
      <Row label="Importar de outro aparelho" help="Escolha o arquivo exportado. “Juntar” soma ao que já existe aqui; “Substituir” troca tudo pelo do arquivo.">
        {pending ? (
          <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <button className="btn primary" data-nav="" onClick={() => importText(pending, 'merge')}>Juntar</button>
            <button className="btn" data-nav="" onClick={() => importText(pending, 'replace')}>Substituir</button>
            <button className="btn" data-nav="" onClick={() => setPending(null)}>Cancelar</button>
          </div>
        ) : (
          <button className="btn" data-nav="" onClick={() => pickBackupFile().then((t) => t && setPending(t))}>
            Escolher arquivo
          </button>
        )}
      </Row>
      {msg && <span className="muted" role="status" style={{ fontSize: 15 }}>{msg}</span>}
    </>
  );
}

/** O que a lista entrega de guia: canais com programação e de que dia a que dia. */
function guideSummary(pl: Playlist): string {
  const c = guideCoverage();
  const live = pl.items.filter((i) => i.kind === 'live').length;
  if (!c) return 'ainda não baixado (abre sozinho uns segundos depois de iniciar)';
  if (!c.channels) return 'a lista não enviou guia completo (XMLTV); só “agora e a seguir” por canal';
  const d = (t: number) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const back = Math.max(0, Math.round((today.getTime() - new Date(c.from).setHours(0, 0, 0, 0)) / 86400000));
  const ahead = Math.max(0, Math.round((new Date(c.to).setHours(0, 0, 0, 0) - today.getTime()) / 86400000));
  return `${c.channels.toLocaleString('pt-BR')} de ${live.toLocaleString('pt-BR')} canais · ${d(c.from)} a ${d(c.to)} (${back} ${back === 1 ? 'dia' : 'dias'} para trás, ${ahead} à frente)${c.limited ? ' · nesta TV o app guarda só 1 dia para trás e 2 à frente' : ''}`;
}

function archiveSummary(pl: Playlist): string {
  const rec = pl.items.filter((i) => i.kind === 'live' && i.catchupDays && i.catchupDays > 0);
  if (!rec.length) return 'nenhum canal da lista grava';
  const max = Math.max(...rec.map((i) => i.catchupDays!));
  return `${rec.length.toLocaleString('pt-BR')} canais gravam · até ${max} ${max === 1 ? 'dia' : 'dias'}`;
}

/** Ajustes › Lista: guias de programação extras (XMLTV) para canais sem guia. */
function ExtraGuides({ playlist }: { playlist: Playlist }) {
  const [list, setList] = useState(extraGuides());
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);
  const apply = async (next: string[]) => {
    setExtraGuides(next);
    setList(extraGuides());
    setBusy(true);
    try {
      clearScheduleCache();
      await loadXmltv(playlist, true);
    } finally {
      setBusy(false);
      force((x) => x + 1);
    }
  };
  return (
    <div className="opt-row gy-10" style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
      <span style={{ fontSize: 18, fontWeight: 700 }}>Guia de programação extra</span>
      <span className="muted" style={{ fontSize: 15, lineHeight: 1.4 }}>
        Endereços de guias XMLTV (.xml ou .xml.gz) para completar os canais que a sua lista deixa sem programação. O guia da lista tem prioridade; os extras só preenchem o que falta, pelo nome do canal.
      </span>
      {list.map((u) => (
        <div key={u} className="xg-row">
          <span className="xg-url">{u}</span>
          <span className="muted xg-st">{busy ? 'lendo…' : extraStatus[u] ?? ''}</span>
          <button className="btn" data-nav="" onClick={() => apply(list.filter((x) => x !== u))}>Remover</button>
        </div>
      ))}
      <div className="field" style={{ display: 'flex' }}>
        <input data-nav="" value={url} placeholder="https://…/guia.xml.gz" onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if ((e.key === 'Enter' || e.keyCode === 13) && url.trim()) { apply([...list, url.trim()]); setUrl(''); } }} />
      </div>
      <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
        <button className="btn primary" data-nav="" disabled={!url.trim() || busy} onClick={() => { apply([...list, url.trim()]); setUrl(''); }}>Adicionar guia</button>
        {list.length > 0 && <button className="btn" data-nav="" disabled={busy} onClick={() => apply(list)}>{busy ? 'Lendo os guias…' : 'Ler de novo'}</button>}
      </div>
      <span className="muted" style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>Guias públicos sugeridos (Brasil) — podem mudar de endereço ou sair do ar:</span>
      <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {PUBLIC_GUIDES.map((g) => (
          <button key={g.url} className="btn" data-nav="" disabled={busy || list.includes(g.url)} onClick={() => apply([...list, g.url])}>
            {list.includes(g.url) ? '✓ ' : '+ '}
            {g.name}
          </button>
        ))}
      </div>
    </div>
  );
}
