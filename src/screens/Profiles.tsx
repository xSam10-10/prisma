import { useEffect, useRef, useState } from 'react';
import { PROFILE_COLORS, addProfile, lastWatchedOf, askOnStart, currentProfile, profiles, removeProfile, setAskOnStart, switchProfile, updateProfile, type Profile } from '../core/profiles';
import { Ambient, Brand } from '../ui/bits';
import { ConfirmButton, NameDialog } from '../ui/Dialog';
import { useLayout } from '../ui/layout';
import { AVATAR_COUNT, ProfileAvatar } from '../ui/Avatar';
import { focusFirst } from '../ui/nav';

/** "Quem está assistindo?" — aparece ao abrir quando há mais de um perfil. */
export function WhoIsWatching({ onPick }: { onPick: (p: Profile) => void }) {
  const L = useLayout();
  const mobile = L.form === 'mobile';
  const root = useRef<HTMLDivElement>(null);
  const list = profiles();
  const cur = currentProfile();
  useEffect(() => {
    requestAnimationFrame(() => focusFirst(root.current, '.who.cur'));
  }, []);
  const size = mobile ? 96 : 150;
  return (
    <div ref={root} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <Ambient variant="home" />
      <div style={{ position: 'absolute', left: L.px, top: 30 + L.safeY }}>
        <Brand />
      </div>
      <div className="gy-24" style={{ position: 'absolute', left: 0, right: 0, top: '22%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span className="title" style={{ fontSize: mobile ? 28 : 44, fontWeight: 800 }}>Quem está assistindo?</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', maxWidth: L.W - L.px * 2 }}>
          {list.map((p) => (
            <button key={p.id} className={'who grow' + (p.id === cur.id ? ' cur' : '')} data-nav="" onClick={() => onPick(p)}>
              <span className="who-face" style={{ width: size, height: size }}>
                <ProfileAvatar profile={p} size={size} />
              </span>
              <span className="who-name">{p.name}</span>
              {lastWatchedOf(p.id) && <span className="who-last">{lastWatchedOf(p.id)}</span>}
            </button>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 15 }}>Crie, renomeie e apague perfis em Ajustes › Perfis.</span>
      </div>
    </div>
  );
}

/** Ajustes › Perfis */
export function ProfilesPanel() {
  const [list, setList] = useState(profiles());
  const [naming, setNaming] = useState<null | { id?: string; name: string }>(null);
  const [ask, setAsk] = useState(askOnStart() || profiles().length < 2);
  const cur = currentProfile();
  const refresh = () => setList(profiles());
  return (
    <>
      <span className="muted" style={{ fontSize: 15, lineHeight: 1.45 }}>
        Cada perfil tem os seus favoritos, histórico, seções, Minha lista, progresso dos filmes, lembretes e a sua estrutura e tema.
      </span>
      {list.map((p) => (
        <div key={p.id} className="opt-row" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="who-face" style={{ width: 48, height: 48, marginRight: 14 }}>
            <ProfileAvatar profile={p} size={48} />
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, flexGrow: 1 }}>
            {p.name}
            {p.id === cur.id && <span className="sec-tag" style={{ color: '#3DD6C4' }}>em uso</span>}
          </span>
          <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginBottom: -12 }}>
            {p.id !== cur.id && <button className="btn primary" data-nav="" onClick={() => switchProfile(p.id)}>Usar este perfil</button>}
            <button className="btn" data-nav="" onClick={() => setNaming({ id: p.id, name: p.name })}>Renomear</button>
            <button
              className="btn"
              data-nav=""
              aria-label="Trocar cor"
              onClick={() => {
                updateProfile(p.id, { color: PROFILE_COLORS[(PROFILE_COLORS.indexOf(p.color) + 1) % PROFILE_COLORS.length] });
                refresh();
              }}
            >
              <span style={{ width: 16, height: 16, borderRadius: 8, background: p.color, display: 'inline-block' }} /> Cor
            </button>
            <button
              className="btn"
              data-nav=""
              aria-label="Trocar ilustração do avatar"
              onClick={() => {
                const curIdx = typeof p.avatar === 'number' ? p.avatar : -1;
                updateProfile(p.id, { avatar: (curIdx + 1) % AVATAR_COUNT });
                refresh();
              }}
            >
              Avatar
            </button>
            {list.length > 1 && (
              <ConfirmButton
                label="Apagar"
                confirmLabel="Apaga os dados dele. Confirmar?"
                onConfirm={() => {
                  const wasCur = p.id === cur.id;
                  removeProfile(p.id);
                  if (wasCur) location.reload();
                  else refresh();
                }}
              />
            )}
          </div>
        </div>
      ))}
      <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 8 }}>
        <button className="btn primary" data-nav="" onClick={() => setNaming({ name: '' })}>+ Novo perfil</button>
        {list.length > 1 && (
          <button
            className="btn"
            data-nav=""
            onClick={() => {
              setAskOnStart(!ask);
              setAsk(!ask);
            }}
          >
            {ask ? '✓ Perguntar quem está assistindo ao abrir' : 'Abrir direto no último perfil'}
          </button>
        )}
      </div>
      {naming && (
        <NameDialog
          title={naming.id ? 'Renomear perfil' : 'Novo perfil'}
          initial={naming.name}
          placeholder="Ex.: Carol, Crianças, Sala"
          onClose={() => setNaming(null)}
          onSave={(name) => {
            if (naming.id) updateProfile(naming.id, { name });
            else addProfile(name);
            setNaming(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
