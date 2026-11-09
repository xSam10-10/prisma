import { useEffect, useMemo, useState } from 'react';
import type { Playlist } from '../core/types';
import { categoriesOf } from '../core/source';
import {
  catKey, catsUnlocked, checkPin, hasPin, hiddenCats, hiddenChannels, lockedCats, lockedIds, onParental, pinChanged, relockCats,
  setCatHidden, setCatLocked, setChannelHidden, setLocked, setPin, unlockCats,
} from '../core/parental';
import { PinDialog } from './ChannelBar';
import { toast } from '../ui/premium2';

// Ajustes › Proteção: senha, categorias protegidas (pedem a senha), categorias e canais escondidos.

const KINDS: [('live' | 'movie' | 'series'), string][] = [['live', 'Ao vivo'], ['movie', 'Filmes'], ['series', 'Séries']];

export function ProtectionPanel({ playlist }: { playlist: Playlist }) {
  const [, tick] = useState(0);
  useEffect(() => onParental(() => tick((x) => x + 1)), []);
  const [dlg, setDlg] = useState<null | 'create' | 'old' | 'new' | 'open' | 'unlockCh'>(null);
  const [chId, setChId] = useState('');
  const [kind, setKind] = useState<'live' | 'movie' | 'series'>('live');
  const [filter, setFilter] = useState<'all' | 'locked' | 'hidden'>('all');
  const items = playlist.items;
  const cats = useMemo(() => categoriesOf(items, kind), [items, kind]);
  const locked = new Set(lockedCats(items));
  const hidden = new Set(hiddenCats());
  const pin = hasPin();
  const shown = cats.filter((c) => {
    const k = catKey(kind, c.name);
    return filter === 'all' || (filter === 'locked' ? locked.has(k) : hidden.has(k));
  });
  const hch = hiddenChannels();
  const chLocked = lockedIds();
  return (
    <>
      <div className="prot-card">
        <div className="prot-txt">
          <b>Senha de 4 números</b>
          <span className="muted">
            {pin
              ? `Ativa. ${locked.size} ${locked.size === 1 ? 'categoria protegida' : 'categorias protegidas'} e ${chLocked.length} ${chLocked.length === 1 ? 'canal bloqueado' : 'canais bloqueados'}. ${catsUnlocked() ? 'Liberadas até fechar o app.' : 'Protegidas somem do app até digitar a senha.'}`
              : 'Crie uma senha para proteger categorias (as de adulto ficam protegidas automaticamente) e bloquear canais.'}
          </span>
        </div>
        <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
          {!pin && <button className="btn primary" data-nav="" onClick={() => setDlg('create')}>Criar senha</button>}
          {pin && !catsUnlocked() && locked.size > 0 && <button className="btn primary" data-nav="" onClick={() => setDlg('open')}>🔓 Liberar até fechar o app</button>}
          {pin && catsUnlocked() && <button className="btn primary" data-nav="" onClick={() => { relockCats(); toast('Categorias protegidas fechadas', '🔒'); }}>🔒 Fechar de novo</button>}
          {pin && <button className="btn" data-nav="" onClick={() => setDlg('old')}>Trocar senha</button>}
        </div>
      </div>

      <span className="prot-h">Categorias</span>
      <span className="muted" style={{ fontSize: 15 }}>🔒 Proteger: só aparece depois da senha · 👁 Esconder: some do app (volta aqui).</span>
      <div className="scroll-x" style={{ flexShrink: 0, margin: '8px 0' }}>
        {KINDS.map(([k, l]) => (
          <button key={k} className={'chip' + (kind === k ? ' on' : '')} data-nav="" onClick={() => setKind(k)}>{l}</button>
        ))}
        <span style={{ width: 18, flexShrink: 0 }} />
        {([['all', 'Todas'], ['locked', 'Protegidas'], ['hidden', 'Escondidas']] as const).map(([k, l]) => (
          <button key={k} className={'chip' + (filter === k ? ' on' : '')} data-nav="" onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="prot-list">
        {shown.length === 0 && <span className="muted">Nenhuma categoria aqui.</span>}
        {shown.map((c) => {
          const k = catKey(kind, c.name);
          const isL = locked.has(k);
          const isH = hidden.has(k);
          return (
            <div key={k} className={'prot-row' + (isH ? ' off' : '')}>
              <span className="prot-name">{c.name}</span>
              <span className="muted prot-count">{c.count}</span>
              <button
                className={'chip' + (isL ? ' on' : '')}
                data-nav=""
                onClick={() => {
                  if (!pin) return setDlg('create');
                  setCatLocked(items, k, !isL);
                }}
              >
                {isL ? '🔒 Protegida' : '🔒 Proteger'}
              </button>
              <button className={'chip' + (isH ? ' on' : '')} data-nav="" onClick={() => setCatHidden(k, !isH)}>
                {isH ? '👁 Mostrar' : '👁 Esconder'}
              </button>
            </div>
          );
        })}
      </div>

      {hch.length > 0 && (
        <>
          <span className="prot-h">Canais escondidos</span>
          <div className="prot-list">
            {hch.map((c) => (
              <div key={c.id} className="prot-row">
                <span className="prot-name">{c.name}</span>
                <button className="chip" data-nav="" onClick={() => setChannelHidden(c, false)}>👁 Mostrar</button>
              </div>
            ))}
          </div>
        </>
      )}
      {chLocked.length > 0 && (
        <>
          <span className="prot-h">Canais bloqueados</span>
          <div className="prot-list">
            {chLocked.map((id) => {
              const ch = items.find((i) => i.id === id);
              return (
                <div key={id} className="prot-row">
                  <span className="prot-name">{ch?.name ?? id}</span>
                  <button className="chip" data-nav="" onClick={() => { setChId(id); setDlg('unlockCh'); }}>Desbloquear</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {dlg && (
        <PinDialog
          title={dlg === 'create' ? 'Criar senha' : dlg === 'old' ? 'Senha atual' : dlg === 'new' ? 'Nova senha' : dlg === 'unlockCh' ? 'Desbloquear canal' : 'Liberar categorias protegidas'}
          help={
            dlg === 'create'
              ? 'Escolha 4 números. A senha vale para este aparelho; guarde-a. As categorias de adulto passam a pedir a senha.'
              : dlg === 'old'
                ? 'Digite a senha atual.'
                : dlg === 'new'
                  ? 'Escolha a nova senha de 4 números.'
                  : dlg === 'unlockCh'
                    ? 'Digite a senha para tirar o bloqueio do canal.'
                    : 'Digite a senha. As categorias protegidas aparecem até fechar o app.'
          }
          onClose={() => setDlg(null)}
          onSubmit={(p) => {
            if (dlg === 'create' || dlg === 'new') {
              setPin(p);
              pinChanged();
              toast(dlg === 'create' ? 'Senha criada' : 'Senha trocada', '🔒');
              setDlg(null);
              return null;
            }
            if (!checkPin(p)) return 'Senha incorreta.';
            if (dlg === 'old') setDlg('new');
            else if (dlg === 'unlockCh') {
              setLocked(chId, false);
              pinChanged();
              toast('Canal desbloqueado', '🔓');
              setDlg(null);
            } else {
              unlockCats();
              toast('Liberadas até fechar o app', '🔓');
              setDlg(null);
            }
            return null;
          }}
        />
      )}
    </>
  );

}
