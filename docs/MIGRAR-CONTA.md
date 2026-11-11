# PRISMA — migrar para outra conta do Claude (e continuar sem perder nada)

Tudo o que importa do projeto está no **GitHub**, não na conversa: o código, o histórico de versões,
as pendências e as instruções. A conta nova do Claude só precisa enxergar o mesmo repositório.

- Repositório: **https://github.com/xSam10-10/prisma** (público, branch `main`)
- Versão atual: **0.28.0** (10/11/2026)
- Documentos que a nova conversa deve ler: `docs/PRISMA-continuidade.md` (seção 0 primeiro),
  `docs/PENDENCIAS.md` e `release-notes.md`. Uma cópia das pendências está no fim deste arquivo.

---

## Passo 1 — Ligar o GitHub na conta nova do Claude
1. Entre no claude.ai com a **conta nova**.
2. Abra **https://claude.ai/connect-github** e conecte **a mesma conta do GitHub** de sempre (a dona do `xSam10-10/prisma`).
3. Se pedir, instale/autorize o **Claude GitHub App** no repositório `xSam10-10/prisma`
   (sem isso a conversa consegue ler o código, mas não consegue publicar versões).

## Passo 2 — Abrir a sessão
1. Abra o **Claude Code** (claude.ai/code ou o app) com a conta nova e crie uma **nova sessão na nuvem**.
2. Selecione o repositório **xSam10-10/prisma**, branch **main**.
3. Cole a mensagem do Passo 3 como primeira mensagem.

## Passo 3 — Primeira mensagem (copiar e colar)

```
Vamos continuar o projeto PRISMA (meu player de IPTV), que veio de outra conta do Claude. Antes de qualquer coisa, leia `docs/PRISMA-continuidade.md` (comece pela seção 0), `docs/PENDENCIAS.md`, `release-notes.md` e `docs/MIGRAR-CONTA.md`, e confirme que entendeu: o estado atual (versão 0.28.0), como publicar uma versão (workflow `release.yml`), as verificações antes de publicar (incluindo `test/scan-foco.mjs`) e o servidor falso de testes (`test/fake-xtream.mjs`). Confira também se você consegue dar push na `main` e rodar `gh workflow run` neste repositório.

Regras: responda sempre em português; os dados da minha assinatura Goldcard eu passo por aqui quando precisar — nunca grave nenhuma credencial no repositório; a chave do TMDB fica só no secret `TMDB_KEY` do GitHub. Commits com o autor "Samuel Costa".

O centro de esportes está concluído; as próximas melhorias estão em `docs/PENDENCIAS.md`. Depois disso seguimos com as demais pendências.
```

## Passo 4 — O que continua funcionando sozinho (nada a fazer)
- **Atualização dentro do app** (Windows, TV LG, Android): lê as Releases do GitHub — não depende da conta do Claude.
- **Tops automáticos** (workflow `tops.yml`, 4×/dia) e o secret **`TMDB_KEY`**: ficam no GitHub.
- **Assinatura do Android** e demais segredos do build: ficam nos secrets do GitHub.
- Seus dados nos aparelhos (favoritos, perfis, progresso, senha de proteção): ficam em cada aparelho.

## Se algo der errado na conta nova
- **"Não consigo dar push / publicar"**: refaça o Passo 1 (conectar GitHub e instalar o Claude GitHub App no repositório) e abra uma sessão nova.
- **A conversa não achou alguma informação**: diga "está em docs/PRISMA-continuidade.md e docs/PENDENCIAS.md".
- **Cópia de segurança extra**: no GitHub, botão verde **Code › Download ZIP** baixa o projeto inteiro.

---

## Apêndice — cópia das pendências (docs/PENDENCIAS.md em 09/11/2026)

# PRISMA — Melhorias sugeridas ainda pendentes (atualizado em 09/11/2026, versão 0.24.5)

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

## 1. TV ao vivo (lista de canais, guia e jogos)
- **36 · Abrir o app direto num canal favorito** [Sem prior.].

## 2. Player de reprodução
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
- **17 · Multitela em grade** (4 canais iguais) — provavelmente não vale (plano com 2 telas).

## 3. Filmes e Séries
- **75** Histórico de assistidos · **80** Filtros (gênero, ano, nota, idioma) · **44** "Onde assistir" nos streamings oficiais — todos [Depois]
- **20 · Baixar para ver offline** · **59 · Notas IMDb/Rotten** · **79 · Assistir junto à distância** [Grande]
- **51, 58, 74, 77** [Talvez] — identidade por streaming, gostei/não gostei, listas próprias, esconder títulos
- Logotipos que faltam: **Star+, Discovery+, Hulu** (o Samuel vai criar no ChatGPT; hoje são tipográficos)

## 4. Geral do app
- **12 · Voz dentro do app Android** [Depois]
- **82 · Buscas recentes e sugestões** [Talvez]
- **34 · Avatar com foto e PIN por perfil** · **35 · Tempo de tela infantil** · **37 · Apagar histórico item a item** · **43 · Atalhos para apps oficiais (Claro TV+, SKY+, DirecTV GO)** [Sem prior.]
- **9 · Sincronização automática pela nuvem** (hoje por arquivo) · **14 · App para Roku** · **13 · Assinatura digital do instalador Windows (paga)** [Grande]

## 5. Jogos — novo "centro de esportes" (proposta aprovada em 09/11; **esperar o Samuel dizer "pode fazer"**)
Pedido do Samuel: temas próprios para as principais ligas, cada uma com banner moderno, calendário, destaques e menu lateral; destaque à parte para a Fórmula 1 (banner, calendário de corridas, lembrete e destaques). Organizado, intuitivo e premium.

**Estrutura proposta (a que ele aprovou):**
1. **Tela inicial de Jogos (hub):** carrossel grande "Ao vivo e a seguir" (todas as ligas: escudos, placar, minuto, canal, Assistir) · fileira **Campeonatos** (um cartão por liga, na cor dela, "Rodada 12 · hoje 16h"; a F1 entra como cartão com visual próprio) · **Meus times** (próximos jogos, lembrete automático) · **Hoje** (linha do tempo do dia com jogos e corridas).
2. **Página de cada campeonato:** Champions League, Espanhol (La Liga), Inglês (Premier League), Italiano (Serie A), Alemão (Bundesliga), Francês (Ligue 1), Libertadores, Copa do Brasil, Copa Sul-Americana (+ Brasileirão, a confirmar).
   - Banner temático (cor/gradiente da liga, nome, temporada, rodada/fase, contagem para o próximo jogo).
   - Menu lateral: Visão geral · Calendário · Tabela (ou Chaves nas copas) · Destaques · Times.
   - Calendário por rodada (ligas) ou fase (copas); cada jogo com escudos, horário de Brasília, canal achado no guia e lembrete.
   - Destaques de dados: jogo da rodada, artilheiros, líderes, sequências, maiores goleadas.
   - Times: grade de escudos → próximos jogos do time + "Seguir" (Meus times).
3. **Fórmula 1:** banner do próximo GP (país, circuito, data, contagem) · fim de semana completo (TL1–3, sprint, classificação, corrida) no horário de Brasília, lembrete por sessão e canal (Band, se no guia) · classificação de pilotos e construtores com as cores das equipes · pódio da última corrida · calendário da temporada (passadas com vencedor).

**Decisões técnicas sugeridas:** futebol pela ESPN (já usada: `src/core/scores.ts`; códigos `uefa.champions`, `esp.1`, `eng.1`, `ita.1`, `ger.1`, `fra.1`, `conmebol.libertadores`, `conmebol.sudamericana`, `bra.copa_do_brazil`, `bra.1`); F1 por fonte aberta (Jolpica/Ergast ou OpenF1) — de preferência gerar um `prisma-sports.json` no GitHub Actions, como os Tops, para a TV só baixar. Temas **inspirados** (cor, gradiente, tipografia), sem copiar o visual oficial das marcas. Sem vídeos de gols (não há fonte confiável). Na TV LG, menos animação (`html.lite`). Canal do jogo depende do guia da Goldcard ("provável" quando não achar).

**Ordem sugerida:** (1) hub + páginas das ligas com banner, calendário e tabela; (2) Fórmula 1 completa; (3) destaques/estatísticas e acabamento.

**Perguntas em aberto para o Samuel:** ordem das ligas (sugestão: Brasileirão, Libertadores, Copa do Brasil, Sul-Americana, Champions, Inglês, Espanhol, Italiano, Alemão, Francês) · incluir o Brasileirão? · F1 também com "semana do GP" no Início (como o Dia de jogo)? · incluir manchetes (notícias da ESPN) ou só dados?

## Depende do Samuel
- ✅ Repositório público (08/11) e atualização dentro do app conferida no Windows pelo Samuel (09/11, 0.18.1 → 0.19.x).
- ✅ Secret `TMDB_KEY` cadastrado (09/11): Tops com 223 listas (Netflix oficial em português, streamings, gêneros, gêneros por streaming, especiais).
- **Jogos com a Goldcard**: conferir na TV/PC se a aba Jogos traz partidas (0.18.0 passou a usar guia completo + placar da ESPN). Se vier vazia, a tela mostra um diagnóstico — mandar print.
- Atualização dentro do app na **TV LG** e no **Android/Google TV**: conferir uma vez (no Windows já funciona).
- Testar na TV LG OLED B7 (webOS 3.5) e no celular/Google TV: vídeo, PIP com 2 telas, placar/tabela da ESPN, guias públicos, banners dos streamings (na LG ficam sem animação).
- Conferir o "0 filmes" da Goldcard (provavelmente resolvido: em 09/11 a lista mostrava 44 mil filmes).
- Logos de canais que faltam (ex.: ESPN) em `public/logos/custom/`; logotipos de Star+, Discovery+ e Hulu (hoje tipográficos).
- Opcional: a mesma chave do TMDB em Ajustes › Serviços de cada aparelho (capas, sinopses em português e trailers).
