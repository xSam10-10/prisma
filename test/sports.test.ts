import { describe, expect, it } from 'vitest';
import { currentStage, leaguesOf, liveExtras, stagesOf, tiesOf, withLive, type SportsFeed } from '../src/core/sports';
import type { Score } from '../src/core/scores';

const feed: SportsFeed = {
  v: 1,
  updated: '',
  at: Date.now(),
  leagues: [
    {
      id: 'bra.1',
      season: '2026',
      logo: '',
      teams: [
        ['Flamengo', 'FLA', 819, 'C8102E', ''],
        ['Palmeiras', 'PAL', 2029, '006437', ''],
        ['Santos', 'SAN', 2674, '', ''],
        ['Grêmio', 'GRE', 6273, '', ''],
      ],
      ev: [
        ['1', 100, 0, 1, '2', '0', 2, 1, '', 0],
        ['2', 200, 2, 3, '1', '1', 2, 1, '', 0],
        ['3', Math.floor(Date.now() / 1000) + 3600, 1, 2, '', '', 0, 2, '', 0],
        ['4', Math.floor(Date.now() / 1000) + 7200, 3, 0, '', '', 0, 2, '', 0],
      ],
      tables: [{ n: 'Série A', rows: [[1, 'Flamengo', 'FLA', 819, 3, 1, 1, 0, 0, 2, 0, 2, '81D6AC']] }],
    },
    {
      id: 'conmebol.libertadores',
      season: '2026',
      logo: '',
      teams: [
        ['Palmeiras', 'PAL', 1, '', ''],
        ['Fluminense', 'FLU', 2, '', ''],
      ],
      ev: [
        ['10', 100, 1, 0, '1', '2', 2, 'semifinals', 'Ida', 0],
        ['11', 200, 0, 1, '0', '1', 2, 'semifinals', 'Volta · empate no agregado · PAL vence por 5-3 nos pênaltis', 0],
      ],
      tables: [],
    },
  ],
};

describe('centro de esportes no app', () => {
  it('monta os campeonatos na ordem combinada, com escudos da ESPN e rodadas', () => {
    const ls = leaguesOf(feed);
    expect(ls[0].def.name).toBe('Brasileirão');
    expect(ls[1].def.name).toBe('Libertadores');
    expect(ls.length).toBe(10);
    expect(ls[2].partial).toBe(true);
    const b = ls[0];
    expect(b.matches[0].home.logo).toBe('https://a.espncdn.com/i/teamlogos/soccer/500/819.png');
    expect(b.matches[0].home.color).toBe('#C8102E');
    expect(b.tables[0].rows[0].zone).toBe('#81D6AC');
    const st = stagesOf(b);
    expect(st.map((s) => s.label)).toEqual(['Rodada 1', 'Rodada 2']);
    expect(currentStage(st)).toBe(1);
  });

  it('copas: fases em português e quem passou no mata-mata', () => {
    const lib = leaguesOf(feed)[1];
    const st = stagesOf(lib);
    expect(st[0].label).toBe('Semifinal');
    const [tie] = tiesOf(st[0]);
    expect(tie.legs).toHaveLength(2);
    expect(tie.winner).toBe('Palmeiras');
  });

  it('aplica o placar ao vivo e inclui jogos de hoje que o arquivo não tem', () => {
    const ls = leaguesOf(feed);
    const live: Score[] = [
      { home: 'Palmeiras', away: 'Santos', homeScore: '1', awayScore: '0', state: 'in', detail: "30'", start: Date.now(), league: 'Brasileirão', id: '3', path: 'soccer/bra.1' },
      { home: 'Bahia', away: 'Vitória', homeScore: '0', awayScore: '0', state: 'in', detail: "10'", start: Date.now(), league: 'Brasileirão', id: '99', path: 'soccer/bra.1' },
      // Mesmo número de jogo em outra liga: não mistura
      { home: 'X', away: 'Y', homeScore: '5', awayScore: '5', state: 'in', detail: "80'", start: Date.now(), league: 'Libertadores', id: '4', path: 'soccer/conmebol.libertadores' },
    ];
    const m = withLive(ls[0].matches, live);
    expect(m[2].state).toBe('in');
    expect(m[2].homeScore).toBe('1');
    expect(m[2].detail).toBe("30'");
    expect(m[3].state).toBe('pre');
    const extra = liveExtras(ls, live);
    expect(extra.map((x) => x.home.name)).toEqual(['Bahia', 'X']);
  });
});
