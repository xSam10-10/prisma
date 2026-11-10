# PRISMA — documento de continuidade do projeto

> O código está em https://github.com/xSam10-10/prisma (pasta docs/ tem este arquivo).
> Cole este arquivo (ou o conteúdo dele) no início da nova conversa e diga:
> "Este é o projeto PRISMA. Leia tudo e continue de onde paramos."

Atualizado em: 07/11/2026 (Fase 1 iniciada)

---

## 0. ESTADO ATUAL — leia primeiro (10/11/2026 · versão 0.27.0)

**O que é:** PRISMA, player de IPTV pessoal do Samuel (lista Goldcard, Xtream em `http://lvbxsmart.xyz` — usuário/senha só com o Samuel, **nunca** gravar credenciais no repositório). Roda em: Windows (Electron), TV LG OLED55B7P (webOS 3.5 / Chrome 38), Android/Google TV (Capacitor) e navegador.

**Código:** GitHub `xSam10-10/prisma` (branch `main`). React 18 + TypeScript + Vite 8. O código atual está sempre na `main` do GitHub (o pacote .zip antigo tinha a 0.17.0).

**Publicar uma versão:** subir a versão em `package.json` e `webos/appinfo.json`, escrever as novidades no topo de `release-notes.md`, commit (autor Samuel Costa) + push na `main` e `gh workflow run release.yml --repo xSam10-10/prisma --ref main`. O workflow gera Windows (PRISMA-Setup-x.exe + latest.yml), TV LG (.ipk + prisma-webos-x.json para atualização no app), Android (PRISMA-Android-x.apk, assinatura fixa) e o manifesto `prisma-update.json`, numa Release com a data no nome (a sessão não cria tags).

**Atualização dentro do app:** lê `https://github.com/xSam10-10/prisma/releases/latest/download/` — conferida no Windows pelo usuário em 09/11 — repositório **público** desde 08/11 23h (conferido: `prisma-update.json` 0.18.0 e `prisma-tops.json` respondem 200). Ver 10i e 10r.

**Verificações antes de publicar:** `npx tsc --noEmit` · `npx vitest run` (55 testes) · `npm run build:webos` + `npx es-check@8.0.2 es5 "dist-webos/assets/*.js"` (TV de 2017: sem CSS gap/variáveis/grid; flex com prefixos -webkit-; nada de sintaxe nova no JS final).
**Testes de tela:** `node test/fake-xtream.mjs` (servidor Xtream falso na porta 8090, usuário `teste` / senha `1234`; também ESPN falsa em `/espn/...`, TMDB falso em `/tmdb/...`, `/updates/` com `UPDATE_DIR`) + `npx vite --port 5173` + roteiros Playwright. O Chromium do ambiente não decodifica H.264: nos testes, segurar as requisições de vídeo (`page.route(... /live/ ..., () => {})`).
**Limites do ambiente de desenvolvimento:** ESPN, TMDB, guias públicos e o servidor da Goldcard não são acessíveis de lá — testar com o servidor falso e pedir ao Samuel o teste real.

**Tops (0.18.0):** dados em `prisma-tops.json`, gerado pelo workflow `tops.yml` (4×/dia, `scripts/tops/build-tops.mjs`, secret `TMDB_KEY`) e publicado na Release pré-lançamento `tops`; o app baixa de `releases/download/tops/` (pref `topsFeed` para testes). Ver 10t.

**Histórico de versões:** seções 10b–10t (0.10.0 → 0.18.0). **Pendências atuais: `docs/PENDENCIAS.md`** (substitui as listas antigas das seções 10g e 11).

**Migração de conta (09/11):** o projeto pode continuar em outra conta do Claude seguindo `docs/MIGRAR-CONTA.md`.

**Centro de esportes (0.25.0–0.26.0, 10/11):** concluído (etapas 1–3 + placar flutuante). Dados da temporada, artilheiros e Fórmula 1 em `prisma-sports.json`, gerado pelo workflow `sports.yml` (a cada 2 h, `scripts/sports/build-sports.mjs`, ligas em `scripts/sports/leagues.json`, F1 pela Jolpica `api.jolpi.ca/ergast/f1`) e publicado na Release `tops`; o app baixa de `releases/download/tops/` (pref `sportsFeed` para testes) e aplica o placar ao vivo da ESPN por cima. Ver 10am e 10an. Pendências atuais: `docs/PENDENCIAS.md`.

**Sessão local (10/11):** a conversa nova roda no PC do Samuel (cópia em `Downloads\prisma`), que alcança ESPN e GitHub — dá para testar com dados reais da ESPN além do servidor falso. Playwright instalado globalmente (`NPMROOT=$(npm root -g)`).

**Como o Samuel gosta de trabalhar:** tudo em português; visual "mega premium" com cara de app oficial; quando ele pede "só sugira / não crie nada", responder só com a opinião; depois de cada lote, testar navegação pelo controle (setas/OK/Voltar) e publicar uma versão; avisar com honestidade o que depende da TV real, do TMDB ou da Goldcard. Sugestões de design descartadas estão listadas no topo de `docs/PENDENCIAS.md` (não oferecer de novo). Chave do TMDB fica só no secret `TMDB_KEY` e nos Ajustes de cada aparelho.

**Referências do app usado pelo Samuel (vídeos que ele mandou):** barra do canal estilo receptor + PIP (10f), programação do canal por dia (10h), lista de canais por cima da tela cheia com menu lateral e grupos (10j).

## 1. O que é o projeto

App de IPTV **para uso pessoal** que funciona como **player**: não traz conteúdo próprio, só reproduz as listas oficiais que o usuário assina. Visual de streaming premium (inspiração em Netflix e HBO Max) somado à organização de um app de IPTV que o usuário já usa: abas TV, Jogos, Filmes, Séries; lista de canais com prévia; guia de jogos com placar e lembrete; categorias.

### Decisões do usuário
| Tema | Decisão |
|---|---|
| Plataformas | **LG webOS (TV nativa)**, **Android** (celular e Android TV / Google TV), **Roku** (se possível) e **computador** |
| Uso | Pessoal |
| Lista | Provedor **Goldcard TV** (o usuário ainda vai enviar o link ou os dados de acesso) |
| Formatos de lista | **M3U / M3U8**, **HLS**, **lista SS IPTV** (M3U externa), **Smarters Player** e **XCIPTV** (ambos = API Xtream Codes: servidor + usuário + senha) |
| Nome | **PRISMA** |
| Logo | Opção **06 · Três Telas** (três "plays" sobrepostos em coral, âmbar e turquesa) |
| Design oficial | **Versão v2** (canvas "Protótipo IPTV — v2") |
| Menu | Início · Ao vivo · Jogos · Filmes · Séries · Anime (**Kids e Explorar foram removidos**) + Busca, Minha lista e Perfil fixos |
| Estruturas | O app tem **3 estruturas** e o usuário troca entre elas nos Ajustes (A, B, C) |
| Temas | Além da estrutura, o usuário escolhe um **tema**: só muda a aparência. Já existe **Prisma** (padrão) e **Netflix**. Próximos: outros streamings |

---

## 2. Links dos protótipos (canvas no claude.ai)

- **v2 (OFICIAL):** https://claude.ai/artifact/XFFsxsdJmMHDL4BY5ZEZeT
  - Página **"v2 · telas (oficial)"**: sistema visual, estados, telas comuns, estruturas A/B/C, celular
  - Página **"Temas"**: Ajustes › Aparência e as telas no tema Netflix
- **v1 (histórico, não usar como base):** https://claude.ai/artifact/TyyNMMKB58ZfbxuKfm15H2
  - Fase 0, as 3 opções originais, página "Marca e logo" com 4 propostas iniciais

Para navegar: abrir uma tela e apertar **▶ Play**. A barrinha no canto inferior direito (A · B · C) troca a estrutura na mesma tela.

---

## 3. Marca

- **Nome:** prisma (minúsculo no logotipo), fonte **Outfit 800**
- **Símbolo:** três triângulos de "play" sobrepostos (viewBox 0 0 140 120)
  ```html
  <svg viewBox="0 0 140 120" style="isolation:isolate">
    <polygon points="20,20 20,100 88,60" fill="#FF6B3D"/>
    <polygon points="38,20 38,100 106,60" fill="#F5B83D" style="mix-blend-mode:screen"/>
    <polygon points="56,20 56,100 124,60" fill="#3DD6C4" style="mix-blend-mode:screen"/>
  </svg>
  ```
  Em fundo claro: sem mistura de cores (camadas sólidas) e turquesa `#1FBFAE`, âmbar `#F2A81D`.
- **Significado:** três telas = as três estruturas do app.
- **Arquivos PNG prontos:** pasta `prisma-marca/` (dentro do .zip)
  - `logo/` horizontal (escuro, claro, transparente), vertical, símbolo
  - `android/` ícones 48–192, Play Store 512, foreground adaptativo 432, banner Android TV 320×180
  - `lg-webos/` icon 80, largeIcon 130, splash 1920×1080
  - `roku/` pôster FHD 540×405 e HD 290×218, splash FHD e HD
  - `web/` favicon 32 e 192, apple-touch 180
- As 10 propostas de logo estão em `prisma-logos/` (histórico).

---

## 4. Sistema visual v2 (tema Prisma, padrão)

### Paleta com função fixa
| Cor | Hex | Função |
|---|---|---|
| Noite | `#0B0B12` | Fundo |
| Superfície | `#15151F` / `#1E1E2A` | Cartões, painéis, menus |
| Gelo | `#F4F4F8` | Texto e **foco do controle** |
| Texto secundário | `#A6A6B8` | Legendas |
| Turquesa | `#3DD6C4` | Botões e ações principais |
| Coral | `#FF6B3D` | Ao vivo, alertas, erros |
| Âmbar | `#F5B83D` | Notas, avisos, lembretes |

### Tipografia
- Títulos: **Outfit** 700/800 (40 / 26)
- Textos: **Inter** (18 / 16). **Mínimo 16 px**; selos 14 px em caixa alta

### Regras de TV
- **Foco do controle:** borda branca 3 px + cartão 6% maior
- **Margem de segurança (1280×720):** 64 px nas laterais, 36 px em cima e embaixo
- Tecla Voltar do controle = sobe um nível
- Botões e alvos com no mínimo 44 px

### Estados desenhados (tela "Estados")
Carregando a lista (skeleton + progresso) · canal fora do ar (tentar fonte 2 / próximo canal) · lista vencida ou senha errada · título sem capa (capa automática com nome + símbolo) · canal sem guia ("Ao vivo") · busca sem resultado (sugestões)

---

## 5. As 3 estruturas (mesmo conteúdo, organização diferente)

| | A · Vidro Líquido | B · Cinema | C · Hub |
|---|---|---|---|
| Menu | Pílula flutuante no topo (vidro translúcido) | Abas de texto no topo, sublinhado turquesa | Menu lateral de ícones (96 px) |
| Início | Destaque ao vivo + card "Jogos de hoje" + prateleira com abas (Continuar / Top 10 séries / Top 10 filmes) | Destaque em tela cheia + fileira com abas Top 10 séries / Top 10 filmes / Continuar | Blocos: vídeo ao vivo, guia de jogos, continuar, Top 10 (séries/filmes) |
| Ao vivo | Painel de canais com categorias + prévia + "A seguir" | Lista sobre o vídeo + guia do canal (dias) | 3 colunas: categorias, canais, prévia + guia por dia |
| Jogos | Lista (dias, ligas) + painel da partida (onde assistir, estatísticas ou lembrete) | Partida em destaque + agenda | Ligas, dias, lista e detalhe com escalação |
| Filmes / Séries / Anime | Mesma tela com 3 seções; streamings em **Ícones** ou **Lista**; clicar num streaming abre a **arte dele na mesma tela** | idem | idem |
| Detalhe | Arte + botões + episódios por temporada | idem, estilo cinema | Pôster, ficha, trailer, episódios em números, "Você também pode gostar" |

**Telas comuns às 3:** Player único (modo ao vivo e modo filme/série), Busca (teclado na tela, filtra de verdade), Minha lista, Ajustes › Aparência.
**Celular:** usa **sempre a estrutura A** (barra de abas flutuante).

### Ajustes › Aparência
- **Estrutura:** A, B ou C
- **Tema:** Prisma, Netflix, + 4 espaços "Em breve"
- Prévia ao vivo da combinação; cada perfil guarda a sua
- Previstos no app: estrutura por perfil, atalho no botão colorido do controle (alterna A→B→C), Hub automático quando houver jogo ao vivo

---

## 6. Streamings (atalhos em Filmes/Séries/Anime)

Netflix, HBO Max, Disney+, Apple TV, Prime Video, Hulu, Globoplay, Crunchyroll.
No protótipo aparecem como nome escrito nas cores da marca; **no app, os logos oficiais virão do TMDB** (watch providers). Cada streaming tem uma arte personalizada:

| Streaming | Fundo | Destaque | Destaque 2 | Motivo da arte |
|---|---|---|---|---|
| Netflix | `#141414` | `#E50914` | `#7A0A0F` | faixas inclinadas |
| HBO Max | `#0A0A2E` | `#3D2BFF` | `#A020F0` | brilho difuso |
| Disney+ | `#0B1A3D` | `#1F80E0` | `#00D4FF` | arco de luz |
| Apple TV | `#000000` | `#8E8E93` | `#3A3A3C` | brilho difuso |
| Prime Video | `#0F171E` | `#00A8E1` | `#1A4D8F` | arco de luz |
| Hulu | `#0B0C0F` | `#1CE783` | `#0B8F52` | brilho difuso |
| Globoplay | `#1E0A12` | `#FB2E5A` | `#FF7A00` | círculos |
| Crunchyroll | `#1A1206` | `#F47521` | `#FFB000` | círculos |

**Top 10:** listas IPTV não têm ranking. Proposta: "mais vistos da semana" do **TMDB** cruzado com o que existe na lista (e/ou ranking pessoal do app).

---

## 7. Temas (só aparência, mesma estrutura e logo)

### Prisma (padrão)
Ver seção 4.

### Netflix (pronto)
| Item | Valor |
|---|---|
| Fundo | `#141414`; painéis `#1F1F1F` / `#2F2F2F`; preto `#000` em menu lateral |
| Destaque | Vermelho `#E50914` (ao vivo, progresso, selos, nome "NETFLIX" nos cartões) |
| Botões | Principal **branco com texto preto**; secundário cinza `rgba(109,109,110,0.7)` |
| Relevância | Verde `#46D369` ("98% relevante") |
| Texto | `#FFFFFF`; secundário `#B3B3B3`; inativo `#6D6D6E` / `#808080` |
| Cantos | Retos (4 px) |
| Cartões | Horizontais 16:9, título em caixa alta pesada, número grande no Top 10 |
| Foco | Borda branca 3 px + 5% maior |
| Fonte | **Inter 800/900** (substitui a fonte própria da Netflix) |
| Destaque (hero) | Arte em tela cheia esmaecendo para a esquerda e para baixo, título grande em caixa alta, selos 4K / 5.1, sinopse, elenco em itálico |

Telas no tema Netflix já desenhadas: Ajustes › Aparência, Quem está assistindo, Player, Início nas estruturas A, B e C, Ao vivo (B), Detalhe (B), Celular.

### Outros temas (feitos na 0.11.0)
HBO Max, Disney+, Prime Video, Apple TV e Globoplay estão em `src/ui/themes.ts` (cores aproximadas da identidade de cada app). Para ajustar, mandar prints do app original. Texto original da sugestão: **HBO Max, Disney+, Prime Video, Apple TV, Globoplay**. Método: pesquisar a identidade atual do app na web (ou usar prints que o usuário enviar: tela inicial, detalhe e player) e criar o tema com o nome do streaming. Para uso pessoal, nomes de streaming nos temas estão OK; se um dia o app for para loja, trocar por nomes próprios.

---

## 8. Arquitetura recomendada para a implementação (Fase 1)

Com LG webOS + Roku + Android + computador:

- **App web (React + TypeScript)** como base única para **LG webOS, computador e Android** (celular e Android TV, empacotado com Capacitor ou TWA)
  - Player: **hls.js** / Shaka Player (HLS, MPEG-TS, DASH)
  - Navegação por controle remoto (foco espacial, D-pad)
  - Dados locais: IndexedDB (listas grandes, guia/EPG)
- **Roku:** app separado em **BrightScript / SceneGraph** (instalado no modo desenvolvedor), reaproveitando o visual
- **Núcleo único:** leitura de M3U, API Xtream (Smarters/XCIPTV), EPG XMLTV, favoritos, progresso, perfis, busca
- **Interface:** componentes compartilhados (cartão, fileira, grade de guia, player) + **3 "cascas"** de navegação (estruturas A, B, C) + **temas como tokens** (cores, fontes, raios, estilo de botão e foco)
- **Metadados:** TMDB (capas, sinopse, elenco, logos de streaming, tendências)
- **Mapeamento de streaming:** pelo nome do grupo da lista (ex.: "Netflix Filmes", "Séries | HBO Max")

### Ordem sugerida da Fase 1
1. Ler a lista da Goldcard (M3U ou Xtream) e mostrar os canais
2. Player funcionando (ao vivo) no navegador e na LG
3. Guia de programação (EPG)
4. Filmes, séries e anime (VOD) + mapeamento de streamings
5. Estruturas A/B/C + temas Prisma e Netflix + Ajustes
6. Android / Android TV, depois Roku

**Pendência para começar:** o usuário precisa enviar o **link M3U** ou os **dados de acesso Xtream** (servidor, usuário, senha) da Goldcard.

---

## 8b. Fase 1 — andamento (código em `prisma-app/`)

**Feito (passos 1 e 2):** app React + TypeScript + Vite, rodando no navegador (com proxy local) e empacotável para LG webOS.
- Leitura de **Xtream** (login, vencida/senha errada, validade, telas) e **M3U/M3U8/SS IPTV** (link ou arquivo); link `get.php` vira Xtream automaticamente; canal repetido vira "fonte 2"
- **Player** único: hls.js (HLS), mpegts.js (MPEG-TS), MP4 nativo; prévia → tela cheia sem recarregar; troca de fonte automática; estado "canal fora do ar"
- **Controle remoto**: foco espacial, Voltar (461/Esc), Canal ±, números
- Telas: Adicionar lista, **Ao vivo (estrutura A)**, tela cheia, Início simples, Busca, Ajustes › Lista; demais abas "em breve"
- Guia "agora / a seguir" via API Xtream
- Testado com lista de teste local e um servidor Xtream falso (`test/fake-xtream.mjs`, usuário `teste`, senha `1234`)
- **Programa para Windows** (Electron): instalador `PRISMA-Setup-0.1.0.exe`, proxy embutido, porta interna 47815; `npm run dist:win`
- Detalhes, comandos e instalação na LG: `prisma-app/README.md`

**Endereços da Goldcard** (sem usuário/senha, que ficam só com o usuário):
| Uso | Endereço |
|---|---|
| Xtream para Smarters (recomendado no PRISMA) | `http://lvbxsmart.xyz` |
| Xtream para XCIPTV | `http://607187.sbs` (em 07/11 respondeu `nginx 502` ao PRISMA) |
| M3U / HLS | `http://607187.sbs/get.php?...&type=m3u_plus&output=mpegts` ou `output=hls` |
| SS IPTV | `http://e.zyonbr.sbs/p/<usuário>/<senha>/ssiptv` |
| DNS STB / SmartUp | `191.96.78.246` |

**Ajustes (0.2.0):** Tela (formato automático/TV/celular, tamanho 80–130%, margem de segurança) · Player (informações na tela cheia: completas/só o canal/nenhuma, tempo, formato do vídeo ajustar/preencher/esticar, formato preferido HLS/TS, abrir no último canal) · Aparência (A e Prisma; B, C e Netflix no passo 5) · Lista · Sobre (versão e diagnóstico da tela).
**Tela adaptável (0.2.0):** `src/ui/layout.ts` — área de desenho acompanha a proporção (ultrawide, 4:3, 4K), forma "celular" com abas embaixo. Testado em 9 tamanhos. Vale para Windows, TV, navegador e para o Android/Google TV futuros (mesmo código).
**Goldcard funcionando** com Xtream em `http://lvbxsmart.xyz` (07/11).

**Logotipos (0.3.0):** `src/core/logos.ts` + `public/logos/`. Prioridade: logos do usuário (`public/logos/custom/meus-logos.json`, nome do canal → arquivo) › oficiais embutidos (120 logos BR do tv-logo/tv-logos, CC BY-SA, uso pessoal) › logo da lista › iniciais. Nome comparado sem acentos, símbolos e marcas de qualidade (HD, FHD, 4K, H265, [ALT]); um logo vale para todas as versões. Ajustes › Aparência › Logotipos (oficiais primeiro / da lista primeiro).
**Ao vivo (0.3.0):** categorias em coluna vertical (TV/computador); emojis/símbolos dos nomes de categoria removidos (a estrela amarela vinha do nome da categoria da Goldcard); estrela só nos favoritos.

**Nomes curtos (0.4.0):** `src/core/names.ts` — nome do canal até a qualidade (SD/HD/FHD/UHD/4K); o resto ([ALT], [H265], FHDR…) sai. Canais ao vivo com o mesmo nome curto na mesma categoria viram um só, e as versões extras passam a ser fonte 2, 3… (`fullName` guarda o nome original, usado na busca e nos logos). Lista de canais em uma linha (sem a categoria embaixo).
**Início (0.4.0):** cards 16:9 com logo em destaque (`ChannelTile`), número do canal e selo "Último".

**Carrossel (0.5.0):** regra do Início — toda fileira usa `src/ui/Carousel.tsx`: no máximo 10 itens, só cards inteiros (calcula quantos cabem e estica para preencher), desliza com o foco do controle, setas ‹ › no mouse, arrastar no toque, indicadores de página.

**Categorias (0.6.0):** nomes sem termos de codificação (H265, HEVC, H264) — `simplifyGroups` em `src/core/names.ts`, só se não repetir nome de outra categoria. Coluna de categorias compacta (linhas de 44, uma linha só, contagem em selo, divisória fina), lista de canais com número estreito alinhado à direita.

**Ao vivo (0.7.0):** largura da coluna de categorias medida pelo nome mais longo (`catColumnWidth`, 220–360), coluna de canais nunca menor que 340 (a prévia cede espaço; "A seguir" mostra 2 cards quando a prévia fica estreita). Nomes de canais e categorias em caixa alta (CSS). Campo de busca no topo da lista de canais: filtra todos os canais por nome ou número; Enter vai para a lista; escolher categoria limpa a busca.

**Seções (0.8.0):** `src/core/sections.ts` + `src/screens/Sections.tsx`. Criar seção (coluna › "+ Nova seção"), adicionar canal a qualquer seção nativa ou criada (player › botão "Seção"), Organizar (prioridade numerada 1,2,3… com ▲▼/Topo, ou alfabética), renomear/apagar criadas. Salvo em `prisma.sections`.
**0.8.0 também:** informações da tela cheia somem no tempo certo (bug corrigido); logotipo PRISMA em caixa alta; logos com brilho na lista e no player; novo "Continuar assistindo" (logo/capa grande + programa atual); microfone (Web Speech API) nas buscas e campos — não funciona no programa de Windows (Electron não tem o serviço) nem na LG (usar o microfone do teclado da TV); Ajustes › Dados e limpeza (histórico, favoritos, seções, ordem, progresso, guia, ajustes, apagar tudo).

**Pendências / dúvidas abertas:**
- Dados da **Goldcard** (link M3U ou Xtream) para testar com a lista real
- **TV do usuário: LG OLED55B7P (2017) = webOS 3.5, Chromium 38.** O build `npm run build:webos` já foi adaptado (ES5 via Babel, CSS sem variáveis/gap/grid/inset, sem blur, player nativo da TV como última tentativa). Falta instalar na TV de verdade
- **Lista Goldcard recebida** (link `get.php` no chat — não guardar em arquivos do projeto). O ambiente de nuvem não alcança servidores `http://` comuns, então o teste com a lista real é no computador do usuário (`npm run dev`)
- **Repositório:** https://github.com/xSam10-10/prisma (privado). Downloads em *Releases*; a automação `.github/workflows/release.yml` gera o instalador de Windows e o .ipk da LG (Actions › Release › Run workflow). Numa nova conversa, peça para trabalhar nesse repositório

**Próximo:** passo 3 (guia XMLTV completo e grade por dia), depois passo 4 (VOD + TMDB).

---

## 9. Conteúdo do pacote .zip

- `PRISMA-continuidade.md` — este documento
- `prisma-app/` — código da Fase 1 (ver README)
- `prisma-marca/` — logo e ícones oficiais em PNG
- `prisma-logos/` — as 10 propostas de logo (histórico)
- `prototipo-v2/project/` — código-fonte de todas as telas do canvas oficial (arquivos `.dc.html` + `canvas.json`)
- `prototipo-v1/project/` — código-fonte do canvas antigo (histórico)

---

## 10. Próximo passo imediato (antigo — ver seção 0 e docs/PENDENCIAS.md)

1. Usuário testa a lista Goldcard no computador (`npm run dev`) e instala na TV B7 (README); trazer os erros/prints
2. Fase 1 · passo 3: guia XMLTV completo
3. Em paralelo, quando quiser: tema HBO Max no canvas v2, página "Temas"

**Início (0.9.1):** o destaque "Continuar assistindo" não tem mais o quadro grande à direita (removido a pedido); só texto, programa atual e botões.
**Filmes · Séries · Anime (0.9.0):** `src/screens/Vod.tsx`, `src/core/vod.ts`, `src/ui/VirtualGrid.tsx`. Streamings detectados pelo nome das categorias (Netflix, HBO Max, Disney+, Prime Video, Apple TV, Globoplay, Paramount+, Star+, Hulu, Crunchyroll, Discovery+) com arte própria; categorias; grade virtual de capas; busca + voz; ordenar Recentes/A–Z/Nota; detalhe (sinopse, elenco, direção, nota — via get_vod_info/get_series_info); séries com temporadas e episódios; player de filme (barra de tempo, ◀▶ 10 s, OK pausa, teclas de mídia), progresso salvo e "Continuar"; Minha lista; Início com "Filmes e séries em andamento" e "Minha lista". Anime = categorias com "anime"/Crunchyroll.
**Jogos (0.9.0):** `src/screens/Games.tsx`, `src/core/games.ts`. Partidas tiradas do guia (Xtream, 12 próximos programas) de até 80 canais de esporte; filtros Ao vivo/Hoje/Amanhã/Todos e por liga; onde assistir (todos os canais); lembrete com aviso na tela.

## 10b. Versão 0.10.0 (08/11)
- Player: reconexão automática (3 tentativas: 2 s, 4 s, 8 s; zera após 15 s estável), Áudio e legendas (hls.js e nativo), próximo episódio automático (aviso de 10 s).
- Séries de listas M3U agrupadas (S01E02, T1E2, 1x02) — `parseEpisodeName`; busca geral com canais, filmes e séries (filtros).
- Guia completo XMLTV (`src/core/xmltv.ts`, gzip via fflate; M3U url-tvg ou Xtream xmltv.php; 12 h de cache em IndexedDB; janela −3/+7 dias, na LG −1/+2) e grade (`src/screens/Guide.tsx`, botão "Guia de 7 dias" no Ao vivo).
- Voltar na programação (`src/core/catchup.ts`): Xtream timeshift no fuso do servidor; M3U catchup-source/append/shift.
- Placar ao vivo (`src/core/scores.ts`): placar público da ESPN (sem chave) cruzado pelos times; lista e painel dos Jogos.

## 10c. Versão 0.11.0 (08/11)
- TMDB (`src/core/tmdb.ts`, `src/ui/useTmdb.ts`): capas e fundos, sinopse em português, trailer (YouTube) no detalhe, Top 10 da semana no Início e em Filmes/Séries (só o que existe na lista). Chave v3 grátis em Ajustes › Serviços (themoviedb.org › Configurações › API). Cache no IndexedDB.
- Temas (`src/ui/themes.ts`): Prisma, Netflix, HBO Max, Disney+, Prime Video, Apple TV, Globoplay. Sem variáveis CSS (TV de 2017): as cores-base são trocadas direto nas regras carregadas + `<style id="prisma-theme">`.
- Estruturas: A Vidro Líquido (barra em pílula), B Cinema (abas em texto, destaque maior), C Hub (menu lateral de 96 px). No celular é sempre A. Ajustes › Aparência.
- Perfis (`src/core/profiles.ts`, `src/screens/Profiles.tsx`): "Quem está assistindo?" ao abrir; cada perfil com favoritos, histórico, seções, Minha lista, progresso, lembretes, estrutura e tema. O 1º perfil usa as chaves antigas (nada se perde). Ajustes › Perfis.

## 10d. Versão 0.12.0 (08/11)
- **Android e Google TV** (Capacitor 8, pasta `android/`, `capacitor.config.json`, `src/core/native.ts`). Build: `npm run build:android` e, no GitHub Actions, job `android` (APK `PRISMA-Android-<versão>.apk` na Release; workflow `android.yml` só testa o build). Listas, guia e TMDB pela rede nativa (CapacitorHttp, sem CORS, UA do VLC); HLS e filmes no player do aparelho (`<video>` nativo), MPEG-TS com mpegts.js; tecla Voltar do controle passa pela pilha `pushBack` (sem nada a voltar, minimiza). Google TV: `LEANBACK_LAUNCHER`, banner 320×180, sem exigir toque. Ícones, banner e splash: `python3 scripts/android-icons.py`.
- Assinatura do APK: chave de depuração fixa `android/app/prisma-debug.keystore` (senha pública "android"), para as atualizações instalarem por cima. Para usar chave própria: secrets `ANDROID_KEYSTORE_B64` e `ANDROID_KEYSTORE_PASSWORD` (alias `prisma`).
- **Lembretes com o app fechado** (Android): `@capacitor/local-notifications`, agendados 1 min antes; tocar na notificação abre o aviso com "Assistir".
- **Levar dados para outro aparelho** (`src/core/backup.ts`, Ajustes › Dados): exportar arquivo .json (favoritos, seções, Minha lista, histórico, progresso, lembretes, ajustes do perfil; sem senha da lista) e importar com "Juntar" ou "Substituir". No Android, exporta por Compartilhar. Na TV LG não há seletor de arquivos.
- **Atualização automática do Windows** (`electron-updater`, `desktop/main.mjs`): procura em `https://github.com/xSam10-10/prisma-releases/releases/latest/download` (repositório **público**, só instaladores). Para ligar: criar o repositório público `prisma-releases` e o secret `RELEASES_TOKEN` (token fino com "Contents: read and write" nesse repositório) no repositório `prisma`. Sem isso, o app só não encontra atualização.

## 10e. Versão 0.12.1 (08/11) — item 21
- **Último canal:** botão ↺ ao lado da estrela (Ao vivo) e na barra da tela cheia; tecla amarela do controle ou **L** no teclado. É o canal ao vivo anterior do histórico (vale até depois de fechar o app).
- **Zapear por número** também na tela Ao vivo (antes só em tela cheia), com teclado numérico; mostra o nome do canal enquanto digita; **OK** confirma na hora, **Voltar** cancela, sozinho em 2 s.

## 10f. Versão 0.13.0 (08/11) — barra do canal clássica e PIP (pedido do vídeo de referência)
Referência: vídeo enviado pelo usuário (app de IPTV com barra de receptor e PIP).
- **Barra do canal clássica** (`src/screens/ChannelBar.tsx`, CSS `.cbar*`), padrão em tela cheia; Ajustes › Player › Barra do canal (Clássica / Prisma). Layout: logo grande à esquerda; número + nome; "Atual:" (azul) e "próximo:"; data à direita; linha do programa + horário (início-fim); dicas "Menu info · HD · Normal · ◀▶ Seleção de funções"; fileira de ícones (o selecionado fica azul com o nome embaixo). Relógio e velocidade de download (KB/S, MB/S) no canto superior direito. Data em formato brasileiro (o vídeo usa 2015-01-01).
- Ícones: **Pip** · **Qualidade** (HD: Automática/resoluções do HLS + fontes) · **Último canal** · **Formato** (Normal/Esticar/Zoom) · **Favorito** (♥) · **Bloquear** (cadeado, senha de 4 números) — do vídeo; e mantidos do PRISMA: Áudio e legendas, Seção, Lista de canais (e ▲▼ no celular). O 7º ícone do vídeo (tela com seta) não foi identificado.
- **Menu / Info** (tecla Info da LG, Menu, "i" ou clique em "Menu info"): painel com a sinopse do programa.
- **PIP** (até 3 janelas = 4 telas; na LG 1, experimental): menu acima do ícone igual ao vídeo — "Desl/Lig", "Trocar PIP" (com várias janelas, "Trocar com …"), "Adicionar a.." (Nova janela PIP, Favoritos, Uma seção…). Janelas: 1ª embaixo à direita (acima da barra), 2ª em cima à direita, 3ª em cima à esquerda; borda branca e nome do canal no canto; sem som; clique troca com a principal; ✕ fecha. Ficam fixas ao trocar de canal; aparecem também no vídeo pequeno da tela Ao vivo. Aviso do limite de telas da assinatura (max_connections do Xtream): cada janela usa 1 conexão.
- **Bloquear canal** (`src/core/parental.ts`): canais bloqueados por perfil, senha por aparelho; desbloqueado com a senha vale até fechar o app.

## 10h. Versão 0.14.0 (08/11) — programação do canal por dia (2º vídeo de referência)
- Na lista de canais (Ao vivo), **seta →** abre o painel (`src/screens/Schedule.tsx`, dados em `src/core/schedule.ts`): coluna de dias (Hoje em destaque, ▲▼ troca o dia) e a programação do dia ao lado (→ entra, ◀ volta, Voltar fecha). OK: programa de agora = assistir; passado com gravação = assistir a gravação; futuro = agendar lembrete (no Android vira notificação). Também abre pelo botão "Programação ▸" (A seguir) e pelo ▦ ao lado da estrela (celular). Linhas da lista com ⟲ = canal que grava.
- Dias mostrados: no mínimo 3 para trás e 3 à frente (como o app de referência); estende até 7 de cada lado se a lista tiver dados ou se o canal gravar mais dias.
- **De onde vem a programação** (juntadas): (1) XMLTV completo (M3U url-tvg / Xtream xmltv.php), já baixado; (2) Xtream `get_simple_data_table` do canal, pedido ao abrir o painel (traz a marca "tem gravação"; cache de 30 min).
- **Limites (dependem do servidor, não do app):**
  - Para trás: o servidor só guarda programação passada (e vídeo) dos canais com gravação — `tv_archive_duration`, em geral 1 a 7 dias; canais sem gravação costumam ter só o dia de hoje para trás.
  - Para frente: o que o fornecedor de guia do painel carrega — tipicamente 1 a 3 dias, às vezes 7. O `get_short_epg` (usado no "agora/a seguir") traz só os próximos programas.
  - Canais sem `epg_channel_id` não têm guia (o próprio app de referência mostrou "EPG falhou" para o Telecine).
  - O XMLTV completo pode ter dezenas de MB: o app guarda −3/+7 dias (na LG B7, −1/+2 por memória); a LG compensa pedindo canal a canal (`get_simple_data_table`), sem esse limite.
  - Ajustes › Lista mostra o que a lista entregou de fato: "Guia de programação: N de M canais · DD/MM a DD/MM (x dias para trás, y à frente)" e "Gravações: N canais gravam · até X dias".
- Pendente (opcional): lista de canais por cima do vídeo em tela cheia (OK abre, como no app de referência), com o mesmo painel na seta →.

## 10i. Versão 0.15.0 (08/11) — atualizar de dentro do app
- Ajustes › Sobre › **Atualizações**: versão em uso, "Procurar atualização", novidades da versão, "Atualizar agora" com progresso, "Avisar quando houver versão nova" (confere sozinho a cada 12 h, 8 s depois de abrir, e mostra um aviso com "Atualizar"). Código: `src/core/updater.ts`, `src/screens/UpdatePanel.tsx`.
- **Manifesto**: cada Release publica `prisma-update.json` (`scripts/update-manifest.mjs`: versão do package.json + notas da seção da versão em `release-notes.md` — escrever as novidades lá antes de cada versão).
- **Windows**: `electron-updater` (feed genérico) comandado pela tela via `desktop/preload.cjs` (IPC `upd:check/download/install`); baixa, fecha, instala em silêncio e reabre. Se ninguém pedir, uma versão baixada instala ao fechar.
- **Android / Google TV**: plugin nativo `ApkInstallerPlugin.java` (registrado no MainActivity): baixa o APK (segue o redirecionamento do GitHub) e abre o instalador; na 1ª vez abre "Instalar apps desconhecidos" para o PRISMA (permissão REQUEST_INSTALL_PACKAGES, FileProvider `cache/updates`). Instala por cima porque a assinatura é sempre a mesma.
- **TV LG**: o app não pode instalar .ipk. O build da TV gera `dist-ota/prisma-webos-<v>.json` (polyfills + código, ~1,5 MB) e um **carregador** no `index.html` (`scripts/webos-pack.mjs`): se o IndexedDB tem código baixado mais novo que o instalado, abre ele (blob + SystemJS); senão o instalado. Proteção: marca `prisma.otaBoot`; se o código baixado não abrir em 25 s ou travar, recarrega e volta para o instalado, apagando o pacote. Botão "Voltar para a versão instalada". Logos/imagens novas só chegam com um .ipk novo.
- **Onde ficam os arquivos**: `https://github.com/xSam10-10/prisma-releases/releases/latest/download/` — repositório **público só com instaladores** (o `prisma` é privado e tem os endereços do servidor na documentação). Falta o usuário: (1) criar o repositório público `prisma-releases` (vazio); (2) criar um token fino com "Contents: Read and write" só nele; (3) cadastrar como secret `RELEASES_TOKEN` no repositório `prisma`. O workflow então copia tudo para lá a cada versão. Para testes: pref `updateFeed` troca o endereço; o servidor falso serve `/updates/` com `UPDATE_DIR`.
- Primeira vez: as versões instaladas antes da 0.15.0 não têm o botão — instalar a 0.15.0 manualmente uma última vez (Windows, APK e .ipk). Daí em diante, atualiza pelo app.

## 10j. Versão 0.16.0 (08/11) — fluxo Ao vivo / tela cheia do 3º vídeo de referência
- **Ao vivo**: ▲▼ na lista já toca o canal destacado no vídeo à direita (650 ms parado); OK abre a tela cheia (no celular: 1º toque toca, 2º abre). A seta → não abre mais a programação aqui; sem os botões "Programação" e "Guia de 7 dias" nesta tela.
- **Tela cheia** (`src/screens/FullList.tsx`): OK (com a barra fechada ou só informativa) abre a **lista de canais por cima do vídeo**, no grupo escolhido no Ao vivo, com o canal atual marcado (▶). ▲▼ anda (Canal +/− pula 10), OK assiste (a lista do grupo vira a ordem do ▲▼), Voltar fecha. **◀** abre o menu lateral: Buscar (campo de busca no topo), Agendar programação (lembretes por data; OK assiste se já começou ou cancela), Favoritos, Lista de canais, Guia de 7 dias (a grade antiga), e todos os grupos e seções (🔒 nos adultos); ▲▼ no menu já mostra o grupo; **▶** volta para a lista. **▶ na lista** abre a programação por dia (`SchedulePanel`) ao lado; ◀ fecha. Também abre pelo ícone "Lista de canais" da barra (útil no celular/mouse).
- Cores do painel no estilo do app de referência (azul-acinzentado translúcido, item escolhido em azul).

## 10k. Versão 0.16.1 (08/11)
- Atualizações: sem versão nova (ou canal ainda sem nenhuma versão publicada, 404) mostra "**Nenhuma atualização disponível.** Você está na versão mais nova (x)". Erro de rede: "Não deu para procurar agora…".
- Ajustes › Player › **Visual da tela cheia** (antes "Barra do canal"): Clássica / Prisma vale para a barra do canal **e** para a lista de canais da tela cheia (`FullList` `variant`). Clássica = cinza translúcido igual à barra clássica (`.flist`), Prisma = vidro escuro com as cores do tema (`.flist.prisma`, cores-base trocadas pelos temas).

## 10l. Versão 0.16.2 (08/11)
- Atualização: conferido em todas as formas. Windows (Electron com o servidor de teste): sem canal (404) e mesma versão → "Nenhuma atualização disponível"; versão nova → "Nova versão" + Atualizar. TV LG: idem + atualizar, voltar e recuperar de versão quebrada. Android: mesmo código (rede nativa) — falta testar num aparelho. O canal real `xSam10-10/prisma-releases` ainda não existe (404): por isso nada aparece até o usuário criar o repositório e o `RELEASES_TOKEN`.
- Lista em tela cheia: o menu lateral rola até o grupo escolhido (`railRef`).
- PIP: o menu do PIP fecha depois de Desl/Lig e Trocar (ele prendia ▲▼); barra (z 8) por cima das janelas.
- Tela cheia com a barra clássica: **OK sempre abre a lista**, exceto logo depois de escolher uma função com ◀▶ (`barNavRef`), como no app de referência.
- Aba **Anime** removida (as séries de anime e o Crunchyroll estão em Séries; aba salva "anime" abre Séries).
- **Logotipos dos streamings** (`public/streaming/<id>.png`, 96 px de altura, recortados do pacote do usuário: Netflix oficial; os outros 7 recriados por IA): botões só com a marca; altura de cada um calculada pela proporção para o mesmo "peso" (`logoSize`); escolhido = contorno na cor do tema. Star+, Hulu e Discovery+ seguem com texto (sem logo no pacote).

## 10m. Versão 0.16.3 (08/11)
- Início (TV/computador): destaque em duas colunas — à esquerda nome, grupo, "Agora · título", sinopse (2 linhas) e botões; à direita painel `.hero-side` com logo do canal e Agora (com progresso) · A seguir · Depois; sem guia ou filme/série: resumo da lista (canais, filmes, séries). Celular: igual antes.
- Ao vivo (TV/computador): sem o quadro "A seguir"; o vídeo ocupa a coluna da direita inteira (`liveGeometry`: altura = área disponível), com o cartão do canal por cima, embaixo.

## 10n. Versão 0.16.4 (08/11) — streamings
- Ordem (`STREAMINGS` em `src/core/vod.ts`): Netflix, HBO Max, Disney+, Apple TV, Prime Video, Paramount+, Globoplay, Star+, Discovery+, Crunchyroll, Funimation Now, Lionsgate; depois Claro Vídeo, SBT+, DirecTV GO, AMC+, Hulu. Só aparecem os que existem nas categorias da lista.
- Logotipos **brancos monocromáticos** (`public/streaming/<id>.png`, 96 px) gerados por `python3 scripts/streaming-logos.py` a partir de `scripts/streaming-src/<id>.png` (coloridos do pacote do usuário; partes brancas internas viram vazadas, ex.: montanha do Paramount+). Sem arquivo em `streaming-src`: logotipo **tipográfico provisório** (Inter) — Star+, Discovery+, Funimation, Lionsgate, Claro vídeo, SBT+, DirecTV, AMC+, Hulu. Para trocar: pôr o PNG em `scripts/streaming-src/<id>.png`, rodar o script e atualizar `logo: { w, h }` (e o ajuste óptico `k`) no `STREAMINGS`.
- Botões todos da mesma largura (164; celular 124); altura do logo entre 20 e 26 (×k, ajuste óptico por marca) e no máximo 130 de largura (`logoSize`). Escolhido: botão claro com o logo escuro.
- Carrossel (`StreamCarousel` em `Vod.tsx`): setas ‹ › quando não cabe tudo, avançando de botão em botão; pontas esmaecidas; no controle a fileira acompanha o foco; no celular arrasta.

## 10o. Versão 0.16.5 (08/11)
- Correção de diagnóstico: 404 no canal (`prisma-releases` inexistente/sem versões) agora mostra "A atualização pelo app ainda não está ativada…" (antes a 0.16.1 dizia "Nenhuma atualização disponível", o que escondia o problema). "Nenhuma atualização disponível" só quando o manifesto existe e a versão é a mesma.
- Workflow: aviso (`::warning`) em cada Release enquanto o secret `RELEASES_TOKEN` não existir.
- **Pendência do usuário (bloqueia a atualização pelo app):** criar o repositório PÚBLICO `xSam10-10/prisma-releases` **com README** (precisa de 1 commit para receber Releases), token fino só nele com Contents: Read and write, secret `RELEASES_TOKEN` no `prisma`.

## 10p. Versão 0.16.6 (08/11) — logotipos coloridos + opção branca
- Pacote completo do usuário (`logotipos-streaming-completo.zip`): 14 marcas. Para DIRECTV, Claro video, LIONSGATE+ e FunimationNow usei as versões "fundo-escuro". Fontes em `scripts/streaming-src/<id>.png` (até 320 px de altura).
- `python3 scripts/streaming-logos.py` gera `public/streaming/color/<id>.png` (padrão) e `public/streaming/mono/<id>.png` (brancos; Paramount+ com a montanha vazada), 144 px de altura. Star+, Discovery+ e Hulu (sem arquivo no pacote) = tipográfico branco nas duas.
- Ajustes › Aparência › **Logotipos dos streamings**: Coloridos (padrão) / Brancos (`settings.streamLogos`). Coloridos: botão escuro sólido, escolhido com contorno na cor do tema; Brancos: escolhido = botão claro com logo escuro.

## 10q. Versão 0.16.7 (08/11) — PIP simplificado
- A pedido do usuário (plano com 2 telas): **no máximo 1 janela PIP** (`MAX_PIPS = 1`). Menu do PIP só com **Desl/Lig** e **Trocar PIP** (este só aparece com a janela ligada). Removido "Adicionar a.." (favoritos e seção continuam nos ícones da barra). Aviso de conexões só se a assinatura permitir 1 tela. Substitui o descrito em 10f sobre até 3 janelas.

## 10r. Versão 0.16.8 (08/11) — atualização pelo próprio repositório
- O usuário decidiu tornar o `xSam10-10/prisma` **público**. O feed passou a ser `https://github.com/xSam10-10/prisma/releases/latest/download/` (`DEFAULT_FEED` em `updater.ts`, `FEED` em `desktop/main.mjs`, `build.publish` no package.json). Não há mais `prisma-releases` nem `RELEASES_TOKEN`; o workflow só avisa se o repositório estiver privado.
- Versões instaladas antes da 0.16.8 apontam para o feed antigo: instalar a 0.16.8 manualmente uma vez.

## 10s. Versão 0.17.0 (08/11) — lote TV ao vivo (24, 30, 32, 10, 33, 25, 42, 45 + Gravações)
- **24 Agora na TV** (`src/screens/NowOnTV.tsx`): menu da tela cheia › "Agora na TV" abre mosaico do grupo atual (4–5 colunas; celular 2): logo, programa de agora com progresso, horário e o seguinte. Setas, Canal +/−, OK assiste (a lista do grupo vira a ordem do ▲▼), Voltar fecha. Só desenha as linhas à vista; guia por card (`useEpg`).
- **Grupo Gravações** (menu da tela cheia, `__rec__`): canais com `catchupDays` (como "Playback" do app de referência).
- **30 Meus times** (`games.ts`: `myTeams`/`setMyTeams` por perfil, `teamsOf`, `ensureReminder`): Jogos › "☆ Escolher meus times" (sugestões: clubes populares + times do guia + campo livre); filtro "★ Meus times"; ★ nas linhas e na tabela; lembrete automático dos jogos (ao abrir Jogos e em segundo plano 20 s depois de abrir o app e a cada 2 h).
- **32 Tabela e próximos jogos** (`scores.ts`: `loadStandings` = ESPN `/apis/v2/sports/{liga}/standings`, `loadFixtures` = scoreboard `?dates=hoje-+7`): Jogos › "▦ Tabela e próximos jogos", ligas de futebol (`TABLE_LEAGUES`), grupos (Libertadores) viram várias tabelas; próximos jogos com "▶ canal" e ⏰ quando o jogo está no guia.
- **10 Estatísticas e escalações** (`loadMatchStats` = ESPN `summary?event=`): no detalhe do jogo, abas "Onde assistir · Estatísticas · Escalações"; gols/cartões (lances), posse, finalizações, no gol, escanteios, faltas, cartões; escalação com formação e reservas; ao vivo atualiza a cada minuto.
- **33 Aviso de gol** (App): acompanha o placar de todos os jogos a cada minuto desde que o app abre e avisa gols de "Meus times" (aviso na tela com "▶ Assistir"; no Android também notificação). **Só com o app aberto** — com o app fechado exigiria um servidor de notificações.
- **25 Destaques de hoje** (`src/core/highlights.ts`, Início): do guia XMLTV + jogos já lidos: jogos, filmes (Sessão da Tarde, Tela Quente, "Filme:"…) e grandes programas (Jornal Nacional, Fantástico, BBB, A Fazenda…), favoritos e FHD/4K têm preferência; até 12, misturando tipos; ao vivo → assiste; futuro → OK liga/desliga lembrete.
- **42 Guia extra** (`xmltv.ts`: `extraGuides`, pref global `epgExtra`): Ajustes › Lista › "Guia de programação extra"; o guia da lista tem prioridade, os extras só completam canais sem guia (por id/nome); status por guia ("N canais da sua lista no guia · M novos" ou "não respondeu").
- **45 Guias públicos sugeridos** (`PUBLIC_GUIDES`): epgshare01 Brasil 1 e 2, Pluto TV Brasil (i.mjh.nz) — botões de 1 clique. **Não testados daqui** (o ambiente bloqueia esses endereços).
- Fonte esportiva: ESPN (sem chave). Também não acessível daqui; tudo testado com o servidor falso (`/espn/...`, `/espn/gol` soma um gol para testar o aviso).

## 10t. Versão 0.18.0 (08/11) — Tops e recomendações, Jogos, Aparência
- **Fonte dos tops** (`scripts/tops/build-tops.mjs`, roda no GitHub Actions — o ambiente de desenvolvimento não alcança essas fontes): Netflix = ranking **oficial** semanal do Brasil (TSV aberto de top10.netflix.com, títulos em inglês traduzidos pelo TMDB); demais streamings = mais populares no TMDB com `watch_region=BR` e o provedor (HBO Max, Disney+, Apple TV, Prime Video, Paramount+, Globoplay, Crunchyroll, Discovery+, Claro, DirecTV GO, Lionsgate); Em alta na semana; Chegaram ao streaming / Séries novas; Mais aclamados; 12 gêneros de filme e 10 de série; especiais (doramas = coreano, novelas turcas, animes, nacionais). HBO/Disney/Prime não publicam ranking oficial: o rótulo diz "Mais populares no X (TMDB)". Nada de raspar sites (FlixPatrol etc.).
- **Canais**: `scripts/tops/canais.json` (ordem de popularidade + expressão comparada com `logoKey`). Editável no GitHub; também vai embutido no app (reserva offline). No aparelho (`topChannels`): + jogo/filme/grande programa passando agora (XMLTV), favoritos e vistos por último; escolhe a versão do canal vista por último › favorita › FHD/4K.
- **Publicação**: workflow `tops.yml` (cron `23 2,8,14,20 * * *`, também ao mudar `scripts/tops/**`) → Release `tops` (pré-lançamento, nunca vira "latest", então não atrapalha a atualização do app). Reativa o próprio agendamento a cada execução (o GitHub desliga agendamentos após 60 dias sem commits).
- **App** (`src/core/tops.ts`, `src/ui/useTops.ts`): baixa 12 s após abrir, guarda no IndexedDB, renova a cada 6 h (confere a cada 30 min). Sem o arquivo e com chave TMDB no aparelho: "Em alta na semana" calculado localmente. Cruzamento com a lista: nome em português, original ou inglês (sem acentos/ano/qualidade); filmes com ano ±1.
- **Filmes/Séries**: botão "🔥 Top" na fileira de streamings → coluna com as listas agrupadas (Streamings, Em alta, Especiais, Por gênero), grade com a posição original do ranking. Ao escolher um streaming, "🔥 Top 10 <streaming>" no alto das categorias. **Início**: "Top 10 canais agora" (card com posição, motivo e "Agora: programa"), "Top 10 da semana" e um Top por streaming (até 6), filmes e séries alternados. Ajustes › Serviços › "Tops e recomendações" (situação + Atualizar agora).
- **Jogos** (`loadGames`): guia rápido do Xtream de até 120 canais de esporte — primeiro os com `epg_channel_id` e marcas conhecidas (antes: os 80 primeiros da lista, o que deixava a Goldcard sem jogos) — + guia completo XMLTV de todos (também vale para M3U) + placar do dia da ESPN para jogos fora do guia, com "canais prováveis" por competição (`LIKELY`). Títulos com futebol/brasileiro/rodada/partida contam como jogo. Sem jogos: diagnóstico na tela (`gamesStats`).
- **Aparência**: Estrutura só "Menu Horizontal" (A) e "Menu Vertical" (C); B · Cinema removida (quem usava vira A). Tema padrão **Apple TV**; migração única (`settings.v18`) passa quem estava no Prisma para o Apple TV.

## 10u. Versão 0.18.1
- Filmes/Séries: fileira de streamings = os das categorias + os que têm Top com títulos da lista (`streamings` em `Vod.tsx`); streaming sem categoria própria abre direto o Top dele (`pickStream`). Botão Top sempre visível; vazio explica o `TMDB_KEY`. Motivo: as categorias de filmes da Goldcard não têm nome de streaming.

## 10v. Versão 0.19.0 — Top em carrosséis, gêneros por streaming e banner
- `src/screens/TopRows.tsx`: `StackedRows` (listas empilhadas, cada uma num `Carousel` com subtítulo = fonte; o Carousel recebe um `LayoutContext` com a largura da coluna direita; focar uma lista a alinha no alto — a 1ª deixa o banner à vista) e `StreamBanner` (cores do streaming + desenho `MOTIF`: faixas, brilho, arco ou círculos; logotipo branco em marca-d'água; brilho passando e "aurora" animados, desligados na LG pela classe `lite`; frase `TAGLINE`).
- Top: "Adicionados recentemente" (10 maiores `added`) + ordem combinada com o usuário: Chegaram ao streaming, Em alta, Aclamados (`GERAL_ORDER` em `tops.ts`), streamings na ordem de `STREAMINGS`, especiais, gêneros. Coluna: ▲▼ mostra a lista à direita, OK entra nela.
- Streaming escolhido: Top 10 dele + gêneros dele (listas `group: 'stgenero'`, id `<sid>-g<genero>-<tipo>`, até 30 candidatos do TMDB por gênero para completar 10 com o que existe na lista; só aparecem com 3+). Depois "Categorias da lista" (grade antiga).
- `VirtualGrid`: a fileira em foco fica inteira no alto (antes a de cima ficava cortada).

## 10w. Versão 0.19.1 — coluna de categorias padrão
- `src/ui/catColumn.ts` (`categoryColumnWidth(playlist.items)`): uma largura só para Ao vivo, Filmes/Séries e o menu da tela cheia (`FullList`, aberto). Mede o nome mais longo de todas as categorias da lista (canais, filmes, séries) e dos rótulos fixos (Tops, "Todos · <streaming>"…), +6% de folga, selo de contagem com milhar; entre 260 e 420. Acima disso o nome quebra em 2 linhas (`.cat-name` com line-clamp; `.cat` com min-height 44) — nunca reticências.

## 10x. Versão 0.19.2 — Início por streaming e navegação
- `homeShelves`: por streaming, "Top 10 Filmes <X>" e embaixo "Top 10 Séries <X>" (cada um com 4+ títulos da lista; até 6 streamings). "Top 10 da semana" continua misturado.
- Filmes/Séries: chip 🔥 Top antes de Todos.
- Navegação (`nav.ts`): `data-nav-row` no `.carousel-view` prende ◀ ▶ na fileira (nas pontas não faz nada); ▲▼ procuram primeiro dentro do `.scroll-y` atual (antes, uma fileira rolada para baixo do cabeçalho perdia para os botões do topo). `Carousel` › `revealSection`: ao focar um card, rola até a fileira inteira caber (título + card crescido). Testado com roteiro de teclado (descer/subir a página toda, ◀ ▶ em fileira de 10 com deslize, diagonal).

## 10y. Versão 0.19.3 — Filmes/Séries sem coluna no Top e nos streamings
- Top e streaming: sem coluna (`noLeft`); `StackedRows` ocupa a largura toda. Streaming: banner, Top 10, gêneros (`stgenero`) e, no fim, `tail` = seção da altura da tela com "Todos · <streaming>", chips de categoria/ordenação e a `VirtualGrid` (ao focar, a página encaixa nela; ▲ na 1ª fileira volta aos carrosséis). "Todos": coluna + grade, como antes; a coluna escolhe a categoria no foco.
- `nav.ts`: `data-nav-stop="left"` (colunas de categorias de Filmes/Séries e Ao vivo: ◀ na borda fica parado); ▲▼ excluem a própria fileira (`data-nav-row`) e vão para a fileira mais próxima, na capa mais perto. `VirtualGrid`: ▶ e ▼ nas bordas ficam parados (só ◀ e ▲ saem). Detalhe devolve o foco para a capa de onde abriu.
- Roteiro de teste por teclado (`vnav.mjs` no scratchpad da sessão): Top/streaming/Todos em Filmes e Séries, Início e Ao vivo.

## 10z. Versão 0.19.4
- Tops: listas `group: 'stall'` (`<sid>-all-<tipo>`, os 200 mais populares de cada streaming no Brasil, itens só com t/o/y). `streamCatalog()` junta catálogo + Top 10 + gêneros do streaming cruzados com a lista: é o "Todos · <streaming>" quando as categorias da lista não dizem o streaming (Filmes da Goldcard). Subtítulo avisa "que estão no X (TMDB)".
- `StackedRows`: foco saindo da página para cima (busca, fileira de streamings) volta a rolagem ao início (banner inteiro).
- Chips: Todos (padrão) antes de 🔥 Top.

## 10aa. Versão 0.19.5
- Coluna/chips de categorias (Filmes e Séries): Todos › categorias com "lançamento" no nome › "Últimos adicionados" (categoria especial `__recentes__`, 100 maiores `added`) › demais. Vale também nos chips da página do streaming.

## 10ab. Versão 0.19.6
- Séries › página do streaming: sem os chips de categoria acima da grade (pedido do usuário); em Filmes eles continuam.

## 10ac. Versão 0.20.0 — visual premium (16 sugestões de design)
- `src/ui/premium.tsx`: `setPreview`/`PreviewBackdrop` (fundo com a arte larga do título em foco, fade cruzado; montado no Início e em Filmes/Séries; capas chamam no foco, a grade no `onIndex`), `badgesOf` (NOVO ≤7 dias, 4K, DUB/LEG pelo nome/categoria), `RankedCard` (número com contorno feito por text-shadow — o text-stroke mostrava sobreposições da fonte), `WideCard` (Continuar assistindo 16:9), `TitleLogo` (logo do TMDB `/images`), `FeatureRow` (Destaque da semana: 1 grande + 2 médios, `data-nav-row`), `SkeletonRow`.
- `tmdb.ts`: `logoOf`, `castOf` (credits/aggregate_credits), `similarOf` (recommendations, cruzado com a lista por `findInList`).
- Detalhe (`VodDetail`): página que rola (`.vd-scroll`), fundo em tela cheia, logo, pílulas (nota, ano, duração, gênero, selos), episódios com miniatura/sinopse/barra (linha de 112), Elenco com foto e Semelhantes (carrosséis; "Semelhantes" troca o título na mesma tela).
- Início: Hero com arte (TMDB) + logo quando o último visto é filme/série; Top 10 com `RankedCard` em sequência 1..n (também em Filmes/Séries; listas "geral" sem número); canais (`ChannelTile` `image`/`progress`; XMLTV agora lê `<icon src>` → `EpgEntry.image`).
- `StackedRows`: banner fixo fora da rolagem, encolhe (`compact`) ao descer e só volta ao subir para a busca.
- Transições `.screen-in` (abas, página do streaming, detalhe); contadores das categorias só na escolhida/em foco; tema Apple TV: `html[data-theme="apple"]` com foco elevado, brilho diagonal, cantos maiores, vidro no menu (não na LG: `.lite`).
- Perfis: `src/ui/Avatar.tsx` (8 ilustrações SVG; botão "Avatar" em Ajustes › Perfis), `lastWatchedOf` (último título por perfil).
- Correção: `StreamCarousel` gravava estado a cada desenho (laço infinito de renderização).
- Servidor falso: TMDB `/images`, `/credits`, `/recommendations`, imagens variadas e `<icon>` no XMLTV.

## 10ad. Versão 0.21.0 — visual premium II (18 sugestões)
- `src/ui/premium2.tsx`: `TrailerLayer` (YouTube nocookie mudo, sem controles, após 3–3,5 s de foco, some em 60 s; fora na LG e no celular), `PosterTile` (capa de carrossel: prévia de fundo + card largo `Peek` após 1,8 s de foco, abre para o lado que cabe), `dominantColor`/`useDominantColor` (canvas 12×12, imagens com CORS — TMDB), `GenreCard`, `CollectionCard`, `EmptyState`, `toast`/`celebrate`/`Toasts` (classes `.ptoast*`, pois `.toast` já existia), `pop`, `Splash`, `setHomeScrolled`/`useHomeScrolled`. `src/ui/sound.ts`: `navSound` (WebAudio; `settings.navSounds`; chamado em `focusEl` e no OK).
- Player: `.vod-osd` (pausa com `PausedInfo`: logo/episódio/sinopse; barra fina que engrossa `.vod-seek.big`; botões `.pbtn`), anel SVG do próximo episódio, confete no fim de temporada/série. Ao vivo: `osdStyle: 'card'` → `NowCard` (`.livecard`; `.now-card` já era do Agora na TV); OK/Menu continuam como na Clássica.
- Coleções: gerador (`build-tops.mjs`) consulta `/movie/{id}` dos filmes das listas (até 300) → `belongs_to_collection` → `/collection/{id}` (até 40) → listas `group: 'colecao'` com `b` (arte). App: `collectionsIn`, `CollectionView` (Vod.tsx), fileiras no Início e no Top de Filmes. `StackedRows` aceita fileiras de cards (`Row.cards`) e marca `data-row-id`.
- Início: "Porque você assistiu…" (`similarOf` do último visto), "Para assistir hoje à noite" (`tonightPicks`, 19h–meia-noite), menu transparente no alto (`.top.at-top`), trailer no Hero (foco no destaque).
- Jogos: ESPN `team.logo`/`team.color` → `MatchHero` (escudos, degradê nas cores, minuto pulsando, gols na linha do tempo via `loadMatchStats`). Guia: `.guide-now` com brilho e horário, programa ao vivo com imagem (`EpgEntry.image`) e barra.
- CSS: respiração do foco (`breathe`, `breatheApple`), inclinação com mouse (App, `.tilt-art`), títulos editoriais no `Carousel`. Regras de imagem de capa restritas a filhos diretos (`.peek > img` etc.) — antes pegavam a logo do título.

## 10ae. Versão 0.22.0 — visual premium III (11 sugestões; a 11ª, Perfil Kids, ficou de fora a pedido)
- `src/ui/premium3.tsx`: `dayPart`/`DAYPART` (manhã 5–12, tarde 12–18, noite 18–24, madrugada; saudação, cor, ordem das fileiras via `order` no Início em flex-column), `takeResumeOnce` + `ResumeOpen` (só na 1ª montagem do Início na sessão, se `lastKind === 'vod'`), `LivePeek`/`useLivePeek` (Engine mudo no card após 2 s de foco; só com `html.kbd`, fora em `lite`/`mobile`; usa 1 das 2 telas do plano enquanto aparece), `UpcomingCard`, `CinemaIntro` (1,7 s), `Screensaver` (5 min pausado; Ken Burns, relógio), `EndCredits` (filme > 10 min, faltando < max(2 min, 4%), sem próximo episódio; vídeo encolhe para o canto via `.player.credits video`), `SeekThumb`.
- `src/core/tmdb.ts`: `personOf` (/person + combined_credits), `scenesOf` (/images backdrops w300), `ratingOf` (release_dates/content_ratings BR), `nextEpisodeOf` (next_episode_to_air); `castOf` agora traz `id` (aggregate_credits nas séries).
- Vod.tsx: `CertBadge`, `ActorView` (OK no elenco), barra da temporada (vistos x de y, marcar/desmarcar), ✓ nos episódios. `vod.ts`: `watchedIds`/`isWatched`/`setWatched` (pref `watched`, por perfil; > 95% marca sozinho).
- Gerador dos Tops: bloco 7a `estreias-movie`/`estreias-tv` (discover −2…+8 dias, itens com `d` data e `p` pôster); app: `upcomingOf` + próximos episódios das séries vistas → "Chegando esta semana".
- Tema `oled` em `themes.ts`. Player: `useLayoutEffect` do `barH` só faz setState quando muda (antes laço "Maximum update depth" nos filmes).
- Servidor falso: /person, release_dates, content_ratings, /tv/{id} com próximo episódio, elenco com `id`, discover com datas.

## 10af. Versão 0.23.0 — visual premium IV (rodada 4: aprovados 2, 4, 5, 6, 10, 12, 13; o resto descartado)
- Busca (`Search` em Other.tsx): teclado em grade `.sk-*` (foco inicial na tecla A; teclado físico digita direto), resultados em `Carousel` com `LayoutContext` da coluna da direita; `genreMatches`/`SEARCH_GENRES` (tops.ts: listas genero/stgenero + categorias com o nome), `searchPerson` (tmdb.ts) + `personOf` → fileira "Na sua lista". ◀ na 1ª capa volta ao teclado; `data-nav-stop="down"` nas duas colunas. nav.ts: no bloco `data-nav-stop`, ▲▼ ignoram a própria fileira.
- `src/ui/premium4.tsx`: `ZoomFrom` (listener de clique em captura guarda o retângulo da `.poster-art`; o detalhe aberto em < 900 ms cresce a partir dele; fora em `lite`), `StillWatching`.
- `src/core/newEpisodes.ts`: mapa de episódios novos (último episódio nos últimos 7 dias, `episodesOf` no TMDB) calculado no Início para até 10 séries (vistas + Minha lista); selo `newep` em `badgesOf`; "Me avise" (pref `epAlerts`, por perfil) → aviso no Início quando a data chega (`takeDueAlerts`).
- Coleção: `Collection.chrono` (tabela `CHRONO` com ids do TMDB de Star Wars e X-Men), barra de maratona, `onPlay(next, pos, fila)`.
- Player: `autoEps` conta próximos episódios automáticos; qualquer tecla/clique zera; no 4º automático mostra `StillWatching`.
- `src/screens/GameDay.tsx`: Meus times + `loadGames` (3,5 s depois de abrir o Início) + `loadScores` a cada minuto; faixa compacta.
- Guia: cabeçalho de 204 px com arte (EPG ou TMDB filtrando telejornal/esporte), sinopse em 3 linhas, barra "termina em".
- Correções: detalhe/coleção do Início renderizados fora da área rolável (antes cortavam com o Início rolado); polyfill de `Element.closest` em main.tsx (Chrome 38).

## 10ag. Versão 0.24.0 — pendências [1º] de todas as categorias
- Proteção (`core/parental.ts`): `lockedCats` (pref, por perfil; sem lista salva = categorias com nome de adulto), `hiddenCats`, `hiddenChannels`, `applyParental(pl)` — o App guarda `fullPlaylist` e entrega a todas as telas a lista filtrada (Ajustes recebe a completa); `onParental` avisa mudanças; `closedCats()` alimenta "🔒 Protegidas" no Ao vivo. Tela `screens/Protection.tsx`. Barra do canal: ação "Esconder".
- Player: "Do início" (`startOverItem` em catchup.ts: timeshift do programa no ar, canal com `catchupDays`); `trackPref` (pref por perfil, chave `seriesId ?? id`, guarda o rótulo do áudio/legenda e reaplica no 1º `tracks`).
- Filmes/Séries (`core/vod.ts`): `versionKey`/`versionLabel`/`versionsOf`/`collapseVersions` (grade e busca mostram uma capa; chips "Versões" no detalhe trocam o item); `nextToWatch` (meio do episódio > seguinte ao último visto > 1º não visto; o detalhe abre nessa temporada); `removeFromContinue` + card "Tirar títulos daqui" e janela no Início; "Marcar como visto" (filme) e "Série toda vista".
- Busca tolerante (`core/fuzzy.ts`, até 1/2 erros por palavra com 5+/7+ letras; só quando a busca exata traz < 8) e `searchTitles` (TMDB /search/multi → `findInList`, fileira "Pelo nome em outro idioma").
- Geral: `core/sources.ts` (listas usadas, até 8, sem conteúdo de arquivo M3U) + `switchSource` no App; `screens/Subscription.tsx` (cartão com dias, telas em uso via `login()`, aviso no Início ≤ 7 dias, 1×/dia).
- Testes novos: test/catchup.test.ts, test/nextep.test.ts (55 no total). Servidor falso: categoria "ADULTOS +18", versões LEG/4K de "Rota 66".

## 10ah. Versão 0.24.1
- `FeatureCard`: foco com `scale(1.015)` no grande e 1.03 nos pequenos, sem "respiração" (antes 1.08–1.1 invadia os vizinhos); sem `backdrop` do TMDB usa `tm.poster || item.logo` (fundo desfocado + capa à direita no grande).

## 10ai. Versão 0.24.2
- `audioTag` (vod.ts) usado por `badgesOf` e `versionLabel`: nome e depois categoria; `versionLabels` acrescenta a categoria quando dois rótulos empatam. Se a Goldcard marcar o áudio de outro jeito, pedir ao Samuel exemplos de nomes.
- Início: `onFocusCapture` no rolável zera o scroll quando o foco entra em `[data-home-top]` (Dia de jogo e destaque).

## 10aj. Versão 0.24.3
- `Carousel` ganhou `onAll` (botão "Ver todos · N" no título, só quando há mais de uma página). Na busca abre `allView`: grade com todos os resultados da fileira, foco na 1ª capa, Voltar (pushBack) fecha.

## 10ak. Versão 0.24.4 — canais sumidos (categoria adulta da Goldcard com < 100 de 100+)
- Causa: `tidyPlaylist` juntava canais ao vivo pelo nome curto (`simplifyName` corta na qualidade e tirava "(1)"), fundindo canais numerados. Agora a chave é `sameChannelKey(nome completo)` (names.ts), que só ignora marcas de fonte reserva/codec; `simplifyName` mantém a numeração.
- `category_ids` (XUI): o canal entra em cada categoria; cópias com id `l<stream>@<cat>` (catchup/EPG tiram o sufixo); "Todos" e buscas ignoram as cópias.

## 10al. Versão 0.24.5 — nada cortado ao navegar
- Ajustes: seções numa coluna `scroll-y` (`.sec-col`). Carousel: 8 px a mais de folga vertical (padding + margem negativa) para a capa em foco não ser cortada.
- **`test/scan-foco.mjs`**: varredura que anda com as setas em todas as telas e acusa item em foco fora da tela ou cortado por um contêiner. Rodar em 2000x800 e 1280x720 antes de publicar mudanças de layout (0 problemas na 0.24.5).

## 10am. Versão 0.25.0 — centro de esportes (etapa 1)
- Respostas do Samuel ("pode fazer", 10/11, aceitando as sugestões): ordem Brasileirão, Libertadores, Copa do Brasil, Sul-Americana, Champions, Inglês, Espanhol, Italiano, Alemão, Francês; Brasileirão incluído; F1 terá "semana do GP" no Início (etapa 2); por enquanto só dados, sem manchetes.
- **Dados:** a ESPN recusa intervalo de datas no scoreboard (`?dates=A-B` → 400; a antiga "Tabela e próximos jogos" quebrou por isso e foi removida). Só `?dates=AAAA&limit=1000` traz a temporada — 1 a 5 MB por liga, por isso o gerador no GitHub. Temporada: ano civil (Brasil/Conmebol) ou julho→junho (Europa). Copas guardam a fase (`season.slug`), ligas a rodada.
- **Rodadas:** a ESPN não informa. `assignRounds` agrupa por período (> 30 h sem jogo separa), junta meia rodada antes de pausa, devolve jogo adiado à primeira rodada em que os dois times faltaram e limita a 2 × (times − 1). Conferido com dados reais: Inglês/Italiano/Alemão/Francês exatos, Brasileirão 38 rodadas com a próxima = 35 (algumas rodadas antigas com 9/11 jogos por causa da pausa da Copa).
- **Tela:** `src/screens/Sports.tsx` (hub, página do campeonato, linhas/cartões) + `src/sports.css`; `src/core/sports.ts` (formato compacto, rodadas/fases, chaves, destaques). `Games.tsx`: visão `hub` (padrão), `guia` (lista antiga) ou id do campeonato; o jogo do calendário acha canal/lembrete no guia (`scoreFor`) e, sem guia, usa canais prováveis (`likelyChannels`).
- Servidor falso: `/tops/prisma-sports.json` (calendário inventado; `SPORTS_FILE=` serve um arquivo real). `scan-foco` cobre hub, uma liga e uma copa (todas as seções) e o guia; 0 problemas em 1280x720 e 2000x800. `CHROME=` aponta outro Chromium (no PC do Samuel: Edge). Correção junto: o detalhe do jogo agora rola inteiro (na TV a lista "Onde assistir" ficava com 27 px quando havia placar com escudos).

## 10an. Versão 0.26.0 — Fórmula 1, destaques e placar na tela (etapas 2 e 3)
- **F1** (`src/screens/F1.tsx`): Jolpica no gerador (`f1Compact`: calendário com sessões TL1/TL2/TL3/QS/SPR/CLA/GP, vencedores por rodada, pilotos, equipes, último GP top 10). App: `f1Of`, `nextRace`, `raceWeek` (7 dias antes do TL1 até 3 h depois da corrida), `gpName` (nomes em português), cores das equipes inspiradas (`teamColor`). Página com Próximo GP (OK na sessão liga/desliga lembrete; ao vivo abre o canal), Pilotos, Equipes, Último GP (pódio), Calendário. Canal: guia (título com Fórmula 1/F1/GP, ±75 min) ou provável (`LIKELY`: Globo/SporTV/Band). Lembretes com chave `f1|temporada|rodada|sessão`.
- **Semana do GP** no Início (`RaceWeek`, abaixo do Dia de jogo); "Ver o fim de semana" abre Jogos › F1 (`openSportsView`/`takeSportsView`).
- **Etapa 3**: ESPN `/soccer/<liga>/statistics` (goalsLeaders/assistsLeaders) → `sc`/`as` no arquivo; seção Destaques (sequências atuais por `streaksOf`, artilheiros, assistências); forma dos últimos 5 na tabela (`formOf`); tile Artilheiro na visão geral.
- **Placar flutuante** (`src/ui/ScoreBug.tsx`): em tela cheia, canto superior direito; jogos fixados (`pinnedScores`, máx. 2, somem 4 h depois do início; botão "📌 Mostrar placar na tela" no detalhe do jogo) + Meus times ao vivo; pisca no gol.
- Correção: o cache decodificado do calendário (`leaguesOf`) ficava vazio se a F1 do Início carregasse o arquivo antes da aba Jogos — agora é por arquivo.
- Servidor falso: F1 inventada (GP de Las Vegas em 4 dias, semana do GP ativa), artilheiros e logotipos das ligas (`/liga/<id>.svg`).

## 10ao. Versão 0.27.0 — visual de cada streaming (item 51)
- Pedido do Samuel após o esboço (10/11): "faça todos". Em Filmes/Séries/Anime, `VodScreen` chama `applyStreamSkin(st)` ao escolher um streaming e `applyStreamSkin(null)` ao sair/desmontar (`src/ui/themes.ts`).
- `skinTheme(s)`: Netflix, HBO Max, Disney+, Prime Video, Apple TV e Globoplay usam o tema próprio já existente; os demais ganham tema montado das cores de `STREAMINGS` (bg, accent, accent2; destaque escuro é clareado; texto do botão escuro/claro pela luminância; cantos retos em Claro, AMC+, Lionsgate, DirecTV). O tema do usuário fica em `setBaseTheme` (App) e volta ao sair.
- Ajuste `streamSkin` (padrão ligado) em Ajustes › Aparência › "Visual de cada streaming". Testes em `test/skin.test.ts`; `scan-foco` passa por dentro de um streaming.

## 10g. Sugestões guardadas para a sequência (ordem combinada em 08/11) — HISTÓRICO; a lista atual é docs/PENDENCIAS.md
**Fazer primeiro:** 7 controle parental (PIN em categorias +18, perfil infantil — o bloqueio por canal já existe) · 15 começar do início · 24 "Agora na TV" (mosaico) · 30 "Meus times" · 38 várias listas · 39 painel da assinatura · 41 esconder canais/categorias · 48 fileiras automáticas · 53 logo do título no detalhe · 54 classificação e selos · 57 versões num só card · 61 episódios com miniatura · 62 marcar assistido · 64 abrir no próximo episódio · 70 lembrar áudio/legenda por série · 76 remover de Continuar assistindo · 81 busca tolerante.
**Depois:** 8 qualidade (parcial na 0.13.0, menu HD) · 11 ExoPlayer no Android · 12 voz no Android · 17 multitela em grade (o PIP da 0.13.0 cobre parte) · 18 picture-in-picture do sistema · 31 placar flutuante · 32 tabela do campeonato · 44 onde assistir · 46 trailer no destaque · 47 prévia no pôster · 49 "porque você assistiu" · 50 franquias · 52 novidades e em breve · 55 semelhantes · 63 aviso de novo episódio · 65 pular abertura · 68 velocidade · 69 estilo de legenda / .srt · 75 histórico de assistidos · 80 filtros de busca.
**Projetos maiores:** 9 sincronização na nuvem · 14 Roku · 19 gravar · 20 baixar offline · 23 Chromecast · 59 IMDb/Rotten · 67 miniaturas na barra · 72 créditos finais · 79 assistir junto.
**Talvez não:** 51, 58, 66, 71, 74, 77, 82. **Sem prioridade:** 10, 16, 25, 28, 33, 34, 35, 36, 37, 40, 42, 43, 45.
**Depende do usuário:** 1 testar na LG · 2 testar o APK · 3 "0 filmes" · 4 logos · 5 chave TMDB · 6 repositório público + token · 13 assinatura paga.

## 11. Pendências (07–08/11/2026) — HISTÓRICO; a lista atual é docs/PENDENCIAS.md

**Precisa de você / testes reais**
1. Instalar e testar na TV LG OLED B7 (webOS 3.5) — nunca rodou numa B7 de verdade.
2. Goldcard mostrou "0 filmes": conferir na 0.9.0 (o tempo de espera da lista de filmes subiu para 4 min) e, se continuar, mandar print.
3. Enviar logos que faltam (ex.: ESPN) — `public/logos/custom/`.
4. Microfone: funciona no navegador (Chrome/Edge) e no Chrome do celular — dentro do app Android não (WebView sem reconhecimento de voz; ver sugestão 12); no programa de Windows não (o Electron não tem o serviço de voz do Google); na LG, usar o microfone do teclado da TV.

**Funcionalidades**
5. ✅ (0.10.0) Guia completo XMLTV (listas M3U) e grade de 7 dias; "voltar na programação" (catch-up) quando a lista oferece.
6. ✅ (0.10.0) Placar ao vivo (ESPN, sem chave). Estatísticas detalhadas: pendente.
7. ✅ (0.11.0) TMDB: capas/fundos melhores, trailers, "Top 10 da semana" — precisa de chave TMDB.
8. ✅ (0.11.0) Estruturas B (Cinema) e C (Hub), tema Netflix (já desenhado) e outros temas; Perfis ("Quem está assistindo"), estrutura por perfil, atalho no botão colorido.
9. Controle parental: esconder categorias adultas com PIN (a Goldcard tem "ADULTOS +18").
10. ✅ (0.10.0, exceto qualidade) Player: próximo episódio automático, escolha de áudio/legenda e qualidade; reconectar sozinho quando o canal cai.
11. ✅ (0.10.0) Séries em listas M3U (agrupar episódios soltos por nome) e busca geral incluindo filmes/séries.
12. ✅ (0.12.0, Android) Lembretes de jogos só avisam com o app aberto (notificação do sistema virá com o app Android).
13. ◐ (0.12.0: exportar/importar arquivo) Sincronizar favoritos/seções/Minha lista entre aparelhos (hoje ficam em cada aparelho).

**Plataformas e distribuição**
14. ✅ (0.12.0; Roku pendente) Android (celular) e Google TV / Android TV com Capacitor (voz e notificações nativas); Roku depois.
15. Assinatura digital do instalador de Windows (tira o aviso "O Windows protegeu…"): precisa de certificado pago (Azure Trusted Signing ~US$ 10/mês, ou certificado OV ~US$ 200/ano). Atualização automática: ✅ código pronto na 0.12.0, falta o repositório público + `RELEASES_TOKEN`.
16. Etiquetas de versão (tags) no GitHub: esta sessão não consegue criar; as Releases saem com a data no nome.
17. Sincronização automática de verdade (sem arquivo): precisa de um serviço na nuvem com login (ex.: Supabase ou Firebase, grátis para uso pessoal) — decidir qual.
18. Android: player nativo é o `<video>` do WebView (sem escolha de áudio/legenda). Se algum canal travar no celular, trocar por ExoPlayer (plugin nativo).
19. Roku: app à parte em BrightScript/SceneGraph (não reaproveita o código web).
