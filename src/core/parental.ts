// Bloquear canal (cadeado da barra do canal): o canal só abre com a senha
// de 4 números. A senha vale para o aparelho; os canais bloqueados são de
// cada perfil. Desbloqueado uma vez, o canal fica liberado até fechar o app.

import { prefGet, prefSet } from './storage';

const unlocked = new Set<string>();

export function hasPin(): boolean {
  return !!prefGet<string>('pin', '');
}
export function setPin(pin: string): void {
  prefSet('pin', pin);
}
export function checkPin(pin: string): boolean {
  return !!pin && pin === prefGet<string>('pin', '');
}

export function lockedIds(): string[] {
  return prefGet<string[]>('locked', []);
}
export function isLocked(id: string): boolean {
  return lockedIds().includes(id) && !unlocked.has(id);
}
export function isLockMarked(id: string): boolean {
  return lockedIds().includes(id);
}
export function setLocked(id: string, on: boolean): void {
  const cur = lockedIds().filter((x) => x !== id);
  prefSet('locked', on ? [...cur, id] : cur);
  if (on) unlocked.delete(id);
}
export function unlockForSession(id: string): void {
  unlocked.add(id);
}
