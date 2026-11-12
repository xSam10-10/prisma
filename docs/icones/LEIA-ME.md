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
