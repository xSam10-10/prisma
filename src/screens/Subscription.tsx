import { useEffect, useState } from 'react';
import type { AccountInfo, Playlist } from '../core/types';
import { login } from '../core/xtream';
import { prefGet, prefSet } from '../core/storage';
import { toast } from '../ui/premium2';

// Painel da assinatura (Ajustes › Lista) e aviso antes de vencer (Início).

export function daysLeft(a?: AccountInfo, now = Date.now()): number | null {
  if (!a?.expiresAt) return null;
  return Math.ceil((a.expiresAt - now) / 86400000);
}

/** Aviso no Início: faltando 7 dias ou menos, uma vez por dia. */
export function expiryWarning(pl: Playlist): void {
  const d = daysLeft(pl.account);
  if (d === null || d > 7) return;
  const today = new Date().toISOString().slice(0, 10);
  if (prefGet<string>('expWarned', '') === today) return;
  prefSet('expWarned', today);
  toast(d <= 0 ? 'Sua assinatura venceu. Renove para continuar assistindo.' : d === 1 ? 'Sua assinatura vence amanhã.' : `Sua assinatura vence em ${d} dias.`, '⚠');
}

export function SubscriptionCard({ playlist }: { playlist: Playlist }) {
  const [acc, setAcc] = useState<AccountInfo | undefined>(playlist.account);
  const [busy, setBusy] = useState(false);
  const src = playlist.source;
  const refresh = async () => {
    if (src.type !== 'xtream') return;
    setBusy(true);
    try {
      setAcc(await login(src));
    } catch {
      toast('Não consegui falar com o servidor agora', '✕');
    }
    setBusy(false);
  };
  // Telas em uso mudam o tempo todo: consulta ao abrir.
  useEffect(() => {
    void refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const d = daysLeft(acc);
  const max = acc?.maxConnections ?? 0;
  const used = Math.min(max || 99, acc?.activeConnections ?? 0);
  const tone = d === null ? 'ok' : d <= 0 ? 'bad' : d <= 7 ? 'warn' : 'ok';
  const status = acc?.status && /active/i.test(acc.status) ? 'Ativa' : acc?.status && /expired/i.test(acc.status) ? 'Vencida' : acc?.status || (d !== null && d <= 0 ? 'Vencida' : 'Ativa');
  return (
    <div className={'sub-card ' + tone}>
      <div className="sub-main">
        <span className="sub-label">Assinatura · {src.name}</span>
        <span className={'sub-status ' + tone}>● {status}</span>
        {d !== null ? (
          <>
            <b className="sub-days">{d <= 0 ? 'Venceu' : d === 1 ? '1 dia' : `${d} dias`}</b>
            <span className="sub-sub">{d <= 0 ? 'em ' : 'até o vencimento · '}{new Date(acc!.expiresAt!).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
            <span className="sub-bar"><span style={{ width: `${Math.max(3, Math.min(100, (d / 30) * 100))}%` }} /></span>
          </>
        ) : (
          <b className="sub-days small">Sem data de vencimento na lista</b>
        )}
      </div>
      {max > 0 && (
        <div className="sub-screens">
          <span className="sub-label">Telas em uso agora</span>
          <span className="sub-dots">
            {Array.from({ length: Math.min(max, 8) }, (_, i) => (
              <span key={i} className={i < used ? 'on' : ''} />
            ))}
          </span>
          <span className="sub-sub">{used} de {max} {used >= max ? '· todas ocupadas' : ''}</span>
          {src.type === 'xtream' && (
            <button className="chip" data-nav="" onClick={refresh} disabled={busy}>{busy ? 'Consultando…' : '↻ Atualizar'}</button>
          )}
        </div>
      )}
    </div>
  );
}
