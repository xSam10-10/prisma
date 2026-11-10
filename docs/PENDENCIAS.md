# PRISMA — Melhorias pendentes (atualizado em 10/11/2026, versão 0.26.0)

Números = os da lista original de sugestões (seções A–D). Prioridade combinada com o Samuel:
**[1º]** fazer primeiro · **[Depois]** · **[Grande]** projeto maior · **[Talvez]** talvez não valha · **[Sem prior.]** sem prioridade definida.

Já feito desde a lista original (não repetir): 8 qualidade (ícone HD), 21 último canal + zapear por número,
24 Agora na TV, 25 destaques do dia, 30 meus times, 32 tabela/próximos jogos, 10 estatísticas/escalações,
33 aviso de gol (app aberto), 42 guia extra, 45 guias públicos sugeridos, grupo Gravações,
PIP (1 janela, Desl/Lig + Trocar), barra clássica, lista em tela cheia com menu e programação por dia,
atualização dentro do app, logotipos dos streamings (coloridos + brancos), bloquear canal com senha,
48 fileiras automáticas (parcial: Tops por streaming/gênero/especiais e Adicionados recentemente, 0.18–0.19),
Top 10 canais agora, banner por streaming, coluna de categorias padrão, navegação dos carrosséis revisada (0.19.x),
visual premium 0.20.0: 47 prévia no foco (fundo com a arte), 53 logo do título, 54 selos 4K/DUB/LEG/NOVO (falta classificação indicativa),
55 Semelhantes, 61 episódios com miniatura e sinopse (falta marcar visto), 34 avatar ilustrado (falta PIN por perfil),
visual premium II 0.21.0: 46 trailer no destaque, 49 "Porque você assistiu", 50 coleções/sagas, 31 (parcial: placar com escudos no detalhe do jogo).
visual premium III 0.22.0: 28 página do ator, 52 novidades/em breve ("Chegando esta semana"), 54 classificação indicativa, 62 marcar assistido (episódio/temporada), 67 miniaturas na barra (cenas do TMDB, não do vídeo), 72 créditos finais, 71 informações na pausa, tema OLED, protetor de tela, retomar ao abrir, prévia ao vivo nos cards.
visual premium IV 0.23.0: 66 "Ainda está assistindo?", 63 aviso de novo episódio (selo + "Me avise"), busca nova (teclado em grade, ator, gênero), maratona de coleção, Dia de jogo no Início, guia com arte do programa, capa que cresce até o detalhe.
pendências [1º] 0.24.0: 7 controle parental (senha para categorias +18 e qualquer categoria; o perfil infantil ficou de fora junto com o Perfil Kids descartado), 41 esconder canais e categorias, 15 começar do início, 70 lembrar áudio/legenda, 57 versões num só card, 62 marcar filme/série como visto, 64 série abre no próximo episódio, 76 tirar de Continuar assistindo, 81 busca tolerante, 38 várias listas, 39 painel da assinatura. (48, 53, 54 e 61 já estavam feitas.)

**Sugestões de design premium descartadas pelo Samuel (09/11) — não oferecer de novo:** Perfil Kids (rodada 3, nº 11); da rodada 4: Quem está assistindo? em tela cheia, Retrospectiva do mês, Trailer em tela cheia com som, Modo ambiente (Ambilight), Pular abertura/recapitulação como item de design, Legendas premium. (Os itens 65 Pular abertura e 69 Estilo da legenda da lista original continuam na lista abaixo.)
centro de esportes 0.25.0–0.26.0: hub de Jogos, página de cada campeonato (calendário, tabela, chaves, times, destaques com artilheiros/assistências/sequências, forma dos últimos 5), Fórmula 1 completa, Semana do GP no Início, 31 placar flutuante em tela cheia.

Itens conferidos no código em 10/11: "parcial" = já existe uma parte. Organizado nas seções pedidas pelo Samuel.

## 1. Filmes e Séries
- **80 · Filtros por gênero, ano, nota e idioma** [Depois] — parcial: já ordena (recentes, A–Z, nota) e tem cartões de gênero; falta filtrar por ano e idioma.
- **75 · Histórico de assistidos** (tela com tudo o que já viu) [Depois].
- **44 · "Onde assistir" nos streamings oficiais** [Depois].
- **65 · Pular abertura e recapitulação** [Depois].
- **68 · Velocidade de reprodução** (0,75× a 1,5×) [Depois].
- **69 · Estilo da legenda** (tamanho, cor, fundo) e legenda externa .srt [Depois].
- **59 · Notas IMDb e Rotten Tomatoes** · **20 · Baixar para ver offline** · **79 · Assistir junto à distância** [Grande].
- **58 · Gostei/não gostei** · **74 · Listas próprias** · **77 · Esconder títulos** [Talvez].

## 2. Jogos
- Nada pendente do centro de esportes (etapas 1–3 e placar flutuante prontos na 0.26.0). Ideias para o futuro, se o Samuel quiser: manchetes (ficou combinado "só dados"), mais ligas (Série B, Estaduais, NBA).

## 3. TV ao vivo
- **36 · Abrir o app direto num canal favorito** [Sem prior.] — parcial: já existe "Começar direto no último canal assistido"; falta escolher um canal fixo.
- **16 · Pausar e voltar a TV ao vivo** [Sem prior.] — parcial: "Do início"/voltar na programação nos canais que gravam; pausar qualquer canal ainda não.
- **40 · Diagnóstico do canal** (velocidade, travamentos, servidor) [Sem prior.] — parcial: só a lista de qualidades.
- **19 · Gravar programas** no aparelho [Grande].
- **17 · Multitela com 4 canais** — provavelmente não vale (plano com 2 telas).
- Logos de canais que faltam (ex.: ESPN) em `public/logos/custom/`.

## 4. Início
- **37 · Apagar o histórico item a item** em "Vistos por último" [Sem prior.] — parcial: "Tirar de Continuar assistindo" já existe para filmes/séries; canais só se apagam todos de uma vez.

## 5. Estética e organização
- Logotipos de **Star+, Discovery+ e Hulu** (hoje tipográficos; o Samuel vai criar no ChatGPT).
- **51 · Identidade visual por streaming** (entrar na Netflix com a cara da Netflix) [Talvez].
- **34 · Avatar com foto** no perfil [Sem prior.] (hoje só ilustrados).

## 6. Geral
- **11 · Player mais completo no Android (ExoPlayer)** — áudio/legenda e estabilidade [Depois].
- **18 · Picture-in-picture do sistema** (janelinha fora do app, Windows/Android) [Depois].
- **12 · Voz dentro do app Android** [Depois] (no Chrome/Edge já funciona).
- **82 · Buscas recentes e sugestões** [Talvez].
- **34 · PIN por perfil** · **35 · Tempo de tela infantil** (atenção: Perfil Kids foi descartado) · **43 · Atalhos para apps oficiais (Claro TV+, SKY+, DirecTV GO)** [Sem prior.].
- **9 · Sincronização automática pela nuvem** (hoje por arquivo) · **23 · Chromecast** · **14 · App para Roku** [Grande].
- **13 · Assinatura digital do instalador Windows** (paga) [Grande].

## Depende do Samuel
- ✅ Repositório público (08/11) e atualização dentro do app conferida no Windows pelo Samuel (09/11, 0.18.1 → 0.19.x).
- ✅ Secret `TMDB_KEY` cadastrado (09/11): Tops com 223 listas (Netflix oficial em português, streamings, gêneros, gêneros por streaming, especiais).
- **Jogos com a Goldcard**: conferir na TV/PC o centro de esportes (0.25–0.26): canais dos jogos e da F1 achados no guia (sem guia aparece "canal provável"), placar na tela em tela cheia. O "Guia de jogos" mostra diagnóstico se vier vazio — mandar print.
- Atualização dentro do app na **TV LG** e no **Android/Google TV**: conferir uma vez (no Windows já funciona).
- Testar na TV LG OLED B7 (webOS 3.5) e no celular/Google TV: vídeo, PIP com 2 telas, placar/tabela da ESPN, guias públicos, banners dos streamings (na LG ficam sem animação).
- Conferir o "0 filmes" da Goldcard (provavelmente resolvido: em 09/11 a lista mostrava 44 mil filmes).
- Logos de canais que faltam (ex.: ESPN) em `public/logos/custom/`; logotipos de Star+, Discovery+ e Hulu (hoje tipográficos).
- Opcional: a mesma chave do TMDB em Ajustes › Serviços de cada aparelho (capas, sinopses em português e trailers).

