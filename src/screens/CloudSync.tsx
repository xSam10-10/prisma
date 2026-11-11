import { useState } from 'react';
import { cloudCfg, cloudConnect, cloudDisconnect, cloudSync } from '../core/cloud';
import { ConfirmButton } from '../ui/Dialog';

// Ajustes › Dados › Sincronização pela nuvem (0.30.0): liga com um token do
// GitHub (permissão só de Gist), mostra quando sincronizou e permite forçar.

type RowC = (p: { label: string; help: string; children: React.ReactNode }) => React.ReactElement;

function ago(t?: number): string {
  if (!t) return 'ainda não';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'agora há pouco';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `há ${h} h` : new Date(t).toLocaleDateString('pt-BR');
}

export function CloudRows({ Row }: { Row: RowC }) {
  const [cfg, setCfg] = useState(cloudCfg());
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  if (!cfg) {
    return (
      <>
        <Row
          label="Sincronizar pela nuvem"
          help="Favoritos, Minha lista, seções, onde você parou, histórico, lembretes, perfis e ajustes iguais na TV, no computador e no celular. Fica num Gist privado da sua conta do GitHub. Crie um token em github.com › Settings › Developer settings › Personal access tokens (classic), marcando só “gist”, e cole aqui. Faça o mesmo em cada aparelho. O primeiro aparelho conectado vira a base."
        >
          <span />
        </Row>
        <div className="field" style={{ display: 'flex', alignItems: 'center' }}>
          <input data-nav="" type={show ? 'text' : 'password'} value={token} placeholder="Token do GitHub (ghp_…)" onChange={(e) => setToken(e.target.value)} style={{ flexGrow: 1 }} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <button className="btn" data-nav="" style={{ marginLeft: 12 }} onClick={() => setShow((s) => !s)}>
            {show ? 'Ocultar' : 'Mostrar'}
          </button>
          <button
            className="btn primary"
            data-nav=""
            disabled={busy}
            style={{ marginLeft: 12 }}
            onClick={async () => {
              setBusy(true);
              setMsg('Conectando…');
              try {
                const user = await cloudConnect(token);
                setToken('');
                setMsg(`Conectado à conta ${user}. Trazendo os dados da nuvem…`);
                const r = await cloudSync(true);
                setCfg(cloudCfg());
                if (r.pulled) {
                  setMsg(`Conectado à conta ${user}. ${r.pulled} grupos de dados vieram da nuvem — reabrindo…`);
                  setTimeout(() => location.reload(), 1500);
                } else setMsg(`Conectado à conta ${user}. Os dados deste aparelho foram para a nuvem.`);
              } catch (e) {
                setMsg((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Conectar
          </button>
        </div>
        {msg && <span className="muted" role="status" style={{ fontSize: 15 }}>{msg}</span>}
      </>
    );
  }
  return (
    <>
      <Row
        label="Sincronizar pela nuvem"
        help={`Ligada (conta ${cfg.user ?? 'GitHub'}). Última sincronização: ${ago(cfg.last)}.${cfg.lastError ? ' Último erro: ' + cfg.lastError : ''} Sincroniza ao abrir o app, a cada 5 minutos e quando você sai dele. Não vão para a nuvem: login da lista IPTV, chave do TMDB e o tamanho da tela.`}
      >
        <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
          <button
            className="btn primary"
            data-nav=""
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMsg('Sincronizando…');
              try {
                const r = await cloudSync(true);
                setCfg(cloudCfg());
                if (r.pulled) {
                  setMsg(`${r.pulled} grupos de dados vieram da nuvem e ${r.pushed} foram para ela — reabrindo…`);
                  setTimeout(() => location.reload(), 1500);
                } else setMsg(r.pushed ? `${r.pushed} grupos de dados foram para a nuvem.` : 'Tudo igual nos dois lados.');
              } catch (e) {
                setCfg(cloudCfg());
                setMsg((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Sincronizar agora
          </button>
          <button className="btn" data-nav="" onClick={() => setShow((s) => !s)}>
            {show ? 'Ocultar token' : 'Mostrar token'}
          </button>
          <ConfirmButton
            label="Desligar"
            confirmLabel="Este aparelho para de sincronizar. Confirmar?"
            onConfirm={() => {
              cloudDisconnect();
              setCfg(null);
              setMsg('Sincronização desligada neste aparelho. Os dados continuam aqui e na nuvem.');
            }}
          />
        </div>
      </Row>
      {show && (
        <span style={{ fontSize: 15, fontFamily: 'monospace', wordBreak: 'break-all', userSelect: 'text', WebkitUserSelect: 'text' }}>
          Token do GitHub deste aparelho: {cfg.token}
        </span>
      )}
      {msg && <span className="muted" role="status" style={{ fontSize: 15 }}>{msg}</span>}
    </>
  );
}
