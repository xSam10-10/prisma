// Nome curto do canal: só o nome até a qualidade.
//   "GLOBO RJ HD [ALT]"        → "GLOBO RJ HD"
//   "SPORTV 2 FHD [H265]"      → "SPORTV 2 FHD"
//   "GLOBO SP 4K FHDR"         → "GLOBO SP 4K"
//   "A FAZENDA 18 SINAL 01"    → "A FAZENDA 18 SINAL 01" (sem qualidade: fica igual)

/** Siglas de qualidade (resolução) que encerram o nome. */
const QUALITY = /^(SD|HD|FHD|UHD|4K|8K|HQ|FULLHD|FULL\s?HD)$/i;

export function simplifyName(name: string): string {
  // Tira o que está entre colchetes ou parênteses: [ALT], [H265], (BACKUP)...
  // — menos numeração ("(1)", "[02]"), que diferencia canais ("XXX 01", "XXX 02").
  const base = name
    .replace(/\[\s*(\d{1,3})\s*\]|\(\s*(\d{1,3})\s*\)/g, ' $1$2 ')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = base.split(' ');
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^A-Za-z0-9]/g, '');
    if (QUALITY.test(w)) {
      // Número depois da qualidade continua no nome: "CANAL HD 02".
      const num = words.slice(i + 1).filter((x) => /^#?\d{1,3}$/.test(x));
      return [...words.slice(0, i + 1), ...num].join(' ');
    }
  }
  return base || name.trim();
}

/** Marcas de "outra fonte do mesmo canal": só elas podem juntar dois canais num só. */
const ALT_MARK = /\[[^\]]*\b(alt|alternativ[oa]|backup|bkp|reserva|op[cç][aã]o\s*\d*|fonte\s*\d*|sinal\s*\d+|h\.?\s?26[45]|hevc|x26[45])\b[^\]]*\]|\([^)]*\b(alt|alternativ[oa]|backup|bkp|reserva|op[cç][aã]o\s*\d*|fonte\s*\d*|h\.?\s?26[45]|hevc|x26[45])\b[^)]*\)|\b(alt|backup|bkp|reserva|h\.?\s?26[45]|hevc|x26[45])\b/gi;

/** Chave para juntar fontes do mesmo canal: o nome completo sem as marcas de fonte reserva/codec. */
export function sameChannelKey(full: string): string {
  return full.replace(ALT_MARK, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
}

/** Servidor (host:porta) de uma URL; "" se não der para ler. */
export function serverOf(url: string | undefined): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url ?? '');
  return m ? m[1].replace(/^[^@]*@/, '').toLowerCase() : '';
}

/**
 * Dois canais com o mesmo nome são "fonte reserva" um do outro só se vierem de servidores diferentes.
 * No mesmo servidor (ex.: Xtream da Goldcard), nomes iguais são canais diferentes ("XXX 4K" ×10).
 */
export function isBackupOf(firstUrl: string | undefined, url: string | undefined): boolean {
  return serverOf(firstUrl) !== serverOf(url);
}

/** Termos técnicos de codificação que não ajudam a escolher a categoria. */
const CODEC = /\s*\b(H\.?\s?265|H\.?\s?264|HEVC|AVC|X265|X264)\b\s*/gi;

/** "CANAIS | FHD H265" → "CANAIS | FHD". */
export function simplifyGroup(group: string): string {
  const out = group.replace(CODEC, ' ').replace(/\s+/g, ' ').replace(/[\s|•·\-–—:]+$/g, '').trim();
  return out || group;
}

/**
 * Nomes curtos das categorias, sem criar nomes repetidos: se duas categorias
 * diferentes ficariam iguais (ex.: "FHD" e "FHD H265"), as duas ficam como estão.
 */
export function simplifyGroups(groups: string[]): Map<string, string> {
  const uniq = [...new Set(groups)];
  const byShort = new Map<string, string[]>();
  for (const g of uniq) {
    const k = simplifyGroup(g).toLowerCase();
    byShort.set(k, [...(byShort.get(k) ?? []), g]);
  }
  const out = new Map<string, string>();
  for (const g of uniq) out.set(g, byShort.get(simplifyGroup(g).toLowerCase())!.length > 1 ? g : simplifyGroup(g));
  return out;
}

/**
 * Episódio solto de lista M3U: "Nome S01 E02", "Nome S01E02 - Título", "Nome T1E2", "Nome 1x02".
 * Devolve série, temporada, número e título (ou null se não for episódio).
 */
export function parseEpisodeName(name: string): { show: string; season: number; number: number; title: string } | null {
  const m =
    name.match(/^(.*?)[\s._-]*\b[ST](\d{1,2})[\s._-]*E[P]?(\d{1,3})\b\s*[-–:.]?\s*(.*)$/i) ||
    name.match(/^(.*?)[\s._-]+(\d{1,2})x(\d{1,3})\b\s*[-–:.]?\s*(.*)$/i);
  if (!m || !m[1].trim()) return null;
  return { show: m[1].replace(/[\s._-]+$/, '').trim(), season: Number(m[2]), number: Number(m[3]), title: m[4].trim() };
}
