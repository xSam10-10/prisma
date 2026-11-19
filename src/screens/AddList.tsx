import { T } from '../ui/tokens';
import { useEffect, useRef, useState } from 'react';
import { SourceError, type SourceConfig } from '../core/types';
import { Ambient, Brand } from '../ui/bits';
import { focusFirst } from '../ui/nav';
import { VERSION } from '../version';
import { useLayout } from '../ui/layout';
import { VoiceButton } from '../ui/Voice';

type Mode = 'm3u' | 'xtream' | 'file';

/** Goldcard embutida na publicação (1.0): um toque preenche e entra. */
const GOLD = typeof __GOLDCARD__ !== 'undefined' ? __GOLDCARD__ : null;

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'xtream', label: 'Xtream (Smarters / XCIPTV)', hint: 'Servidor, usuário e senha — os mesmos do IPTV Smarters ou do XCIPTV.' },
  { id: 'm3u', label: 'Link M3U / SS IPTV', hint: 'Endereço da lista M3U ou M3U8 (o mesmo usado no SS IPTV como lista externa).' },
  { id: 'file', label: 'Arquivo', hint: 'Um arquivo .m3u ou .m3u8 salvo neste aparelho.' },
];

interface Props {
  onSubmit: (src: SourceConfig) => Promise<void>;
  onCancel?: () => void;
  progress?: string;
  initialError?: SourceError | null;
}

export function AddList({ onSubmit, onCancel, progress, initialError }: Props) {
  const [mode, setMode] = useState<Mode>('xtream');
  const [server, setServer] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('Goldcard TV');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SourceError | null>(initialError ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => focusFirst(root.current));
  }, []);

  const run = async (src: SourceConfig) => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(src);
    } catch (e) {
      setError(e instanceof SourceError ? e : new SourceError('network', (e as Error).message || 'Erro ao carregar a lista.'));
      setBusy(false);
    }
  };

  const submit = () => {
    if (mode === 'xtream') {
      if (!server.trim() || !user.trim() || !pass) return setError(new SourceError('format', 'Preencha servidor, usuário e senha.'));
      run({ type: 'xtream', name: name.trim() || 'Minha lista', server: server.trim(), username: user.trim(), password: pass });
    } else if (mode === 'm3u') {
      if (!/^https?:\/\//i.test(url.trim())) return setError(new SourceError('format', 'O link precisa começar com http:// ou https://'));
      run({ type: 'm3u', name: name.trim() || 'Minha lista', url: url.trim() });
    } else {
      fileRef.current?.click();
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const content = await f.text();
    run({ type: 'm3u-file', name: name.trim() || f.name, fileName: f.name, content });
  };

  const gold = () => {
    if (!GOLD) return;
    setMode('xtream');
    setServer(GOLD.server);
    setUser(GOLD.username);
    setPass(GOLD.password);
    setName('Goldcard TV');
    const list = GOLD.servers && GOLD.servers.length ? GOLD.servers : [GOLD.server];
    setBusy(true);
    setError(null);
    // Tenta cada servidor da Goldcard; só passa para o próximo em falha de rede/servidor.
    (async () => {
      let last: SourceError | null = null;
      for (const sv of list) {
        setServer(sv);
        try {
          await onSubmit({ type: 'xtream', name: 'Goldcard TV', server: sv, username: GOLD.username, password: GOLD.password });
          return;
        } catch (e) {
          last = e instanceof SourceError ? e : new SourceError('network', (e as Error).message || 'Erro ao carregar a lista.');
          if (last.code === 'auth' || last.code === 'expired') break;
        }
      }
      setError(last);
      setBusy(false);
    })();
  };

  const hint = MODES.find((m) => m.id === mode)!.hint;
  const errTitle =
    error?.code === 'auth' ? 'Usuário ou senha errados' : error?.code === 'expired' ? 'Lista vencida' : error?.code === 'empty' ? 'Lista vazia' : 'Não deu para abrir a lista';

  const L = useLayout();
  const mobile = L.form === 'mobile';
  // Na TV os blocos ficam posicionados; no celular viram uma coluna que rola.
  const abs = (st: React.CSSProperties): React.CSSProperties => (mobile ? {} : st);
  const top0 = 36 + L.safeY;

  return (
    <div ref={root} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <Ambient variant="home" />
      <div
        className={mobile ? 'scroll-y gy-16' : ''}
        style={mobile ? { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, padding: `${16 + L.safeY}px ${L.px}px 24px`, display: 'flex', flexDirection: 'column' } : undefined}
      >
      <div style={abs({ position: 'absolute', left: L.px, top: top0 })}>
        <Brand size={mobile ? 28 : 34} />
      </div>

      <div className="gy-14" style={{ ...abs({ position: 'absolute', left: L.px, top: top0 + 84, width: 420 }), display: 'flex', flexDirection: 'column' }}>
        <span className="title" style={{ fontSize: mobile ? 30 : 40, lineHeight: 1.05, fontWeight: 800 }}>Adicione a sua lista</span>
        <span className="muted" style={{ fontSize: mobile ? 15 : 18, lineHeight: 1.45 }}>
          O PRISMA é um player: ele mostra os canais, filmes e séries da lista que você assina. Nada sai deste aparelho.
        </span>
        {GOLD && (
          <button
            className="btn primary gold-btn"
            data-nav=""
            disabled={busy}
            onClick={gold}
            style={{ justifyContent: 'flex-start', borderRadius: 16, height: mobile ? 48 : 60, marginTop: mobile ? 4 : 20, fontSize: mobile ? 17 : 19, fontWeight: 800 }}
          >
            Entrar com a Goldcard
          </button>
        )}
        {GOLD && <span className="muted" style={{ fontSize: 14 }}>Preenche servidor, usuário e senha e já carrega a lista. Ou escolha outro tipo abaixo.</span>}
        <div className={mobile ? 'wrap-row' : 'gy-8'} style={{ display: 'flex', flexDirection: mobile ? 'row' : 'column', flexWrap: mobile ? 'wrap' : undefined, marginTop: mobile ? 4 : GOLD ? 8 : 26 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              className={'btn' + (m.id === mode ? ' primary' : '')}
              data-nav=""
              style={{ justifyContent: 'flex-start', borderRadius: 16, height: mobile ? 42 : 52 }}
              onClick={() => {
                setMode(m.id);
                setError(null);
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {onCancel && (
          <button className="btn" data-nav="" style={{ alignSelf: 'flex-start', marginTop: 22 }} onClick={onCancel}>
            Voltar
          </button>
        )}
      </div>

      <div
        className="glass gy-18"
        style={{ ...abs({ position: 'absolute', left: L.px + 476, right: L.px, top: top0 + 84, bottom: L.bottom }), borderRadius: mobile ? 20 : T.radiusPanel, padding: mobile ? 18 : 32, display: 'flex', flexDirection: 'column' }}
      >
        <span className="muted" style={{ fontSize: 16 }}>{hint}</span>

        {mode !== 'file' && (
          <div className="field">
            <label htmlFor="f-name">Nome da lista</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input id="f-name" data-nav="" value={name} onChange={(e) => setName(e.target.value)} style={{ flexGrow: 1 }} />
              <span style={{ marginLeft: 10 }}><VoiceButton size={48} onText={setName} /></span>
            </div>
          </div>
        )}
        {mode === 'xtream' && (
          <>
            <div className="field">
              <label htmlFor="f-server">Servidor (com a porta, se houver)</label>
              <input id="f-server" data-nav="" placeholder="http://servidor.com:8080" inputMode="url" autoCapitalize="off" autoCorrect="off" value={server} onChange={(e) => setServer(e.target.value)} />
            </div>
            <div className={mobile ? 'gy-18' : 'gx-14'} style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row' }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="f-user">Usuário</label>
                <input id="f-user" data-nav="" autoCapitalize="off" autoCorrect="off" value={user} onChange={(e) => setUser(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="f-pass">Senha</label>
                <input id="f-pass" data-nav="" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
              </div>
            </div>
          </>
        )}
        {mode === 'm3u' && (
          <div className="field">
            <label htmlFor="f-url">Link da lista</label>
            <input id="f-url" data-nav="" placeholder="http://servidor.com/get.php?username=…&password=…&type=m3u_plus" inputMode="url" autoCapitalize="off" autoCorrect="off" value={url} onChange={(e) => setUrl(e.target.value)} />
            <span className="muted" style={{ fontSize: 15 }}>Se o link for do tipo get.php, o PRISMA usa a API Xtream automaticamente (guia e categorias melhores).</span>
          </div>
        )}
        {mode === 'file' && <input ref={fileRef} type="file" accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />}

        {!mobile && <div style={{ flexGrow: 1 }} />}

        {error && (
          <div className="gy-4" style={{ padding: 16, borderRadius: 18, background: 'rgba(255,107,61,0.14)', border: '1px solid rgba(255,107,61,0.5)', display: 'flex', flexDirection: 'column' }} role="alert">
            <span style={{ fontWeight: 700, color: T.live, fontSize: 16 }}>{errTitle}</span>
            <span style={{ fontSize: 16 }}>{error.message}</span>
          </div>
        )}

        <div className="gx-16" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="btn primary" data-nav="" disabled={busy} onClick={submit} style={{ height: 52, padding: '0 28px' }}>
            {mode === 'file' ? 'Escolher arquivo' : 'Entrar'}
          </button>
          {busy && (
            <>
              <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              <span className="muted" style={{ fontSize: 16 }}>{progress || 'Carregando…'}</span>
            </>
          )}
        </div>
      </div>
      <span className="muted" style={{ ...abs({ position: 'absolute', left: L.px, bottom: L.bottom }), fontSize: 14 }}>Versão {VERSION}</span>
      </div>
    </div>
  );
}
