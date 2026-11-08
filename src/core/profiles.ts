import { dropProfilePrefs, prefGet, prefSet } from './storage';

// Perfis ("Quem está assistindo"): cada um com seus favoritos, histórico,
// seções, Minha lista, progresso, lembretes e ajustes (estrutura e tema).

export interface Profile {
  id: string;
  name: string;
  color: string;
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
