import { describe, expect, it } from 'vitest';
import { liteImageUrl } from '../src/ui/liteImages';

describe('imagens menores na TV LG', () => {
  it('troca os tamanhos grandes do TMDB', () => {
    expect(liteImageUrl('https://image.tmdb.org/t/p/w1280/abc.jpg')).toBe('https://image.tmdb.org/t/p/w780/abc.jpg');
    expect(liteImageUrl('https://image.tmdb.org/t/p/w780/abc.jpg')).toBe('https://image.tmdb.org/t/p/w300/abc.jpg');
    expect(liteImageUrl('http://image.tmdb.org/t/p/w600_and_h900_bestv2/x.jpg')).toBe('http://image.tmdb.org/t/p/w342/x.jpg');
    expect(liteImageUrl('https://image.tmdb.org/t/p/original/x.jpg')).toBe('https://image.tmdb.org/t/p/w780/x.jpg');
  });
  it('não mexe no resto', () => {
    expect(liteImageUrl('https://image.tmdb.org/t/p/w342/abc.jpg')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
    expect(liteImageUrl('http://servidor/logo/w780/x.png')).toBe('http://servidor/logo/w780/x.png');
    expect(liteImageUrl('logos/br/globo.png')).toBe('logos/br/globo.png');
  });
});
