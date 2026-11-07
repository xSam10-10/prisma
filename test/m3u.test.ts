import { describe, expect, it } from 'vitest';
import { classify, detectXtreamFromUrl, parseM3U } from '../src/core/m3u';
import { normalizeServer } from '../src/core/xtream';

const SAMPLE = `﻿#EXTM3U url-tvg="http://epg.exemplo.com/guia.xml.gz" tvg-shift="0"
#EXTINF:-1 tvg-id="globo.br" tvg-name="Globo SP" tvg-logo="http://x/globo.png" group-title="Abertos",Globo SP HD
http://srv.exemplo.com:8080/live/u/p/101.ts
#EXTINF:-1 tvg-id="espn.br" tvg-chno="30" group-title="Esportes, Futebol",ESPN HD
#EXTVLCOPT:http-user-agent=PrismaTest
http://srv.exemplo.com:8080/live/u/p/102.m3u8
#EXTINF:-1 group-title="Abertos",Globo SP HD
http://backup.exemplo.com/globo.m3u8
#EXTINF:-1 tvg-logo="http://x/f.jpg" group-title="Filmes | Netflix",Filme Exemplo (2024)
http://srv.exemplo.com:8080/movie/u/p/5001.mp4
#EXTINF:-1 group-title="Séries | HBO Max",Série Exemplo S01 E01
http://srv.exemplo.com:8080/series/u/p/9001.mkv
#EXTINF:-1,Sem grupo
#EXTGRP:Notícias
http://n.exemplo.com/live.m3u8|User-Agent=Abc&Referer=http://ref.com/
linha-lixo-sem-url
`;

describe('parseM3U', () => {
  const r = parseM3U(SAMPLE);

  it('lê o guia do cabeçalho', () => {
    expect(r.epgUrl).toBe('http://epg.exemplo.com/guia.xml.gz');
  });

  it('lê canais, filmes e séries', () => {
    expect(r.items.map((i) => i.kind)).toEqual(['live', 'live', 'movie', 'series', 'live']);
  });

  it('lê atributos e título com vírgula no grupo', () => {
    const espn = r.items[1];
    expect(espn.name).toBe('ESPN HD');
    expect(espn.group).toBe('Esportes, Futebol');
    expect(espn.number).toBe(30);
    expect(espn.epgId).toBe('espn.br');
    expect(espn.headers?.userAgent).toBe('PrismaTest');
  });

  it('junta canal repetido como fonte 2', () => {
    expect(r.items[0].name).toBe('Globo SP HD');
    expect(r.items[0].altUrls).toEqual(['http://backup.exemplo.com/globo.m3u8']);
    expect(r.items[0].logo).toBe('http://x/globo.png');
  });

  it('entende #EXTGRP e cabeçalhos depois do |', () => {
    const n = r.items[4];
    expect(n.group).toBe('Notícias');
    expect(n.url).toBe('http://n.exemplo.com/live.m3u8');
    expect(n.headers).toEqual({ userAgent: 'Abc', referrer: 'http://ref.com/' });
  });
});

describe('classify', () => {
  it('detecta VOD pela extensão', () => {
    expect(classify('http://a/b/filme.mkv', 'Lançamentos')).toBe('movie');
    expect(classify('http://a/b/ep.mp4', 'Séries Netflix')).toBe('series');
    expect(classify('http://a/b/canal.m3u8', 'Filmes 24h')).toBe('live');
  });
});

describe('Xtream', () => {
  it('detecta link get.php', () => {
    expect(detectXtreamFromUrl('http://srv.com:8080/get.php?username=ana&password=123&type=m3u_plus&output=ts')).toEqual({
      server: 'http://srv.com:8080',
      username: 'ana',
      password: '123',
    });
    expect(detectXtreamFromUrl('http://srv.com/lista.m3u')).toBeNull();
  });

  it('normaliza o endereço do servidor', () => {
    expect(normalizeServer('srv.com:8080/')).toBe('http://srv.com:8080');
    expect(normalizeServer('https://srv.com/player_api.php?username=a')).toBe('https://srv.com');
  });
});

describe('endereços relativos', () => {
  it('resolve pela URL da lista', () => {
    const r = parseM3U('#EXTM3U\n#EXTINF:-1,Um\n./a/index.m3u8\n#EXTINF:-1,Dois\nb.ts\n', 'http://srv.com/listas/minha.m3u');
    expect(r.items.map((i) => i.url)).toEqual(['http://srv.com/listas/a/index.m3u8', 'http://srv.com/listas/b.ts']);
  });
  it('sem URL base, ignora linhas relativas', () => {
    expect(parseM3U('#EXTM3U\n#EXTINF:-1,Um\na.m3u8\n').items).toHaveLength(0);
  });
});
