import { useEffect, useRef, useState, type ReactNode } from 'react';
import { focusFirst, pushBack } from './nav';
import { VoiceButton } from './Voice';

/** Janela por cima da tela (escopo próprio de foco; Voltar fecha). */
export function Modal({ title, onClose, children, width = 560 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => focusFirst(box.current));
    const pop = pushBack(() => {
      onClose();
      return true;
    });
    return () => {
      pop();
      requestAnimationFrame(() => prev?.focus?.());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="modal-back" data-nav-scope="" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className="modal glass" role="dialog" aria-label={title} style={{ width }}>
        <span className="title" style={{ fontSize: 24 }}>{title}</span>
        {children}
      </div>
    </div>
  );
}

/** Janela "dar nome" (Nova seção, Renomear): campo + voz + Salvar/Cancelar. */
export function NameDialog({ title, initial = '', placeholder, onSave, onClose }: { title: string; initial?: string; placeholder?: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(initial);
  const ok = name.trim().length > 0;
  const save = () => ok && onSave(name.trim());
  return (
    <Modal title={title} onClose={onClose}>
      <div className="field">
        <label htmlFor="dlg-name">Nome</label>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            id="dlg-name"
            data-nav=""
            data-nav-default=""
            value={name}
            placeholder={placeholder}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                save();
              }
            }}
            style={{ flexGrow: 1 }}
          />
          <span style={{ marginLeft: 10 }}><VoiceButton onText={setName} size={44} /></span>
        </div>
      </div>
      <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 6 }}>
        <button className="btn primary" data-nav="" disabled={!ok} onClick={save}>Salvar</button>
        <button className="btn" data-nav="" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}

/** Botão que pede confirmação no segundo toque (ações que apagam dados). */
export function ConfirmButton({ label, confirmLabel = 'Toque de novo para confirmar', onConfirm, className = 'btn', done }: { label: string; confirmLabel?: string; onConfirm: () => void; className?: string; done?: string }) {
  const [stage, setStage] = useState<'idle' | 'ask' | 'done'>('idle');
  const t = useRef<number>();
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button
      className={className + (stage === 'ask' ? ' live' : '')}
      data-nav=""
      onClick={() => {
        clearTimeout(t.current);
        if (stage === 'ask') {
          onConfirm();
          setStage('done');
          t.current = window.setTimeout(() => setStage('idle'), 2500);
        } else {
          setStage('ask');
          t.current = window.setTimeout(() => setStage('idle'), 4000);
        }
      }}
    >
      {stage === 'ask' ? confirmLabel : stage === 'done' ? done ?? 'Feito' : label}
    </button>
  );
}
