import { describe, expect, it } from 'vitest';
import { parseNetflixTsv, compact } from '../scripts/tops/build-tops.mjs';

describe('gerador de tops', () => {
  it('lê o TSV oficial da Netflix: semana mais recente do Brasil, em ordem', () => {
    const tsv = [
      'country_name\tcountry_iso2\tweek\tcategory\tweekly_rank\tshow_title\tseason_title\tcumulative_weeks_in_top_10',
      'Brazil\tBR\t2026-10-25\tFilms\t1\tOld\tN/A\t1',
      'Brazil\tBR\t2026-11-01\tFilms\t2\tB\tN/A\t1',
      'Brazil\tBR\t2026-11-01\tFilms\t1\tA\tN/A\t1',
      'Brazil\tBR\t2026-11-01\tTV\t1\tSquid Game\tSquid Game: Season 2\t3',
      'Brazil\tBR\t2026-11-01\tTV\t2\tSquid Game\tSquid Game: Season 1\t9',
      'Argentina\tAR\t2026-11-08\tFilms\t1\tX\tN/A\t1',
    ].join('\n');
    const r = parseNetflixTsv(tsv);
    expect(r.week).toBe('2026-11-01');
    expect(r.movie.map((x) => x.t)).toEqual(['A', 'B']);
    expect(r.tv).toEqual([{ t: 'Squid Game', s: 'Squid Game: Season 2' }]);
  });
  it('item compacto do TMDB', () => {
    expect(compact({ id: 1, title: 'Duna', original_title: 'Dune', release_date: '2021-09-15', vote_average: 7.78 })).toEqual({ i: 1, t: 'Duna', o: 'Dune', y: 2021, r: 7.8 });
  });
});
