import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { clearPlaylist, loadSavedPlaylist, loadSource, savePlaylist } from './core/source';
import { prefGet, prefSet } from './core/storage';
import { SourceError, type Channel, type Playlist, type SourceConfig } from './core/types';
import { AddList } from './screens/AddList';
import { LiveTV, PREVIEW_RECT } from './screens/LiveTV';
import { Home, Search, Settings, Soon } from './screens/Other';
import { Player, type PlayerMode } from './screens/Player';
import { Ambient, Brand, Icon, Symbol } from './ui/bits';
import { pushBack } from './ui/nav';

type Tab = 'inicio' | 'aovivo' | 'jogos' | 'filmes' | 'series' | 'anime' | 'busca' | 'lista' | 'ajustes';

const TABS: [Tab, string][] = [
  ['inicio', 'Início'],
  ['aovivo', 'Ao vivo'],
  ['jogos', 'Jogos'],
  ['filmes', 'Filmes'],
  ['series', 'Séries'],
  ['anime', 'Anime'],
];

function useStageScale() {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

export function App() {
  const scale = useStageScale();
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
    loadSavedPlaylist().then((p) => {
      if (p?.items?.length) {
        setPlaylist(p);
        setPhase('app');
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
      setTimeout(() => document.querySelector<HTMLElement>('.vlist')?.focus({ preventScroll: true }), 50);
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
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
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
        {!full && <TopBar tab={tab} onTab={setTab} />}
        <div key={tab}>{screen}</div>
      </>
    );
  }

  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        {body}
        {phase === 'app' && (
          <Player
            playlist={playlist}
            channel={playing}
            zapList={zapList.length ? zapList : live}
            allLive={live}
            mode={mode}
            rect={PREVIEW_RECT}
            isFav={isFav}
            toggleFav={toggleFav}
            onMode={onPlayerMode}
            onZap={(c) => play(c, [])}
          />
        )}
      </div>
    </div>
  );
}

function TopBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div className="top">
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
