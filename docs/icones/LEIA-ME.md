# Ícones premium da TV ao vivo — acompanhamento

Os ícones gerados pelo Samuel no ChatGPT substituem, na TV ao vivo, os logos que vêm da lista IPTV.
O controle principal é **`controle-icones.csv`**. Ele tem as 504 entradas da `relacao-completa.csv` do pacote,
com as colunas originais preservadas (inclusive `Status`, a disponibilidade da imagem) e mais estas:

| Coluna | O que é |
|---|---|
| `StatusIntegracao` | `aplicado` (visto carregando no app), `revisar` (no app, mas com problema anotado) ou `pendente` (sem imagem ou ainda não ligado) |
| `ChaveApp` | chave usada em `public/logos/custom/meus-logos.json` (as variantes vêm separadas por `|`) |
| `CaminhoApp` | arquivo no projeto |
| `CanaisVerificados` | quantas linhas da TV ao vivo mostraram a imagem no app de teste |
| `LoteIntegracao` | em que lote entrou |
| `ObservacaoIntegracao` | ajustes de chave, bloqueios e o que revisar |

## Como entra um lote

1. Descompactar o zip numa pasta própria e ler `mapa-prisma.json`, `manifesto.json` e `relacao-completa.csv`.
2. Copiar a versão **256 × 256** (`lista-256/` e `variantes-numeradas/lista-256/`) para `public/logos/custom/`.
   Os 512 pesariam ~15 MB a cada 150 ícones no pacote da TV e gastariam memória na webOS 3.5; na lista o logo aparece com 40 px e no Início com ~140 px.
3. Ligar as chaves em `meus-logos.json`. Cuidado com chave curta: o app tira palavras do fim do nome até achar um logo,
   então "canal" pegaria todo canal que começa com "Canal". Valor `""` bloqueia essa herança (ex.: `"tcm canal 10 rn": ""`).
4. Simular com os nomes reais da Goldcard (sem vídeo nem credenciais) e conferir na TV ao vivo do app de teste, categoria por categoria;
   só marcar `aplicado` o que carregou. Conferir o contraste no fundo escuro.
5. Regerar o controle e contar aplicados / revisar / pendentes.

Regra do app (0.34.6): meu ícone só passa na frente do logo oficial quando casa com o nome de forma tão específica quanto ele
("Record" genérico não cobre o oficial da "Record RJ"). Canal sem ícone novo continua com o que tinha.

## Lotes

| Lote | Data | Imagens no pacote | Aplicados | Revisar | Pendentes | Versão |
|---|---|---:|---:|---:|---:|---|
| 1 | 11/11/2026 | 151 + 9 variantes | 147 | 4 | 353 | 0.34.6 |
| 2 | 12/11/2026 | 34 (32 marcas) | 177 | 8 | 319 | 0.34.7 |
| 4 | 12/11/2026 | 23 | 199 | 9 | 296 | 0.35.2 |
| pacotes 2, 3 e 5 | 12/11/2026 | 22 + 63 + 18 | 296 | 15 | 193 | 0.35.2 |
| pacotes 6 e 7 | 12/11/2026 | 9 + 12 | 315 | 17 | 172 | 0.35.4 |

Nome dos pacotes × lotes daqui: o "lote 2" daqui é o `PRISMA-faltantes-lote-1.zip`; o "4" é o `PRISMA-faltantes-lote-4.zip`.
Do pacote 2 em diante o controle grava `pacote lote-N (data)` em `LoteIntegracao`.

**Pacotes 6 e 7** (21 ícones): 42 linhas da TV ao vivo com ícone novo (VTV SBT, Disney Clássico, X-Men, Pica-Pau, Corrida Maluca, Filhos da Anarquia e outros desenhos e séries 24H), todas carregadas em 256 px, nenhuma falha; nenhum status anterior mudou.
- Revisar: Castlevania (letras vermelho-escuras e finas) e Sakura Card (letras pequenas).
- Faltam 172: 153 não geradas e 19 por confirmar identidade.
- Do pacote só entram `lista-256/` e os três arquivos de controle (`mapa-prisma.json`, `mapa-prisma-completo-atualizado.json`, `relacao-completa-atualizada.csv`); no lote 7 isso é ~0,6 MB de 31,8 MB. As outras pastas (`prisma-512`, `grande-1024`, `originais`, `fontes`, `lista-96`, `webp-256`) não são usadas.

**Pacotes 2, 3 e 5** (103 ícones): 306 linhas da TV ao vivo com ícone novo, todas carregadas em 256 px, nenhuma falha;
nenhum status anterior mudou. Cobrem emissoras (TV Aracati, IMPD, Petrópolis, Globo Cabo Branco, Rede Gospel, Ideal TV,
Boa Vontade, Cine Brasil, TV Arapuan, RCN67, Santa Portal), quase todos os desenhos e séries 24H, os canais de shows
(Gusttavo Lima, Henrique e Juliano, Jorge e Mateus, Zé Neto e Cristiano) e duas marcas adultas (BangBros, Brazzers).
- `tcm canal 10 rn` deixou de ser bloqueio: o pacote 3 trouxe a marca própria (TCM 10).
- Revisar (contraste, já aparecem no app): Black Mirror, Jogos Mortais, John Wick, Cine Brasil TV, TV Arapuan (o pacote já
  avisava) e Web TV Rio Grande (fonte pequena, ilegível na lista).
- Faltam 193: 174 não geradas e 19 por confirmar identidade.

**Lote 4** (`PRISMA-faltantes-lote-4.zip`, 23 ícones): 99 linhas da TV ao vivo com ícone novo (NBA League Pass 1–13,
A Fazenda sinais 1–7, Trace Brazuca, desenhos e séries 24H) e nenhuma falha; nenhum status anterior mudou.
- Revisar (contraste no fundo escuro, já aparece no app): Timão e Pumba (letras escuras; o pacote já avisava).
- Faltam 296: 85 nos pacotes 2 e 3 que ainda não chegaram, 192 não geradas e 19 por confirmar identidade.

**Lote 1:** 159 arquivos, 1.011 linhas da TV ao vivo verificadas com o ícone novo e nenhuma falha de carregamento.
- Revisar (contraste no fundo escuro, já aparecem no app): Sabor & Arte, CNN Brasil Money, Paramount+ (2 linhas do CSV: PARAMOUNT e PARAMOUNT+).
- Chaves corrigidas: `canal` → `canal 21`, `ge` → `ge tv`, `arte` → `arte 1`. `paramount` usa a imagem de `paramount+`.
- Bloqueios: `tcm canal 10 rn` (não é a TCM) e `tv gazeta maceio` (falta a identidade local).
- Achado no caminho: os 7 sinais da HBO+ sumiam do app (juntados à HBO). Corrigido.
- Faltam 353: 66 + 11 do grupo prioritário, 6 que já tinham logo, 209 canais 24H e 61 adultos.

**Lote 2** (pacote `PRISMA-faltantes-lote-1.zip`, 34 entradas novas): 33 arquivos novos (`red.png` é igual a `red-bull-tv.png`), 1.098 linhas da TV ao vivo com ícone novo e nenhuma falha; nenhum status do lote 1 mudou.
- Revisar (contraste no fundo escuro, já aparecem no app): Central TV Brasil e Web - Central TV Brasil, TV Pampa, TV Clube Piauí.
- Chaves corrigidas: `us` → `us nfl network`, `tv santa` → `tv santa cruz`, `tv grande` → `tv grande rio`, `red` → `red bull tv`.
- O controle foi refeito a partir de `relacao-completa-atualizada.csv` do pacote, preservando o `LoteIntegracao` dos já aplicados. As colunas `StatusAnterior`, `StatusIntegracao` e `ArquivoPNG512` do pacote não entram (o status vale o que foi visto no app).
- Faltam 319: 45 do grupo prioritário, 4 que já tinham logo (Globo TV Cabo Branco, Rede Gospel, Ideal TV, TCM canal 10-RN), 209 canais 24H e 61 adultos.

## Ícones na TV LG (0.35.1)

A atualização dentro do app da TV troca só o código (`prisma-webos-<v>.json`); as imagens e o `meus-logos.json`
continuam os do `.ipk` instalado. Por isso, quando a TV roda um código mais novo que o `.ipk` (`window.__PRISMA_OTA__`),
ela lê o `meus-logos.json` **desta versão** pela jsDelivr (`cdn.jsdelivr.net/gh/xSam10-10/prisma@<commit>/public/logos/custom/`,
commit gravado no build como `__APP_COMMIT__`) e busca lá só as imagens que não tem. As imagens ficam no cache da TV
(a jsDelivr manda "imutável" para endereço com commit). Sem internet, usa a última lista guardada (`prisma.logosRemote`).
Para testar no PC: `localStorage['prisma.logosCdn'] = 'true'`. Um lote novo de ícones chega à TV na próxima publicação, sem reinstalar.
