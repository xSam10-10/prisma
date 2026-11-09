// Várias listas IPTV no mesmo app: as listas já usadas ficam guardadas (só neste aparelho)
// para trocar com um toque em Ajustes › Lista.
import { prefGet, prefSet } from './storage';
import type { SourceConfig } from './types';

export function sourceKey(s: SourceConfig): string {
  return s.type === 'xtream' ? `x|${s.server}|${s.username}` : s.type === 'm3u' ? `m|${s.url}` : `f|${s.fileName}`;
}
export function savedSources(): SourceConfig[] {
  return prefGet<SourceConfig[]>('sources', []);
}
export function rememberSource(s: SourceConfig): void {
  // Arquivo M3U: guarda só o nome (o conteúdo pode ser grande demais); abrir de novo pede o arquivo.
  const keep: SourceConfig = s.type === 'm3u-file' ? { ...s, content: '' } : s;
  const all = savedSources().filter((x) => sourceKey(x) !== sourceKey(s));
  prefSet('sources', [keep, ...all].slice(0, 8));
}
export function forgetSource(s: SourceConfig): void {
  prefSet('sources', savedSources().filter((x) => sourceKey(x) !== sourceKey(s)));
}
