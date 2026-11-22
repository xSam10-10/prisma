// Resultado guardado por objeto (1.0.2). As telas de Filmes/Séries refaziam a
// separação, as categorias e a ordenação de dezenas de milhares de itens toda
// vez que a aba abria. Guardando pelo próprio array (que só muda quando a lista
// muda), voltar para a aba é imediato — na TV LG, de ~3 s para quase nada.
const store = new WeakMap<object, Map<string, unknown>>();

export function memoBy<T>(key: object, tag: string, fn: () => T): T {
  let m = store.get(key);
  if (!m) store.set(key, (m = new Map()));
  if (m.has(tag)) return m.get(tag) as T;
  const v = fn();
  m.set(tag, v);
  return v;
}

const NONE = {};
/** Igual a memoBy, mas por dois objetos (ex.: os Tops e a lista). `a` pode ser null. */
export function memoBy2<T>(a: object | null | undefined, b: object, tag: string, fn: () => T): T {
  const inner = memoBy(a ?? NONE, tag, () => new WeakMap<object, { v: T }>());
  const hit = inner.get(b);
  if (hit) return hit.v;
  const v = fn();
  inner.set(b, { v });
  return v;
}
