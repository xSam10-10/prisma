import { dropProfilePrefs, prefGet, prefSet } from './storage';

// Perfis ("Quem está assistindo"): cada um com seus favoritos, histórico,
// seções, Minha lista, progresso, lembretes e ajustes (estrutura e tema).

export interface Profile {
  id: string;
  name: string;
  color: string;
  /** Ilustração do avatar (src/ui/Avatar.tsx). */
  avatar?: number;
  /** Foto do avatar (0.29.0): imagem quadrada pequena (JPEG em data URL), no lugar da ilustração. */
  photo?: string;
}

/** O que o perfil viu por último (sem trocar de perfil): filme/série em andamento ou "canais ao vivo". */
export function lastWatchedOf(id: string): string | undefined {
  const key = (k: string) => (id === 'p1' ? 'prisma.' + k : `prisma.p.${id}.${k}`);
  try {
    const kind = JSON.parse(localStorage.getItem(key('lastKind')) || '"live"') as string;
    const vod = JSON.parse(localStorage.getItem(key('vodRecents')) || '[]') as { name: string; group: string; seriesId?: string }[];
    const live = JSON.parse(localStorage.getItem(key('recents')) || '[]') as string[];
    if (kind === 'vod' && vod[0]) return vod[0].seriesId ? vod[0].group : vod[0].name;
    if (live.length) return 'Canais ao vivo';
    if (vod[0]) return vod[0].seriesId ? vod[0].group : vod[0].name;
  } catch {
    /* ignora */
  }
  return undefined;
}

export const PROFILE_COLORS = ['#3D7BFF', '#FF6B3D', '#3DD6C4', '#F5B83D', '#A020F0', '#E50914', '#1F8A5B', '#C8264B'];

export function profiles(): Profile[] {
  const list = prefGet<Profile[]>('profiles', []);
  return list.length ? list : [{ id: 'p1', name: 'Samuel', color: '#3D7BFF' }];
}

export function currentProfile(): Profile {
  const id = prefGet<string>('profile', 'p1');
  const list = profiles();
  return list.find((p) => p.id === id) ?? list[0];
}

export function askOnStart(): boolean {
  return prefGet<boolean>('askProfile', true) && profiles().length > 1;
}

export function setAskOnStart(v: boolean): void {
  prefSet('askProfile', v);
}

export function saveProfiles(list: Profile[]): void {
  prefSet('profiles', list);
}

export function addProfile(name: string): Profile {
  const list = profiles();
  const p = { id: 'p' + Date.now().toString(36), name: name.trim(), color: PROFILE_COLORS[list.length % PROFILE_COLORS.length] };
  saveProfiles([...list, p]);
  return p;
}

export function updateProfile(id: string, patch: Partial<Profile>): void {
  saveProfiles(profiles().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function removeProfile(id: string): void {
  const list = profiles().filter((p) => p.id !== id);
  if (!list.length) return;
  saveProfiles(list);
  dropProfilePrefs(id);
  if (currentProfile().id === id) prefSet('profile', list[0].id);
}

/** Troca de perfil: recarrega o app para ler os dados do perfil escolhido. */
export function switchProfile(id: string): void {
  prefSet('profile', id);
  try {
    sessionStorage.setItem('prisma.chosen', '1');
  } catch {
    /* ignora */
  }
  location.reload();
}

/** Já escolheu o perfil nesta abertura do app? */
export function chosenThisSession(): boolean {
  try {
    return sessionStorage.getItem('prisma.chosen') === '1';
  } catch {
    return true;
  }
}

/** Prepara a foto do avatar: recorta o centro em quadrado e reduz para 256×256 (JPEG). */
export function photoFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('sem canvas'));
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagem inválida'));
    };
    img.src = url;
  });
}
