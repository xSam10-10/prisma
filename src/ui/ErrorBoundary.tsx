import { Component, type ReactNode } from 'react';

// Proteção contra erro (0.35.0): se uma tela quebrar, só ela mostra o aviso, em vez de o
// app inteiro ficar preto (o React desmonta tudo quando um erro escapa). Trocar de aba
// (resetKey) tenta de novo.

interface Props {
  children: ReactNode;
  /** Muda = tenta desenhar de novo (ex.: a aba ou o canal). */
  resetKey?: unknown;
  /** Onde o erro aconteceu (vai para o registro). */
  where: string;
  /** Sem isso, a tela some em silêncio (usado no player). */
  onHome?: () => void;
}

interface State {
  error: Error | null;
}

/** Últimos erros (Ajustes › Sobre pode mostrar; também ajuda a investigar na TV). */
export const recentErrors: { at: number; where: string; message: string }[] = [];

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    recentErrors.unshift({ at: Date.now(), where: this.props.where, message: String(error?.message ?? error) });
    recentErrors.length = Math.min(recentErrors.length, 10);
    try {
      console.error('[PRISMA] erro em ' + this.props.where, error);
    } catch {
      /* ignora */
    }
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (!this.props.onHome) return null;
    return (
      <div className="err-screen" role="alert">
        <span className="title" style={{ fontSize: 30, fontWeight: 800 }}>Algo deu errado nesta tela</span>
        <span className="muted" style={{ fontSize: 18, lineHeight: 1.5, maxWidth: 640, textAlign: 'center' }}>
          O resto do PRISMA continua funcionando. Volte ao início ou tente abrir a tela de novo.
        </span>
        <div className="wrap-row" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn primary" data-nav="" data-nav-default="" onClick={() => this.props.onHome?.()}>
            Voltar ao início
          </button>
          <button className="btn" data-nav="" onClick={() => this.setState({ error: null })}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }
}
