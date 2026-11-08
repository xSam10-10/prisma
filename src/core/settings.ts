import { createContext, useContext } from 'react';
import { prefGet, prefSet } from './storage';

// Preferências do usuário (seção Ajustes). Ficam salvas neste aparelho.

export interface Settings {
  /** Forma da interface: automática pela tela, ou forçada. */
  layoutForm: 'auto' | 'tv' | 'mobile';
  /** Tamanho da interface (1 = automático pela tela). */
  uiScale: number;
  /** Margem de segurança para TVs que cortam as bordas (fração da tela). */
  safeMargin: number;
  /** Como o vídeo ocupa a tela. */
  videoFit: 'contain' | 'cover' | 'fill';
  /** Informações por cima do vídeo em tela cheia. */
  osd: 'full' | 'name' | 'none';
  /** Segundos que as informações ficam na tela. */
  osdSeconds: number;
  /** Formato preferido dos canais ao vivo (quando a lista oferece os dois). */
  liveFormat: 'auto' | 'hls' | 'ts';
  /** Abrir o último canal ao iniciar o app. */
  resumeLast: boolean;
  /** Logotipos: oficiais do PRISMA primeiro, ou os que vieram na lista. */
  logoSource: 'official' | 'list';
  /** Chave da API do TMDB (v3) — capas, trailers e Top 10. */
  tmdbKey: string;
  /** Estrutura: A Vidro Líquido · B Cinema · C Hub (no celular sempre A). */
  structure: 'A' | 'B' | 'C';
  /** Tema (só aparência). */
  theme: string;
}

export const DEFAULT_SETTINGS: Settings = {
  layoutForm: 'auto',
  uiScale: 1,
  safeMargin: 0,
  videoFit: 'contain',
  osd: 'full',
  osdSeconds: 5,
  liveFormat: 'auto',
  resumeLast: false,
  logoSource: 'official',
  tmdbKey: '',
  structure: 'A',
  theme: 'prisma',
};

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...prefGet<Partial<Settings>>('settings', {}) };
}

export function saveSettings(s: Settings): void {
  prefSet('settings', s);
}

export interface SettingsApi {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export const SettingsContext = createContext<SettingsApi>({ settings: DEFAULT_SETTINGS, update: () => {} });

export function useSettings(): SettingsApi {
  return useContext(SettingsContext);
}
