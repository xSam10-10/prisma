import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearPlaylist, loadSavedPlaylist, loadSource, savePlaylist } from './core/source';
import { loadLogoCatalogs } from './core/logos';
import { prefGet, prefSet } from './core/storage';
import { SourceError, type Channel, type Playlist, type SourceConfig } from './core/types';
import { AddList } from './screens/AddList';
import { LiveTV, liveGeometry } from './screens/LiveTV';
import { Home, Search, Soon } from './screens/Other';
import { Settings } from './screens/Settings';
import { SettingsContext, loadSettings, saveSettings, type Settings as SettingsT } from './core/settings';
import { LayoutContext, useViewportLayout, type Layout } from './ui/layout';
import { Player, type PlayerMode } from './screens/Player';
import { Ambient, Brand, Icon, Symbol } from './ui/bits';
import { focusEl, pushBack } from './ui/nav';

type Tab = 'inicio' | 'aovivo' | 'jogos' | 'filmes' | 'series' | 'anime' | 'busca' | 'lista' | 'ajustes';

const TABS: [Tab, string][] = [
  ['inicio', 'Início'],
  ['aovivo', 'Ao vivo'],
  ['jogos', 'Jogos'],
  ['filmes', 'Filmes'],
  ['series', 'Séries'],
  ['anime', 'Anime'],
];

const TAB_ICON: Record<string, string> = { inicio: '⌂', aovivo: '●', jogos: '◎', filmes: '▶', series: '▤', anime: '✦' };

export function App() {
  const [settings, setSettings] = useState<SettingsT>(loadSettings);
  const updateSettings = useCallback((patch: Partial<SettingsT>) => {
    setSettings((cur) => {
      const next = { ...cur, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);
  const settingsApi = useMemo(() => ({ settings, update: updateSettings }), [settings, updateSettings]);
  const L = useViewportLayout(settings);
  const scale = L.scale;
  const mobileForm = L.form === 'mobile';

  // Classes globais: forma da interface e toque.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('mobile', mobileForm);
    const touch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
    html.classList.toggle('touch', touch || mobileForm);
  }, [mobileForm]);
  const [phase, setPhase] = useState<'boot' | 'add' | 'app'>('boot');
  const [playlist, setPlaylist] = useState<Playlist>();
  const [progress, setProgress] = useState('');
  const [bootError, setBootError] = useState<SourceError | null>(null);
  const [tab, setTab] = useState<Tab>(() => prefGet<Tab>('tab', 'aovivo'));
  const [playing, setPlaying] = useState<Channel>();
  const [zapList, setZapList] = useState<Channel[]>([]);
  const [full, setFull] = useState(false);
  const [favIds, setFavIds] = useState<string[]>(() => prefGet('favs', []));
  const [recentIds, setRecentIds] = useState<string[]>(() => prefGet('recents', []));
  const [reloading, setReloading] = useState(false);

  // Abre a lista salva; se não houver, vai para "Adicionar lista".
  useEffect(() => {
    Promise.all([loadSavedPlaylist(), loadLogoCatalogs()]).then(([p]) => {
      if (p?.items?.length) {
        setPlaylist(p);
        setPhase('app');
        // Ajustes › Player › "Ao abrir o PRISMA: último canal".
        if (loadSettings().resumeLast) {
          const last = recentIds[0] && p.items.find((i) => i.id === recentIds[0] && i.kind === 'live');
          if (last) {
            setPlaying(last);
            setTab('aovivo');
            setFull(true);
          }
        }
      } else setPhase('add');
    });
  }, []);

  useEffect(() => prefSet('tab', tab === 'busca' || tab === 'ajustes' ? 'inicio' : tab), [tab]);
  useEffect(() => prefSet('favs', favIds), [favIds]);
  useEffect(() => prefSet('recents', recentIds), [recentIds]);

  const live = useMemo(() => playlist?.items.filter((i) => i.kind === 'live') ?? [], [playlist]);
  const byId = useMemo(() => new Map(live.map((c) => [c.id, c])), [live]);
  const favs = useMemo(() => favIds.map((id) => byId.get(id)).filter(Boolean) as Channel[], [favIds, byId]);
  const recents = useMemo(() => recentIds.map((id) => byId.get(id)).filter(Boolean) as Channel[], [recentIds, byId]);

  const isFav = useCallback((c: Channel) => favIds.includes(c.id), [favIds]);
  const toggleFav = useCallback((c: Channel) => setFavIds((f) => (f.includes(c.id) ? f.filter((x) => x !== c.id) : [...f, c.id])), []);

  const play = useCallback((c: Channel, list: Channel[]) => {
    setPlaying(c);
    if (list.length) setZapList(list);
    setRecentIds((r) => [c.id, ...r.filter((x) => x !== c.id)].slice(0, 30));
  }, []);

  const watchFull = useCallback(
    (c: Channel, list: Channel[]) => {
      play(c, list);
      setFull(true);
    },
    [play],
  );

  const onPlayerMode = useCallback((m: PlayerMode) => {
    if (m === 'full') setFull(true);
    else {
      setFull(false);
      setTab('aovivo');
      // Volta o foco para a lista de canais.
      setTimeout(() => focusEl(document.querySelector<HTMLElement>('.vlist')), 50);
    }
  }, []);

  // Voltar: das outras abas volta para o Início.
  useEffect(() => {
    if (phase !== 'app') return;
    return pushBack(() => {
      if (tab !== 'inicio') {
        setTab('inicio');
        return true;
      }
      return false;
    });
  }, [phase, tab]);

  const submitSource = async (src: SourceConfig) => {
    const p = await loadSource(src, setProgress);
    await savePlaylist(p);
    setPlaylist(p);
    setPlaying(undefined);
    setFull(false);
    setBootError(null);
    setTab('aovivo');
    setPhase('app');
  };

  const reload = async () => {
    if (!playlist) return;
    setReloading(true);
    try {
      const p = await loadSource(playlist.source);
      await savePlaylist(p);
      setPlaylist(p);
    } catch (e) {
      setBootError(e instanceof SourceError ? e : null);
      setPhase('add');
    } finally {
      setReloading(false);
    }
  };

  const mode: PlayerMode = !playing ? 'off' : full ? 'full' : tab === 'aovivo' ? 'preview' : 'off';

  let body: React.ReactNode = null;
  if (phase === 'boot') {
    body = (
      <div className="gy-24" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Ambient variant="home" />
        <Symbol size={120} />
        <div className="spinner" />
      </div>
    );
  } else if (phase === 'add') {
    body = (
      <AddList
        onSubmit={submitSource}
        progress={progress}
        initialError={bootError}
        onCancel={playlist ? () => setPhase('app') : undefined}
      />
    );
  } else if (playlist) {
    let screen: React.ReactNode;
    switch (tab) {
      case 'aovivo':
        screen = <LiveTV playlist={playlist} live={live} favIds={favIds} playing={playing} isFav={isFav} toggleFav={toggleFav} onPlay={play} onFull={() => setFull(true)} />;
        break;
      case 'inicio':
        screen = <Home playlist={playlist} live={live} favs={favs} recents={recents} onWatch={watchFull} onGoLive={() => setTab('aovivo')} />;
        break;
      case 'busca':
        screen = <Search playlist={playlist} onWatch={watchFull} />;
        break;
      case 'ajustes':
      case 'lista':
        screen =
          tab === 'ajustes' ? (
            <Settings
              playlist={playlist}
              reloading={reloading}
              onReload={reload}
              onChange={() => setPhase('add')}
              onRemove={async () => {
                await clearPlaylist();
                setPlaying(undefined);
                setPlaylist(undefined);
                setPhase('add');
              }}
            />
          ) : (
            <Soon title="Minha lista" step="Fase 1 · passo 4" text="Filmes e séries salvos para ver depois. Os canais favoritos já estão no Início e na aba Ao vivo › Favoritos." />
          );
        break;
      case 'jogos':
        screen = <Soon title="Jogos" step="Depois do guia (passo 3)" text="Guia de jogos com placar, onde assistir e lembrete. Depende do guia de programação e de uma fonte de placares." />;
        break;
      default: {
        const kind = tab === 'filmes' ? 'movie' : 'series';
        const n = playlist.items.filter((i) => i.kind === kind && (tab !== 'anime' || /anime/i.test(i.group))).length;
        screen = (
          <Soon
            title={tab === 'filmes' ? 'Filmes' : tab === 'series' ? 'Séries' : 'Anime'}
            step="Fase 1 · passo 4"
            text="Capas, sinopse e streamings (Netflix, HBO Max, Disney+…) com dados do TMDB e o mapeamento pelos grupos da lista."
            count={n}
          />
        );
      }
    }
    body = (
      <>
        <Ambient variant={tab === 'inicio' ? 'home' : 'live'} />
        {!full && (mobileForm ? <MobileBars tab={tab} onTab={setTab} L={L} /> : <TopBar tab={tab} onTab={setTab} L={L} />)}
        <div key={tab}>{screen}</div>
      </>
    );
  }

  return (
    <SettingsContext.Provider value={settingsApi}>
    <LayoutContext.Provider value={L}>
    <div className="viewport">
      <div className="stage" style={{ width: L.W, height: L.H, transform: `scale(${scale})`, WebkitTransform: `scale(${scale})` }}>
        {body}
        {phase === 'app' && (
          <Player
            playlist={playlist}
            channel={playing}
            zapList={zapList.length ? zapList : live}
            allLive={live}
            mode={mode}
            rect={liveGeometry(L).preview}
            isFav={isFav}
            toggleFav={toggleFav}
            onMode={onPlayerMode}
            onZap={(c) => play(c, [])}
          />
        )}
      </div>
    </div>
    </LayoutContext.Provider>
    </SettingsContext.Provider>
  );
}

function TopBar({ tab, onTab, L }: { tab: Tab; onTab: (t: Tab) => void; L: Layout }) {
  return (
    <div className="top" style={{ left: L.px, right: L.px, top: 30 + L.safeY }}>
      <Brand />
      <div style={{ flexGrow: 1 }} />
      <nav className="pill glass" aria-label="Menu">
        {TABS.map(([id, label]) => (
          <button key={id} data-nav="" className={id === tab ? 'on' : ''} aria-current={id === tab ? 'page' : undefined} onClick={() => onTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div style={{ flexGrow: 1 }} />
      <button className={'round' + (tab === 'busca' ? ' on' : '')} data-nav="" aria-label="Buscar" onClick={() => onTab('busca')}>{Icon.search}</button>
      <button className={'round' + (tab === 'lista' ? ' on' : '')} data-nav="" aria-label="Minha lista" onClick={() => onTab('lista')}>{Icon.bookmark}</button>
      <button className="round avatar" data-nav="" aria-label="Perfil e ajustes" onClick={() => onTab('ajustes')}>S</button>
    </div>
  );
}

/** Celular: cabeçalho fino em cima e barra de abas flutuante embaixo (estrutura A no celular). */
function MobileBars({ tab, onTab, L }: { tab: Tab; onTab: (t: Tab) => void; L: Layout }) {
  return (
    <>
      <div className="m-head" style={{ left: L.px, right: L.px, top: 8 + L.safeY }}>
        <Brand size={26} />
        <div className="spacer" />
        <button className={'round' + (tab === 'busca' ? ' on' : '')} data-nav="" aria-label="Buscar" onClick={() => onTab('busca')}>{Icon.search}</button>
        <button className="round avatar" data-nav="" aria-label="Perfil e ajustes" onClick={() => onTab('ajustes')}>S</button>
      </div>
      <nav className="m-tabs glass" aria-label="Menu" style={{ left: L.px, right: L.px, bottom: 12 + L.safeY }}>
        {TABS.map(([id, label]) => (
          <button key={id} data-nav="" className={id === tab ? 'on' : ''} aria-current={id === tab ? 'page' : undefined} onClick={() => onTab(id)}>
            <span className="ic" aria-hidden="true">{TAB_ICON[id]}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
