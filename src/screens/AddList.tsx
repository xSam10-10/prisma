import { T } from '../ui/tokens';
import { useEffect, useRef, useState } from 'react';
import { SourceError, type SourceConfig } from '../core/types';
import { Ambient, Brand } from '../ui/bits';
import { focusFirst } from '../ui/nav';

type Mode = 'm3u' | 'xtream' | 'file' | 'demo';

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'xtream', label: 'Xtream (Smarters / XCIPTV)', hint: 'Servidor, usuário e senha — os mesmos do IPTV Smarters ou do XCIPTV.' },
  { id: 'm3u', label: 'Link M3U / SS IPTV', hint: 'Endereço da lista M3U ou M3U8 (o mesmo usado no SS IPTV como lista externa).' },
  { id: 'file', label: 'Arquivo', hint: 'Um arquivo .m3u ou .m3u8 salvo neste aparelho.' },
  { id: 'demo', label: 'Lista de teste', hint: 'Canais de demonstração para conhecer o app antes de colocar a sua lista.' },
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
    } else if (mode === 'demo') {
      run({ type: 'm3u', name: 'Lista de teste', url: new URL('demo/lista-teste.m3u', location.href).href });
    } else {
      fileRef.current?.click();
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const content = await f.text();
    run({ type: 'm3u-file', name: name.trim() || f.name, fileName: f.name, content });
  };

  const hint = MODES.find((m) => m.id === mode)!.hint;
  const errTitle =
    error?.code === 'auth' ? 'Usuário ou senha errados' : error?.code === 'expired' ? 'Lista vencida' : error?.code === 'empty' ? 'Lista vazia' : 'Não deu para abrir a lista';

  return (
    <div ref={root} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <Ambient variant="home" />
      <div style={{ position: 'absolute', left: 64, top: 36 }}>
        <Brand />
      </div>

      <div className="gy-14" style={{ position: 'absolute', left: 64, top: 120, width: 420, display: 'flex', flexDirection: 'column' }}>
        <span className="title" style={{ fontSize: 40, lineHeight: 1.05, fontWeight: 800 }}>Adicione a sua lista</span>
        <span className="muted" style={{ fontSize: 18, lineHeight: 1.45 }}>
          O PRISMA é um player: ele mostra os canais, filmes e séries da lista que você assina. Nada sai deste aparelho.
        </span>
        <div className="gy-8" style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              className={'btn' + (m.id === mode ? ' primary' : '')}
              data-nav=""
              style={{ justifyContent: 'flex-start', borderRadius: 16, height: 52 }}
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
        style={{ position: 'absolute', left: 540, right: 64, top: 120, bottom: 36, borderRadius: T.radiusPanel, padding: 32, display: 'flex', flexDirection: 'column' }}
      >
        <span className="muted" style={{ fontSize: 16 }}>{hint}</span>

        {mode !== 'demo' && mode !== 'file' && (
          <div className="field">
            <label htmlFor="f-name">Nome da lista</label>
            <input id="f-name" data-nav="" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        {mode === 'xtream' && (
          <>
            <div className="field">
              <label htmlFor="f-server">Servidor (com a porta, se houver)</label>
              <input id="f-server" data-nav="" placeholder="http://servidor.com:8080" inputMode="url" autoCapitalize="off" autoCorrect="off" value={server} onChange={(e) => setServer(e.target.value)} />
            </div>
            <div className="gx-14" style={{ display: 'flex' }}>
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
        {mode === 'demo' && (
          <span style={{ fontSize: 17, lineHeight: 1.5 }}>
            Carrega 6 canais de demonstração (um deles fora do ar de propósito, para ver o aviso). Depois é só trocar pela sua lista em Perfil › Lista.
          </span>
        )}

        <div style={{ flexGrow: 1 }} />

        {error && (
          <div className="gy-4" style={{ padding: 16, borderRadius: 18, background: 'rgba(255,107,61,0.14)', border: '1px solid rgba(255,107,61,0.5)', display: 'flex', flexDirection: 'column' }} role="alert">
            <span style={{ fontWeight: 700, color: T.live, fontSize: 16 }}>{errTitle}</span>
            <span style={{ fontSize: 16 }}>{error.message}</span>
          </div>
        )}

        <div className="gx-16" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="btn primary" data-nav="" disabled={busy} onClick={submit} style={{ height: 52, padding: '0 28px' }}>
            {mode === 'file' ? 'Escolher arquivo' : mode === 'demo' ? 'Abrir lista de teste' : 'Entrar'}
          </button>
          {busy && (
            <>
              <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              <span className="muted" style={{ fontSize: 16 }}>{progress || 'Carregando…'}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
