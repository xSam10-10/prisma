import { useState } from 'react';
import { useMemo } from 'react';
import { categoriesOf } from '../core/source';
import type { Channel } from '../core/types';
import { createSection, deleteSection, isMember, moveSection, orderedSections, renameSection, toggleMember, useSections, type SectionView } from '../core/sections';
import { Modal, NameDialog } from '../ui/Dialog';
import { focusEl } from '../ui/nav';

/** Janela "Organizar seções": ordem (prioridade numerada ou alfabética), criar, renomear, apagar. */
export function OrganizeSections({ views, onClose }: { views: SectionView[]; onClose: () => void }) {
  const { data, set } = useSections();
  const [naming, setNaming] = useState<null | { id?: string; name: string }>(null);
  const byPriority = [...views].sort((a, b) => a.priority - b.priority);
  const shown = data.sort === 'alpha' ? views : byPriority;

  const move = (id: string, to: number) => {
    set((d) => moveSection(d, views, id, to));
    // mantém o foco no mesmo botão depois de reordenar
    requestAnimationFrame(() => {
      const row = [...document.querySelectorAll<HTMLElement>('[data-sec-row]')].filter((r) => r.getAttribute('data-sec-row') === id)[0];
      if (row && !row.contains(document.activeElement)) focusEl(row.querySelector<HTMLElement>('.mv-focus'));
    });
  };

  if (naming) {
    return (
      <NameDialog
        title={naming.id ? 'Renomear seção' : 'Nova seção'}
        initial={naming.name}
        placeholder="Ex.: Futebol, Meus filmes 24h"
        onClose={() => setNaming(null)}
        onSave={(name) => {
          if (naming.id) set((d) => renameSection(d, naming.id!, name));
          else set((d) => createSection(d, name)[0]);
          setNaming(null);
        }}
      />
    );
  }

  return (
    <Modal title="Organizar seções" onClose={onClose} width={720}>
      <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 15, marginRight: 12 }}>Ordenar por</span>
        <button className={'chip' + (data.sort === 'priority' ? ' on' : '')} data-nav="" data-nav-default="" onClick={() => set((d) => ({ ...d, sort: 'priority' }))}>Prioridade (1, 2, 3…)</button>
        <button className={'chip' + (data.sort === 'alpha' ? ' on' : '')} data-nav="" onClick={() => set((d) => ({ ...d, sort: 'alpha' }))}>Ordem alfabética</button>
        <button className="chip" data-nav="" style={{ background: 'rgba(61,214,196,0.18)', color: '#3DD6C4' }} onClick={() => setNaming({ name: '' })}>+ Nova seção</button>
      </div>
      <span className="muted" style={{ fontSize: 14 }}>
        {data.sort === 'alpha'
          ? 'Em ordem alfabética os números ficam guardados; volte para “Prioridade” para usá-los.'
          : 'O número é a prioridade: 1 aparece primeiro. Use ▲ ▼ para mudar; “Topo” leva para o 1. Favoritos e Todos ficam sempre no topo.'}
      </span>
      <div className="scroll-y sec-list" style={{ maxHeight: 420 }}>
        {shown.map((v) => (
          <div key={v.id} className="sec-row" data-sec-row={v.id}>
            <span className="sec-num">{v.priority}</span>
            <span className="sec-name caps">
              {v.name}
              {v.custom && <span className="sec-tag">criada</span>}
            </span>
            <span className="sec-count">{v.count}</span>
            {data.sort === 'priority' && (
              <>
                <button className="mini mv-focus" data-nav="" aria-label="Subir" disabled={v.priority === 1} onClick={() => move(v.id, v.priority - 1)}>▲</button>
                <button className="mini" data-nav="" aria-label="Descer" disabled={v.priority === byPriority.length} onClick={() => move(v.id, v.priority + 1)}>▼</button>
                <button className="mini" data-nav="" aria-label="Levar para o topo" disabled={v.priority === 1} onClick={() => move(v.id, 1)}>Topo</button>
              </>
            )}
            {v.custom && (
              <>
                <button className="mini" data-nav="" aria-label="Renomear" onClick={() => setNaming({ id: v.id, name: v.name })}>✎</button>
                <button className="mini danger" data-nav="" aria-label="Apagar seção" onClick={() => set((d) => deleteSection(d, v.id))}>✕</button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
        <button className="btn primary" data-nav="" onClick={onClose}>Concluir</button>
      </div>
    </Modal>
  );
}

/** Player: escolher em quais seções o canal aparece (nativas ou criadas). */
export function SectionPicker({ ch, live, onClose }: { ch: Channel; live: Channel[]; onClose: () => void }) {
  const { data, set } = useSections();
  const native = useMemo(() => categoriesOf(live, 'live'), [live]);
  const views = orderedSections(native, data, live);
  const [naming, setNaming] = useState(false);
  if (naming) {
    return (
      <NameDialog
        title="Nova seção"
        placeholder="Ex.: Futebol, Meus canais 24h"
        onClose={() => setNaming(false)}
        onSave={(name) => {
          set((d) => {
            const [nd, id] = createSection(d, name);
            return toggleMember(nd, id, ch);
          });
          setNaming(false);
        }}
      />
    );
  }
  return (
    <Modal title="Adicionar à seção" onClose={onClose} width={600}>
      <span className="muted caps" style={{ fontSize: 15 }}>{ch.name}</span>
      <button className="btn" data-nav="" data-nav-default="" style={{ alignSelf: 'flex-start', color: '#3DD6C4' }} onClick={() => setNaming(true)}>+ Criar nova seção com este canal</button>
      <div className="scroll-y sec-list" style={{ maxHeight: 380 }}>
        {views.map((v) => {
          const own = ch.group === v.id; // seção de origem do canal (não dá para tirar)
          const on = isMember(v.id, ch, data);
          return (
            <button key={v.id} className={'pick-row' + (on ? ' on' : '')} data-nav="" disabled={own} onClick={() => set((d) => toggleMember(d, v.id, ch))}>
              <span className="pick-check" aria-hidden="true">{on ? '✓' : ''}</span>
              <span className="sec-name caps">{v.name}{v.custom && <span className="sec-tag">criada</span>}</span>
              <span className="sec-count">{own ? 'seção da lista' : on ? 'adicionado' : ''}</span>
            </button>
          );
        })}
      </div>
      <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap' }}>
        <button className="btn primary" data-nav="" onClick={onClose}>Concluir</button>
      </div>
    </Modal>
  );
}
