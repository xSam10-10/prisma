# PRISMA — Melhorias sugeridas ainda pendentes (atualizado em 08/11/2026, versão 0.18.0)

Números = os da lista original de sugestões (seções A–D). Prioridade combinada com o Samuel:
**[1º]** fazer primeiro · **[Depois]** · **[Grande]** projeto maior · **[Talvez]** talvez não valha · **[Sem prior.]** sem prioridade definida.

Já feito desde a lista original (não repetir): 8 qualidade (ícone HD), 21 último canal + zapear por número,
24 Agora na TV, 25 destaques do dia, 30 meus times, 32 tabela/próximos jogos, 10 estatísticas/escalações,
33 aviso de gol (app aberto), 42 guia extra, 45 guias públicos sugeridos, grupo Gravações,
PIP (1 janela, Desl/Lig + Trocar), barra clássica, lista em tela cheia com menu e programação por dia,
atualização dentro do app, logotipos dos streamings (coloridos + brancos), bloquear canal com senha,
48 fileiras automáticas (parcial: Tops por streaming/gênero/especiais, 0.18.0), Top 10 canais agora.

## 1. TV ao vivo (lista de canais, guia e jogos)
- **7 · Controle parental completo** [1º] — PIN para abrir categorias "ADULTOS +18" e perfil infantil. *(Parcial: bloquear um canal com senha já existe.)*
- **41 · Esconder canais e categorias** que não usa [1º].
- **36 · Abrir o app direto num canal favorito** [Sem prior.].

## 2. Player de reprodução
- **15 · Começar do início** um programa ao vivo já começado (quando o canal grava) [1º].
- **70 · Lembrar a escolha de áudio e legenda** por série/canal [1º].
- **11 · Player mais completo no Android (ExoPlayer)** — áudio/legenda e estabilidade [Depois].
- **18 · Picture-in-picture do sistema** (janelinha fora do app, Windows/Android) [Depois].
- **31 · Placar flutuante** sobre o vídeo [Depois].
- **65 · Pular abertura e recapitulação** [Depois].
- **68 · Velocidade de reprodução** (0,75× a 1,5×) [Depois].
- **69 · Estilo da legenda** e legenda externa .srt [Depois].
- **16 · Pausar e voltar a TV ao vivo** por alguns minutos [Sem prior.].
- **40 · Diagnóstico do canal** (velocidade, atrasos, servidor) [Sem prior.].
- **19 · Gravar programas** no aparelho [Grande].
- **23 · Transmitir para a TV (Chromecast)** [Grande].
- **67 · Miniaturas na barra de tempo** [Grande].
- **72 · Créditos finais com sugestão do próximo** [Grande].
- **17 · Multitela em grade** (4 canais iguais) — provavelmente não vale (plano com 2 telas).
- **71 · Informações durante a pausa** [Talvez] · **66 · "Ainda está assistindo?"** [Talvez].

## 3. Filmes e Séries
- **48 · Fileiras automáticas** — falta só Sagas/coleções (Lançamentos, Aclamados e gêneros já vêm nos Tops da 0.18.0) [1º]
- **53 · Logotipo do título sobre o fundo** no detalhe [1º]
- **54 · Classificação indicativa e selos** 4K, Dublado, Legendado [1º]
- **57 · Versões dublada/legendada/4K/HD num só card** [1º]
- **61 · Episódios com miniatura**, sinopse e barra de visto [1º]
- **62 · Marcar como assistido** (episódio, temporada, série) [1º]
- **64 · Card da série abre no próximo episódio** [1º]
- **76 · Remover de "Continuar assistindo"** [1º]
- **81 · Busca tolerante** a erros e nomes em inglês/português [1º]
- **46** Trailer sem som no destaque · **47** Prévia ao parar no pôster · **49** "Porque você assistiu" · **50** Franquias/coleções · **52** Novidades e em breve · **55** Semelhantes · **63** Aviso de novo episódio · **75** Histórico de assistidos · **80** Filtros (gênero, ano, nota, idioma) · **44** "Onde assistir" nos streamings oficiais — todos [Depois]
- **28 · Página do ator/diretor** [Sem prior.]
- **20 · Baixar para ver offline** · **59 · Notas IMDb/Rotten** · **79 · Assistir junto à distância** [Grande]
- **51, 58, 74, 77** [Talvez] — identidade por streaming, gostei/não gostei, listas próprias, esconder títulos
- Logotipos que faltam: **Star+, Discovery+, Hulu** (o Samuel vai criar no ChatGPT; hoje são tipográficos)

## 4. Geral do app
- **38 · Várias listas IPTV no mesmo app** [1º]
- **39 · Painel da assinatura** (vencimento, telas em uso, aviso antes de vencer) [1º]
- **12 · Voz dentro do app Android** [Depois]
- **82 · Buscas recentes e sugestões** [Talvez]
- **34 · Avatar com foto e PIN por perfil** · **35 · Tempo de tela infantil** · **37 · Apagar histórico item a item** · **43 · Atalhos para apps oficiais (Claro TV+, SKY+, DirecTV GO)** [Sem prior.]
- **9 · Sincronização automática pela nuvem** (hoje por arquivo) · **14 · App para Roku** · **13 · Assinatura digital do instalador Windows (paga)** [Grande]

## Depende do Samuel
- **Secret `TMDB_KEY`** no repositório (Settings › Secrets and variables › Actions › New repository secret, valor = chave v3 do TMDB). Sem ele, os Tops trazem só o ranking oficial da Netflix (títulos em inglês, que casam pouco com a lista) e o ranking de canais. Depois rodar Actions › Tops › Run workflow.
- **Jogos vazios com a Goldcard**: na 0.18.0, se continuar sem jogos, a tela mostra um diagnóstico (canais consultados, com guia, exemplos de programas) — mandar print.
- ✅ Repositório público desde 08/11 23h (atualização dentro do app e tops conferidos: os dois arquivos respondem). Instalar a 0.18.0 manualmente uma vez em cada aparelho; depois, botão Atualizar.
- Testar na TV LG OLED B7 (webOS 3.5) e no celular/Google TV com a Goldcard: vídeo, PIP com 2 telas, atualização, placar/tabela da ESPN, guias públicos.
- Conferir o "0 filmes" da Goldcard.
- Logos de canais que faltam (ex.: ESPN) em `public/logos/custom/`.
- Chave do TMDB (themoviedb.org › Configurações › API › Chave v3) em Ajustes › Serviços.
