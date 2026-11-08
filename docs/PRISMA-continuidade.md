# PRISMA — documento de continuidade do projeto

> O código está em https://github.com/xSam10-10/prisma (pasta docs/ tem este arquivo).
> Cole este arquivo (ou o conteúdo dele) no início da nova conversa e diga:
> "Este é o projeto PRISMA. Leia tudo e continue de onde paramos."

Atualizado em: 07/11/2026 (Fase 1 iniciada)

---

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

### Próximos temas (pendente)
Sugeridos: **HBO Max, Disney+, Prime Video, Apple TV, Globoplay**. Método: pesquisar a identidade atual do app na web (ou usar prints que o usuário enviar: tela inicial, detalhe e player) e criar o tema com o nome do streaming. Para uso pessoal, nomes de streaming nos temas estão OK; se um dia o app for para loja, trocar por nomes próprios.

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

## 10. Próximo passo imediato

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

## 11. Pendências (07–08/11/2026)

**Precisa de você / testes reais**
1. Instalar e testar na TV LG OLED B7 (webOS 3.5) — nunca rodou numa B7 de verdade.
2. Goldcard mostrou "0 filmes": conferir na 0.9.0 (o tempo de espera da lista de filmes subiu para 4 min) e, se continuar, mandar print.
3. Enviar logos que faltam (ex.: ESPN) — `public/logos/custom/`.
4. Microfone: funciona no navegador (Chrome/Edge) e no Android; no programa de Windows não (o Electron não tem o serviço de voz do Google); na LG, usar o microfone do teclado da TV.

**Funcionalidades**
5. Guia completo XMLTV (listas M3U) e grade de 7 dias; "voltar na programação" (catch-up) quando a lista oferece.
6. Placar ao vivo e estatísticas nos Jogos — precisa de um serviço esportivo (ex.: API-Football, TheSportsDB) com chave.
7. TMDB: capas/fundos melhores, trailers, "Top 10 da semana" — precisa de chave TMDB.
8. Estruturas B (Cinema) e C (Hub), tema Netflix (já desenhado) e outros temas; Perfis ("Quem está assistindo"), estrutura por perfil, atalho no botão colorido.
9. Controle parental: esconder categorias adultas com PIN (a Goldcard tem "ADULTOS +18").
10. Player: próximo episódio automático, escolha de áudio/legenda e qualidade; reconectar sozinho quando o canal cai.
11. Séries em listas M3U (agrupar episódios soltos por nome) e busca geral incluindo filmes/séries.
12. Lembretes de jogos só avisam com o app aberto (notificação do sistema virá com o app Android).
13. Sincronizar favoritos/seções/Minha lista entre aparelhos (hoje ficam em cada aparelho).

**Plataformas e distribuição**
14. Android (celular) e Google TV / Android TV com Capacitor (voz e notificações nativas); Roku depois.
15. Assinatura digital do instalador de Windows (tira o aviso "O Windows protegeu…") e atualização automática.
16. Etiquetas de versão (tags) no GitHub: esta sessão não consegue criar; as Releases saem com a data no nome.
