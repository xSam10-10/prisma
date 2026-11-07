// Nome curto do canal: só o nome até a qualidade.
//   "GLOBO RJ HD [ALT]"        → "GLOBO RJ HD"
//   "SPORTV 2 FHD [H265]"      → "SPORTV 2 FHD"
//   "GLOBO SP 4K FHDR"         → "GLOBO SP 4K"
//   "A FAZENDA 18 SINAL 01"    → "A FAZENDA 18 SINAL 01" (sem qualidade: fica igual)

/** Siglas de qualidade (resolução) que encerram o nome. */
const QUALITY = /^(SD|HD|FHD|UHD|4K|8K|HQ|FULLHD|FULL\s?HD)$/i;

export function simplifyName(name: string): string {
  // Tira o que está entre colchetes ou parênteses: [ALT], [H265], (BACKUP)...
  const base = name.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const words = base.split(' ');
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^A-Za-z0-9]/g, '');
    if (QUALITY.test(w)) return words.slice(0, i + 1).join(' ');
  }
  return base || name.trim();
}
