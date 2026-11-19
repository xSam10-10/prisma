declare const __APP_VERSION__: string;
/** Commit que gerou o código (para buscar os ícones desta versão no GitHub). */
declare const __APP_COMMIT__: string;
/** Dados da Goldcard embutidos na publicação (secrets do GitHub) ou null. */
declare const __GOLDCARD__: { server: string; servers?: string[]; username: string; password: string } | null;
