import { useState } from 'react';
import { prefGet, prefSet } from '../core/storage';
import { checkForUpdate, installUpdate, platform, resetWebosUpdate, runningVersion, type CheckResult } from '../core/updater';
import { VERSION } from '../version';

// Ajustes › Sobre › Atualizações: procurar, ver o que mudou e atualizar.

const HOW: Record<string, string> = {
  windows: 'Baixa o instalador novo; o PRISMA fecha e abre de novo já atualizado.',
  android: 'Baixa o APK novo e abre o instalador do Android. Na primeira vez, permita “Instalar apps desconhecidos” para o PRISMA.',
  webos: 'Baixa o código novo do app e guarda na TV; o PRISMA reabre atualizado. Se algo der errado, ele volta sozinho para a versão instalada.',
  web: 'No navegador, recarregue a página para usar a versão mais nova.',
};

export function UpdatePanel({ autoStart }: { autoStart?: CheckResult | null }) {
  const p = platform();
  const [res, setRes] = useState<CheckResult | null>(autoStart ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Canal de atualizações (repositório público) ainda não existe: não é "sem atualização".
  const [noFeed, setNoFeed] = useState(false);
  const [prog, setProg] = useState<{ pct: number | null; msg: string } | null>(null);
  const [auto, setAuto] = useState(prefGet<boolean>('updateAuto', true));
  const ota = runningVersion() !== VERSION;

  const check = async () => {
    setBusy(true);
    setErr('');
    setNoFeed(false);
    setRes(null);
    try {
      setRes(await checkForUpdate());
    } catch (e) {
      const msg = String((e as Error)?.message || '');
      // 404: o GitHub não entregou o manifesto (repositório privado ou sem versão publicada).
      if (/\b404\b|não encontrad/i.test(msg)) setNoFeed(true);
      else setErr('Não deu para procurar agora. Confira a internet e tente de novo.');
    } finally {
      setBusy(false);
    }
  };
  const install = async () => {
    if (!res?.manifest) return;
    setBusy(true);
    setErr('');
    try {
      const msg = await installUpdate(res.manifest, (pct, m) => setProg({ pct, msg: m }));
      setProg({ pct: 100, msg });
    } catch (e) {
      setProg(null);
      setErr((e as Error).message || 'Não deu para atualizar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="opt-row upd gy-10" style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 18, fontWeight: 700 }}>Atualizações</span>
      <span className="muted" style={{ fontSize: 15, lineHeight: 1.4 }}>
        Versão em uso: <b>{runningVersion()}</b>
        {ota ? ` (atualizada pelo app; instalada: ${VERSION})` : ''}. {HOW[p]}
      </span>
      {p !== 'web' && (
        <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
          <button className="btn primary" data-nav="" disabled={busy} onClick={check}>
            {busy && !prog ? 'Procurando…' : 'Procurar atualização'}
          </button>
          <button
            className="btn"
            data-nav=""
            onClick={() => {
              prefSet('updateAuto', !auto);
              setAuto(!auto);
            }}
          >
            {auto ? '✓ Avisar quando houver versão nova' : 'Não avisar sozinho'}
          </button>
          {p === 'webos' && ota && (
            <button className="btn" data-nav="" onClick={() => resetWebosUpdate()}>
              Voltar para a versão instalada
            </button>
          )}
        </div>
      )}
      {res && !res.available && !res.unsupported && (
        <span className="upd-none" role="status">
          <b>Nenhuma atualização disponível.</b> Você está na versão mais nova ({runningVersion()}).
        </span>
      )}
      {res && res.available && (
        <div className="upd-box gy-8" style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 17, fontWeight: 800 }}>Nova versão: {res.version}</span>
          {res.notes && res.notes.length > 0 && (
            <ul className="upd-notes">
              {res.notes.slice(0, 8).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
          {!prog ? (
            <div className="wrap-row" style={{ display: 'flex' }}>
              <button className="btn primary" data-nav="" data-nav-default="" disabled={busy} onClick={install}>
                Atualizar agora
              </button>
            </div>
          ) : (
            <div className="gy-6" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="progress" style={{ height: 8 }}>
                <div style={{ width: (prog.pct ?? 35) + '%' }} />
              </div>
              <span className="muted" style={{ fontSize: 15 }}>
                {prog.msg}
                {prog.pct !== null && prog.pct < 100 ? ` ${prog.pct}%` : ''}
              </span>
            </div>
          )}
        </div>
      )}
      {noFeed && (
        <span className="upd-nofeed" role="status">
          <b>Não deu para ler as versões no GitHub do PRISMA.</b> O repositório precisa estar público e ter uma Release com o arquivo
          prisma-update.json. Até lá, instale a versão nova pelo arquivo da Release.
        </span>
      )}
      {err && <span style={{ fontSize: 15, color: '#FF6B3D', fontWeight: 700 }}>{err}</span>}
    </div>
  );
}
