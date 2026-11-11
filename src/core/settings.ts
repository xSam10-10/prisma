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
  /** Visual da barra do canal em tela cheia: clássica (estilo receptor) ou Prisma. */
  osdStyle: 'classic' | 'prisma' | 'card';
  /** Clique suave ao mover o foco (premium). */
  navSounds?: boolean;
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
  /** A = Menu Horizontal, C = Menu Vertical. ("B · Cinema" saiu na 0.18.0 e vira A.) */
  structure: 'A' | 'B' | 'C';
  /** Tema (só aparência). */
  theme: string;
  /** Logotipos dos streamings em Filmes/Séries: coloridos ou brancos. */
  streamLogos: 'color' | 'mono';
  /** Dentro de cada streaming: Marcante (o mais perto do app oficial, 0.28.0), Cores (só o tema, 0.27.0) ou Desligado. */
  streamSkin: 'marcante' | 'cores' | 'off';
  /** Legendas (0.29.0): tamanho, cor e fundo. */
  subSize: 'p' | 'm' | 'g' | 'gg';
  subColor: 'white' | 'yellow';
  subBg: 'none' | 'shadow' | 'box';
}

export const DEFAULT_SETTINGS: Settings = {
  layoutForm: 'auto',
  uiScale: 1,
  safeMargin: 0,
  videoFit: 'contain',
  osd: 'full',
  osdStyle: 'classic',
  osdSeconds: 5,
  liveFormat: 'auto',
  resumeLast: false,
  logoSource: 'official',
  tmdbKey: '',
  structure: 'A',
  theme: 'apple',
  streamLogos: 'color',
  streamSkin: 'marcante',
  subSize: 'm',
  subColor: 'white',
  subBg: 'shadow',
};

export function loadSettings(): Settings {
  const saved = prefGet<Partial<Settings> & { v18?: boolean }>('settings', {});
  const s = { ...DEFAULT_SETTINGS, ...saved };
  // 0.18.0: só Menu Horizontal (A) e Menu Vertical (C); tema padrão Apple TV
  // (quem estava no tema padrão antigo, Prisma, passa para o Apple TV uma vez).
  if (s.structure === 'B') s.structure = 'A';
  // 0.27.0 guardava liga/desliga: ligado vira Marcante; desligado continua sem mudar nada.
  const sk = s.streamSkin as unknown;
  if (sk === true) s.streamSkin = 'marcante';
  else if (sk === false) s.streamSkin = 'off';
  else if (sk !== 'marcante' && sk !== 'cores' && sk !== 'off') s.streamSkin = 'marcante';
  if (!saved.v18) {
    if (!saved.theme || saved.theme === 'prisma') s.theme = 'apple';
    (s as Settings & { v18?: boolean }).v18 = true;
    if (Object.keys(saved).length) prefSet('settings', s);
  }
  return s;
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
