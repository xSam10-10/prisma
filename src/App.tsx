import { rememberSource } from './core/sources';
import { applyParental, onParental, parentalVersion } from './core/parental';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { setBaseTheme, themeById } from './ui/themes';
import { askOnStart, chosenThisSession, currentProfile, switchProfile } from './core/profiles';
import { WhoIsWatching } from './screens/Profiles';
import { MyList, VodScreen, type VodTab } from './screens/Vod';
import { Games } from './screens/Games';
import { openSportsView } from './screens/F1';
import { ScoreBug } from './ui/ScoreBug';
import { cloudSync } from './core/cloud';
import { cachedGames, dueReminders, ensureReminder, loadGames, myTeams, reminders, teamsOf, type Reminder } from './core/games';
import { isMyTeam, loadScores, scoreFor } from './core/scores';
import { installNative, nativePlayVod, notifyNow, syncNativeReminders } from './core/native';
import { IS_ANDROID } from './core/platform';
import { applyNow, autoInstall, checkForUpdate, installUpdate, markBootOk, shouldAutoCheck, type CheckResult } from './core/updater';
import { loadTops } from './core/tops';
import { Splash, Toasts, toast as showToast, useHomeScrolled } from './ui/premium2';
import type { Section } from './screens/Settings';
import { indexLogos, pushVodRecent, saveProgress } from './core/vod';
import { clearPlaylist, loadSavedPlaylist, loadSource, savePlaylist } from './core/source';
import { loadLogoCatalogs } from './core/logos';
import { loadXmltv } from './core/xmltv';
import { prefGet, prefSet } from './core/storage';
import { SourceError, type Channel, type Playlist, type SourceConfig } from './core/types';
import { AddList } from './screens/AddList';
import { LiveTV, catColumnWidth, liveGeometry } from './screens/LiveTV';
import { Home, Search } from './screens/Other';
import { Settings } from './screens/Settings';
import { SettingsContext, loadSettings, saveSettings, type Settings as SettingsT } from './core/settings';
import { LayoutContext, useViewportLayout, type Layout } from './ui/layout';
import { EMPTY_SECTIONS, SectionsContext, type SectionsData } from './core/sections';
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
  // Estrutura (A = Menu Horizontal, C = Menu Vertical) e tema. No celular é sempre a A.
  const structure = mobileForm || settings.structure !== 'C' ? 'A' : 'C';
  const railW = structure === 'C' ? 96 : 0;
  // Layout das telas: na C o conteúdo fica à direita do menu lateral e começa mais em cima.
  const Ls = useMemo<Layout>(() => (railW ? { ...L, W: L.W - railW, top: 44 + L.safeY } : L), [L, railW]);
  useLayoutEffect(() => setBaseTheme(themeById(settings.theme)), [settings.theme]);

  // Classes globais: forma da interface e toque.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('mobile', mobileForm);
    const touch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
    html.classList.toggle('touch', touch || mobileForm);
  }, [mobileForm]);
  const [phase, setPhase] = useState<'boot' | 'who' | 'add' | 'app'>(() => (askOnStart() && !chosenThisSession() ? 'who' : 'boot'));
  const [fullPlaylist, setPlaylist] = useState<Playlist>();
  // Controle parental e itens escondidos: o app inteiro usa a lista já filtrada.
  const [parVer, setParVer] = useState(0);
  useEffect(() => onParental(() => setParVer(parentalVersion())), []);
  const playlist = useMemo(() => (fullPlaylist ? applyParental(fullPlaylist) : undefined), [fullPlaylist, parVer]); // eslint-disable-line react-hooks/exhaustive-deps
  const [progress, setProgress] = useState('');
  const [bootError, setBootError] = useState<SourceError | null>(null);
  // A aba Anime virou parte de Séries (as categorias de anime e o Crunchyroll estão lá).
  const [tab, setTab] = useState<Tab>(() => {
    const t = prefGet<Tab>('tab', 'aovivo');
    return t === 'anime' ? 'series' : t;
  });
  const [playing, setPlaying] = useState<Channel>();
  const [zapList, setZapList] = useState<Channel[]>([]);
  // Telas auxiliares (PIP): ficam fixas enquanto você troca o canal principal.
  const [pips, setPips] = useState<Channel[]>([]);
  const [full, setFull] = useState(false);
  const [favIds, setFavIds] = useState<string[]>(() => prefGet('favs', []));
  const [recentIds, setRecentIds] = useState<string[]>(() => prefGet('recents', []));
  const [reloading, setReloading] = useState(false);
  // Guia completo (XMLTV): baixa em segundo plano depois de abrir (guardado por 12 h).
  useEffect(() => {
    if (!playlist) return;
    const t = setTimeout(() => loadXmltv(playlist), 3000);
    return () => clearTimeout(t);
  }, [playlist]);

  // Lembretes de jogos: confere a cada 30 s e avisa na tela.
  const [toast, setToast] = useState<Reminder | null>(null);
  // Volta do player nativo (Android): redesenha o Início com o progresso novo.
  const [, setVodTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      const due = dueReminders();
      if (due.length) setToast(due[0]);
    }, 30000);
    return () => clearInterval(t);
  }, []);
  // Atualizações: o app abriu bem (a TV LG guarda isso para não voltar à versão instalada)
  // e, de vez em quando, procura uma versão nova e avisa.
  const [updInfo, setUpdInfo] = useState<CheckResult | null>(null);
  // 'ready' = já baixada (TV e Windows); 'ask' = o sistema precisa confirmar (Android); 'busy' = baixando.
  const [updState, setUpdState] = useState<'ready' | 'ask' | 'busy' | ''>('');
  const [setSection, setSetSection] = useState<Section | undefined>();
  useEffect(() => {
    (window as unknown as { __PRISMA_BOOTED__?: boolean }).__PRISMA_BOOTED__ = true;
    markBootOk();
  }, []);
  useEffect(() => {
    if (tab !== 'ajustes') setSetSection(undefined);
  }, [tab]);
  // Atualização automática (0.34.2): confere ao abrir e a cada 6 h; na TV e no Windows já baixa
  // sozinho e avisa quando está pronta (vale ao reabrir); no Android avisa com "Atualizar agora".
  useEffect(() => {
    if (phase !== 'app') return;
    let busy = false;
    const run = () => {
      if (busy || !shouldAutoCheck()) return;
      busy = true;
      checkForUpdate()
        .then(async (r) => {
          if (!r.available || !r.manifest) return;
          const st = await autoInstall(r.manifest).catch(() => 'ask' as const);
          setUpdState(st);
          setUpdInfo(r);
        })
        .catch(() => {})
        .then(() => (busy = false));
    };
    const t = setTimeout(run, 8000);
    const iv = setInterval(run, 6 * 3600 * 1000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [phase]);
  // Inclinação da capa seguindo o mouse (computador; na TV e no toque, não).
  useEffect(() => {
    if (document.documentElement.classList.contains('lite')) return;
    let last: HTMLElement | null = null;
    const art = (t: HTMLElement | null) => (t ? (t.closest('.tile') as HTMLElement | null)?.querySelector<HTMLElement>('.poster-art, .tile-art, .wide-art, .feat-art, .genre-art') ?? null : null);
    const move = (e: MouseEvent) => {
      const a = art(e.target as HTMLElement);
      if (last && last !== a) {
        last.style.transform = '';
        last = null;
      }
      if (!a) return;
      const r = a.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      a.classList.add('tilt-art');
      a.style.transform = `perspective(900px) rotateY(${(x * 10).toFixed(2)}deg) rotateX(${(-y * 10).toFixed(2)}deg)`;
      last = a;
    };
    const out = () => {
      if (last) last.style.transform = '';
      last = null;
    };
    window.addEventListener('mousemove', move);
    document.addEventListener('mouseleave', out);
    return () => {
      window.removeEventListener('mousemove', move);
      document.removeEventListener('mouseleave', out);
    };
  }, []);
  // Tops e recomendações: baixa em segundo plano e mantém atualizado (a cada 6 h) com o app aberto.
  useEffect(() => {
    if (phase !== 'app') return;
    const t = setTimeout(() => loadTops(), 12000);
    const iv = setInterval(() => loadTops(), 30 * 60 * 1000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [phase]);
  // Meus times: lembretes automáticos dos jogos e aviso de gol (com o app aberto).
  const [goal, setGoal] = useState<null | { title: string; detail: string; channel?: Channel; list?: Channel[] }>(null);
  const goalsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (phase !== 'app' || !playlist) return;
    let alive = true;
    const remindMine = () => {
      const mt = myTeams();
      if (!mt.length || playlist.source.type !== 'xtream') return;
      loadGames(playlist).then((gs) => {
        for (const g of gs) if (g.start > Date.now() && teamsOf(g).some((t) => isMyTeam(t, mt))) ensureReminder(g);
      }, () => {});
    };
    const checkGoals = () => {
      // Acompanha o placar de todos os jogos desde que o app abre (para não perder
      // o 1º gol depois de escolher os times) e avisa só os de "Meus times".
      loadScores().then((sc) => {
        if (!alive) return;
        const mt = myTeams();
        for (const x of sc) {
          if (x.state === 'pre') continue;
          const key = x.id ?? `${x.home}|${x.away}|${x.start}`;
          const total = (parseInt(x.homeScore, 10) || 0) + (parseInt(x.awayScore, 10) || 0);
          const before = goalsRef.current[key];
          goalsRef.current[key] = total;
          if (!mt.length || !(isMyTeam(x.home, mt) || isMyTeam(x.away, mt))) continue;
          if (before !== undefined && total > before) {
            const g = cachedGames().find((gg) => scoreFor(gg, [x]));
            const title = `⚽ Gol! ${x.home} ${x.homeScore} × ${x.awayScore} ${x.away}`;
            setGoal({ title, detail: `${x.league} · ${x.detail}`, channel: g?.channels[0], list: g?.channels });
            void notifyNow(title, `${x.league} · ${x.detail}`);
          }
        }
      }, () => {});
    };
    const t1 = setTimeout(remindMine, 20000);
    const t2 = setInterval(remindMine, 2 * 3600 * 1000);
    checkGoals();
    const t3 = setInterval(checkGoals, 60000);
    return () => {
      alive = false;
      clearTimeout(t1);
      clearInterval(t2);
      clearInterval(t3);
    };
  }, [phase, playlist]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!goal) return;
    const t = setTimeout(() => setGoal(null), 15000);
    return () => clearTimeout(t);
  }, [goal]);
  // Android: Voltar do controle, toque na notificação e lembretes agendados.
  useEffect(() => {
    void installNative((r) => setToast(r));
    void syncNativeReminders(reminders());
  }, []);
  const [secData, setSecData] = useState<SectionsData>(() => ({ ...EMPTY_SECTIONS, ...prefGet<Partial<SectionsData>>('sections', {}) }));
  useEffect(() => prefSet('sections', secData), [secData]);
  const sectionsApi = useMemo(() => ({ data: secData, set: (fn: (d: SectionsData) => SectionsData) => setSecData(fn) }), [secData]);

  // Abre a lista salva; se não houver, vai para "Adicionar lista".
  useEffect(() => {
    if (phase === 'who') return;
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
  }, [phase === 'who']); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => prefSet('tab', tab === 'busca' || tab === 'ajustes' ? 'inicio' : tab), [tab]);
  useEffect(() => prefSet('favs', favIds), [favIds]);
  useEffect(() => prefSet('recents', recentIds), [recentIds]);

  const live = useMemo(() => playlist?.items.filter((i) => i.kind === 'live') ?? [], [playlist]);
  const byId = useMemo(() => new Map(live.map((c) => [c.id, c])), [live]);
  const favs = useMemo(() => favIds.map((id) => byId.get(id)).filter(Boolean) as Channel[], [favIds, byId]);
  const recents = useMemo(() => recentIds.map((id) => byId.get(id)).filter(Boolean) as Channel[], [recentIds, byId]);
  // "Último canal": o ao vivo assistido antes do atual.
  const lastChannel = useMemo(() => recents.find((c) => c.kind === 'live' && c.id !== playing?.id), [recents, playing]);

  const isFav = useCallback((c: Channel) => favIds.includes(c.id), [favIds]);
  const toggleFav = useCallback((c: Channel) => setFavIds((f) => (f.includes(c.id) ? f.filter((x) => x !== c.id) : [...f, c.id])), []);

  const play = useCallback((c: Channel, list: Channel[]) => {
    setPlaying(c);
    if (list.length) setZapList(list);
    setRecentIds((r) => [c.id, ...r.filter((x) => x !== c.id)].slice(0, 30));
    setStartAt(undefined);
    prefSet('lastKind', 'live');
  }, []);

  const watchFull = useCallback(
    (c: Channel, list: Channel[]) => {
      play(c, list);
      setFull(true);
    },
    [play],
  );

  // Filme/série/episódio: toca em tela cheia, de onde parou.
  const [startAt, setStartAt] = useState<number | undefined>();
  const playingRef = useRef<Channel>();
  playingRef.current = playing;
  const [queue, setQueue] = useState<Channel[]>([]);
  const playVod = useCallback((item: Channel, from?: number, q?: Channel[]) => {
    // Android: filmes e séries no player nativo (ExoPlayer). Ao voltar, guarda onde parou
    // e, se o episódio acabou, segue para o próximo da fila.
    if (IS_ANDROID && item.kind !== 'live' && loadSettings().androidPlayer !== 'web') {
      pushVodRecent(item);
      prefSet('lastKind', 'vod');
      const sub = item.seriesId ? item.group : item.year ? String(item.year) : '';
      nativePlayVod(item.url, item.name, sub, from ?? 0).then(
        (r: { posMs: number; durMs: number; ended: boolean; error?: string }) => {
          if (r.durMs > 0) saveProgress(item.id, r.posMs / 1000, r.durMs / 1000);
          if (r.error) showToast('O player do Android não tocou este vídeo. Em Ajustes › Player dá para usar o do PRISMA.', '✕');
          const list = q ?? [];
          const i = list.findIndex((x) => x.id === item.id);
          if (r.ended && i >= 0 && list[i + 1]) playVodRef.current?.(list[i + 1], 0, list);
          else setVodTick((x: number) => x + 1);
        },
        () => showToast('Não deu para abrir o player do Android.', '✕'),
      );
      return;
    }
    if (q) setQueue(q);
    else setQueue((cur) => (cur.some((x) => x.id === item.id) ? cur : []));
    setStartAt(from);
    setPlaying(item);
    setFull(true);
    pushVodRecent(item);
    prefSet('lastKind', 'vod');
  }, []);

  const playVodRef = useRef(playVod);
  playVodRef.current = playVod;

  const onPlayerMode = useCallback((m: PlayerMode) => {
    if (m === 'full') setFull(true);
    else if (playingRef.current && playingRef.current.kind !== 'live') {
      // Saiu do filme: para o vídeo e volta para a tela de onde veio.
      setFull(false);
      setPlaying(undefined);
      setStartAt(undefined);
    } else {
      setFull(false);
      setTab('aovivo');
      // Volta o foco para a lista de canais.
      setTimeout(() => focusEl(document.querySelector<HTMLElement>('.vlist')), 50);
    }
  }, []);

  // Capas genéricas da lista (0.31.0): conta as imagens repetidas assim que a lista carrega.
  useMemo(() => indexLogos(playlist?.items ?? []), [playlist]);

  // Nuvem (0.30.0): envia o que mudou a cada 5 min e quando o app sai da frente.
  useEffect(() => {
    const push = () => void cloudSync(false).catch(() => undefined);
    const t = setInterval(push, 5 * 60000);
    const vis = () => document.hidden && push();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
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

  // Lista em uso entra em "Suas listas" (Ajustes › Lista).
  useEffect(() => {
    if (fullPlaylist) rememberSource(fullPlaylist.source);
  }, [fullPlaylist?.source]); // eslint-disable-line react-hooks/exhaustive-deps
  const switchSource = async (src: SourceConfig) => {
    const prev = phase;
    setPhase('boot');
    try {
      await submitSource(src);
    } catch (e) {
      setBootError(e instanceof SourceError ? e : null);
      setPhase(prev === 'app' ? 'add' : prev);
    }
  };
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

  const mode: PlayerMode = !playing ? 'off' : full ? 'full' : tab === 'aovivo' && playing.kind === 'live' ? 'preview' : 'off';

  let body: React.ReactNode = null;
  if (phase === 'who') {
    body = (
      <WhoIsWatching
        onPick={(p) => {
          if (p.id === currentProfile().id) {
            try {
              sessionStorage.setItem('prisma.chosen', '1');
            } catch {
              /* ignora */
            }
            setPhase('boot');
          } else switchProfile(p.id);
        }}
      />
    );
  } else if (phase === 'boot') {
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
        screen = <LiveTV playlist={playlist} live={live} favIds={favIds} playing={playing} isFav={isFav} toggleFav={toggleFav} onPlay={play} onFull={() => setFull(true)} onPlayVod={(it) => playVod(it, 0)} lastChannel={lastChannel} onLast={() => lastChannel && play(lastChannel, [])} />;
        break;
      case 'inicio':
        screen = <Home playlist={playlist} live={live} favs={favs} recents={recents} onWatch={watchFull} onGoLive={() => setTab('aovivo')} onGoGames={(v) => { openSportsView(v); setTab('jogos'); }} onPlayVod={playVod} />;
        break;
      case 'busca':
        screen = <Search playlist={playlist} onWatch={watchFull} onPlayVod={playVod} />;
        break;
      case 'ajustes':
      case 'lista':
        screen =
          tab === 'ajustes' ? (
            <Settings
              initialSection={setSection}
              data={{
                counts: {
                  recents: recentIds.length,
                  favs: favIds.length,
                  sections: secData.custom.length,
                  sectionLinks: Object.values(secData.members).reduce((n, a) => n + a.length, 0),
                  progress: Object.keys(prefGet<Record<string, unknown>>('progress', {})).length,
                },
                clearRecents: () => setRecentIds([]),
                clearFavs: () => setFavIds([]),
                clearSections: () => setSecData((d) => ({ ...d, custom: [], members: {}, order: d.order.filter((id) => !id.startsWith('c:')) })),
                clearSectionOrder: () => setSecData((d) => ({ ...d, order: [], sort: 'priority' })),
                clearProgress: () => prefSet('progress', {}),
                clearAll: async () => {
                  await clearPlaylist();
                  try {
                    Object.keys(localStorage).filter((k) => k.startsWith('prisma.')).forEach((k) => localStorage.removeItem(k));
                  } catch {
                    /* ignora */
                  }
                  location.reload();
                },
              }}
              playlist={fullPlaylist ?? playlist}
              reloading={reloading}
              onReload={reload}
              onChange={() => setPhase('add')}
              onSwitch={switchSource}
              onRemove={async () => {
                await clearPlaylist();
                setPlaying(undefined);
                setPlaylist(undefined);
                setPhase('add');
              }}
            />
          ) : (
            <MyList playlist={playlist} onPlay={playVod} />
          );
        break;
      case 'jogos':
        screen = <Games playlist={playlist} onWatch={watchFull} />;
        break;
      default:
        screen = <VodScreen playlist={playlist} tab={tab as VodTab} onPlay={playVod} />;
    }
    body = (
      <>
        <Ambient variant={tab === 'inicio' ? 'home' : 'live'} />
        {!full &&
          (mobileForm ? (
            <MobileBars tab={tab} onTab={setTab} L={L} />
          ) : structure === 'C' ? (
            <SideRail tab={tab} onTab={setTab} L={L} />
          ) : (
            <TopBar tab={tab} onTab={setTab} L={L} />
          ))}
        <div key={tab} className="screen-in" style={railW ? { position: 'absolute', left: railW, top: 0, bottom: 0, width: L.W - railW } : { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <LayoutContext.Provider value={Ls}>{screen}</LayoutContext.Provider>
        </div>
      </>
    );
  }

  return (
    <SettingsContext.Provider value={settingsApi}>
    <SectionsContext.Provider value={sectionsApi}>
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
            rect={(() => {
              const r = liveGeometry(Ls, catColumnWidth(playlist?.items ?? live)).preview;
              return { ...r, left: r.left + railW };
            })()}
            isFav={isFav}
            toggleFav={toggleFav}
            onMode={onPlayerMode}
            onZap={(c) => play(c, [])}
            lastChannel={lastChannel}
            pips={pips}
            onPips={setPips}
            onPickList={(c, list) => play(c, list)}
            onPlayVod={(it) => playVod(it, 0)}
            onSwapPip={(i) => {
              const p = pips[i];
              if (!p || !playing) return;
              setPips((ps) => ps.map((x, j) => (j === i ? playing : x)));
              play(p, []);
            }}
            startAt={startAt}
            nextEp={playing && queue.length ? queue[queue.findIndex((x) => x.id === playing.id) + 1] : undefined}
            onNext={() => {
              const i = playing ? queue.findIndex((x) => x.id === playing.id) : -1;
              if (i >= 0 && queue[i + 1]) playVod(queue[i + 1], 0);
            }}
          />
        )}
        {phase === 'app' && mode === 'full' && <ScoreBug />}
        {goal && (
          <div className="toast gy-10" style={{ right: L.px, top: 24 + L.safeY, display: 'flex', flexDirection: 'column' }} role="alert">
            <span className="badge-live" style={{ alignSelf: 'flex-start' }}>Meu time</span>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{goal.title}</span>
            <span className="muted" style={{ fontSize: 15 }}>{goal.detail}</span>
            <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
              {goal.channel && (
                <button className="btn primary" data-nav="" onClick={() => { watchFull(goal.channel!, goal.list ?? []); setGoal(null); }}>▶ Assistir</button>
              )}
              <button className="btn" data-nav="" onClick={() => setGoal(null)}>Fechar</button>
            </div>
          </div>
        )}
        {updInfo && !toast && (
          <div className="toast gy-10" style={{ right: L.px, top: 24 + L.safeY, display: 'flex', flexDirection: 'column' }} role="alert">
            <span className="badge-live" style={{ alignSelf: 'flex-start', background: '#3DD6C4', color: '#0B0B12' }}>Nova versão</span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{updState === 'ready' ? `PRISMA ${updInfo.version} baixado` : updState === 'busy' ? `Baixando o PRISMA ${updInfo.version}…` : `PRISMA ${updInfo.version} está disponível`}</span>
            {updState === 'ready' && <span className="muted" style={{ fontSize: 15 }}>Já vale na próxima vez que o PRISMA abrir.</span>}
            {updInfo.notes && updInfo.notes[0] && <span className="muted" style={{ fontSize: 15 }}>{updInfo.notes[0]}</span>}
            <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
              <button
                className="btn primary"
                data-nav=""
                disabled={updState === 'busy'}
                onClick={() => {
                  if (updState === 'ready') return applyNow();
                  if (updState === 'ask' && updInfo.manifest) {
                    setUpdState('busy');
                    installUpdate(updInfo.manifest, () => {})
                      .catch(() => {
                        setSetSection('sobre');
                        setTab('ajustes');
                      })
                      .then(() => setUpdInfo(null));
                    return;
                  }
                  setUpdInfo(null);
                  setSetSection('sobre');
                  setTab('ajustes');
                }}
              >
                {updState === 'ready' ? 'Reabrir agora' : 'Atualizar agora'}
              </button>
              <button className="btn" data-nav="" onClick={() => setUpdInfo(null)}>Depois</button>
            </div>
          </div>
        )}
        {toast && (
          <div className="toast gy-10" style={{ right: L.px, top: 24 + L.safeY, display: 'flex', flexDirection: 'column' }} role="alert">
            <span className="badge-live" style={{ alignSelf: 'flex-start', background: '#F5B83D' }}>⏰ Começando agora</span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{toast.title}</span>
            <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
              <button
                className="btn primary"
                data-nav=""
                onClick={() => {
                  const c = live.find((x) => x.id === toast.channelId);
                  if (c) watchFull(c, []);
                  setToast(null);
                }}
              >
                ▶ Assistir
              </button>
              <button className="btn" data-nav="" onClick={() => setToast(null)}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </LayoutContext.Provider>
    </SectionsContext.Provider>
      <Toasts />
      <Splash />
    </SettingsContext.Provider>
  );
}

function TopBar({ tab, onTab, L }: { tab: Tab; onTab: (t: Tab) => void; L: Layout }) {
  // No Início, no alto da página o menu fica transparente sobre a arte; ao rolar, ganha o vidro e fica mais compacto.
  const scrolled = useHomeScrolled();
  const cls = tab === 'inicio' ? (scrolled ? ' scrolled' : ' at-top') : '';
  return (
    <div className={'top' + cls} style={{ left: L.px, right: L.px, top: 30 + L.safeY }}>
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
      <ProfileButton onClick={() => onTab('ajustes')} />
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
        <ProfileButton onClick={() => onTab('ajustes')} />
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

const RAIL_ICON: Record<string, string> = { inicio: '⌂', aovivo: '●', jogos: '◎', filmes: '▶', series: '▤', anime: '✦', busca: '⌕', lista: '❏' };

/** Menu Vertical (estrutura C): menu lateral de ícones (96). */
function SideRail({ tab, onTab, L }: { tab: Tab; onTab: (t: Tab) => void; L: Layout }) {
  const items: [Tab, string][] = [...TABS, ['busca', 'Busca'], ['lista', 'Lista']];
  return (
    <nav className="rail" aria-label="Menu" style={{ paddingTop: 24 + L.safeY, paddingBottom: 20 + L.safeY }}>
      <span className="rail-logo"><Symbol size={44} /></span>
      {items.map(([id, label]) => (
        <button key={id} data-nav="" className={id === tab ? 'on' : ''} aria-current={id === tab ? 'page' : undefined} onClick={() => onTab(id)}>
          <span className="ic" aria-hidden="true">{RAIL_ICON[id]}</span>
          <span>{label}</span>
        </button>
      ))}
      <div style={{ flexGrow: 1 }} />
      <ProfileButton onClick={() => onTab('ajustes')} />
    </nav>
  );
}

function ProfileButton({ onClick }: { onClick: () => void }) {
  const p = currentProfile();
  return (
    <button className="round avatar" data-nav="" aria-label={`Perfil ${p.name} e ajustes`} onClick={onClick} style={p.photo ? { background: `${p.color} url(${p.photo}) center / cover no-repeat`, fontSize: 0 } : { background: p.color }}>
      {p.photo ? "" : p.name.slice(0, 1).toUpperCase()}
    </button>
  );
}
