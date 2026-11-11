# Novidades do PRISMA
<!-- A seção da versão atual (a de cima) aparece no aviso de atualização dentro do app. -->

## 0.34.1 — foto da atriz nas capas genéricas
- Filme da categoria de adultos com capa genérica e sem capa na ThePornDB: se o filtro de atrizes acha uma atriz no nome (em qualquer lugar do título, como "Kissa Sins Gets…"), a capa vira a foto dela
- Atrizes guardadas por versões antigas são conferidas de novo para pegar a foto em pé

## 0.34.0 — filtro por produtora e fileiras sem cortes
- Categoria de adultos: a fileira de atrizes mostra só as que cabem na tela (até 10), sem rolar para o lado, e um botão "Ver todas" abre uma página com todas, em várias fileiras (com busca pelo nome)
- Novo filtro por produtora (Vixen, Tiny4K, Brazzers, Brasileirinhas…): o PRISMA tira o nome da produtora do título e confere na ThePornDB, que traz o logotipo; também com "Ver todas"
- Rolando a lista de filmes, as fileiras de atrizes e produtoras se recolhem e dão espaço para as capas (o nome do filme não fica mais cortado em telas pequenas)

## 0.33.0 — mais capas e capa com a foto da atriz
- Categoria de adultos: o PRISMA procura a capa na ThePornDB também pelo título com nome parecido (ex.: "Grande Festa 10" acha "Grande Festa Vol. 10"), sem aceitar outra parte ou outro volume
- Sem capa em lugar nenhum: a capa vira a foto da atriz do filme (a que está no nome do título é a principal). Com mais de uma atriz, parando o controle ou o mouse na capa por 3 segundos, as fotos vão se revezando
- As atrizes encontradas assim também entram no filtro de atrizes, com a foto da ThePornDB

## 0.32.0 — atrizes, senha com horário livre e capas
- Categoria de adultos: fileira de atrizes acima dos filmes, com foto. Escolha uma e aparecem só os filmes dela ("Procurar" acha qualquer atriz). As fotos vêm da ThePornDB; sem o token, os nomes saem do título dos filmes
- Senha com horário livre: antes das 22:00 o conteúdo protegido pede a senha; das 22:00 às 06:00 abre sem senha. Os horários mudam em Ajustes › Proteção, e mudar pede a senha
- Capas da categoria de adultos: agora funcionam só com o token da ThePornDB (sem a chave do TMDB), também trocam capas da lista que não abrem e refazem as buscas quando o token chega pela nuvem

## 0.31.1
- Star+, Discovery+ e Hulu ganharam os logotipos de verdade (coloridos e na versão branca), nos botões de Filmes e Séries e no destaque de cada streaming

## 0.31.0 — capas oficiais e chaves pela nuvem
- Filmes da categoria de adultos que vêm com capa genérica ganham a capa oficial: o PRISMA procura no TMDB e, o que faltar, na ThePornDB (token grátis em Ajustes › Serviços). Capas que já estão certas na lista não mudam
- As chaves do TMDB e da ThePornDB vão pela sincronização da nuvem: digite uma vez e a TV e o celular recebem

## 0.30.0 — nuvem, player do Android, Roku, legendas e filtros
- Sincronização pela nuvem: favoritos, Minha lista, seções, onde você parou, histórico, lembretes, perfis e ajustes iguais na TV, no computador e no celular (Ajustes › Dados, com um token do GitHub; fica num Gist privado seu)
- Android: filmes e séries abrem no player do Android (ExoPlayer), com troca de áudio, legendas e velocidade na engrenagem; dá para voltar ao player do PRISMA em Ajustes › Player
- Roku: app básico do PRISMA (canais ao vivo, filmes e séries), instalado no modo desenvolvedor — o arquivo PRISMA-Roku está na página de downloads
- Filmes e séries: botão de velocidade no player (1×, 1,25×, 1,5× e 0,75×)
- Legendas: tamanho (pequena a muito grande), cor e fundo em Ajustes › Player
- Legenda de um arquivo .srt ou .vtt do aparelho (computador e celular), com "Adiantar/Atrasar 0,5 s" para acertar a sincronia
- Filtros em Filmes e Séries: por ano (lançamentos, por década, clássicos) e por áudio (dublado, legendado, nacional)
- Foto no perfil: escolha uma foto do aparelho em Ajustes › Perfis (fica no lugar da ilustração)

## 0.28.0 — modo Marcante dos streamings
- Em Filmes e Séries, cada streaming fica com cara de app oficial: destaque grande no topo com a arte, o logo do título, sinopse e os botões no estilo da marca ("98% relevante" na Netflix, "Incluído no Prime", botão "＋" no Disney+…), girando entre os títulos do Top 10
- Capas em pé ou deitadas conforme o streaming (Netflix e Globoplay em pé; Disney+, HBO Max, Prime Video, Apple TV e outros deitadas) e o foco do controle de cada um: cresce, sobe, anel na cor da marca ou brilho
- Fonte parecida com a de cada marca (carregada só quando você entra no streaming), títulos das fileiras e nomes como "Top 10 em filmes hoje", "Em alta", "Explore tudo"
- Vale para todos os 18 streamings que o app reconhece
- Ajustes › Aparência › "Visual de cada streaming": Marcante (novo), Só as cores (como na 0.27) ou Original (sem mudar nada)

## 0.27.0 — o visual de cada streaming
- Em Filmes e Séries, ao entrar num streaming o app veste o visual dele: cores, botões, cantos e letra inspirados em Netflix, HBO Max, Disney+, Prime Video, Apple TV, Globoplay, Paramount+, Crunchyroll, Star+ e todos os outros
- Ao sair do streaming (Todos, Top ou outra aba), volta o seu tema
- Dá para desligar em Ajustes › Aparência › "Visual de cada streaming"

## 0.26.0 — Fórmula 1, destaques e placar na tela
- Fórmula 1 em Jogos: próximo GP com todo o fim de semana (treinos, sprint, classificação e corrida) no horário de Brasília, lembrete por sessão ou de todas de uma vez, pilotos, equipes com as cores de cada uma, pódio do último GP e calendário com os vencedores
- Semana do GP no Início: faltando uma semana, uma faixa mostra o GP, a próxima sessão e o canal
- Campeonatos ganharam "Destaques": artilheiros, assistências e as sequências do momento (vitórias seguidas, invencibilidade, jejum)
- Tabela com os últimos 5 resultados de cada time, e o artilheiro na visão geral
- Placar na tela: em tela cheia, o placar dos Meus times ao vivo fica no canto, e qualquer jogo pode ser fixado com "📌 Mostrar placar na tela" no detalhe; pisca quando sai gol

## 0.25.0 — centro de esportes
- Jogos tem uma tela inicial nova: "Ao vivo e a seguir" com escudos, placar e minuto, os Campeonatos, Meus times e todos os jogos de hoje
- Página própria para Brasileirão, Libertadores, Copa do Brasil, Sul-Americana, Champions, Inglês, Espanhol, Italiano, Alemão e Francês, cada uma com as cores do campeonato
- Em cada campeonato: visão geral (líder, melhor ataque e defesa, maior goleada), calendário rodada a rodada (ou fase a fase nas copas), tabela, chaves do mata-mata e times
- Siga um time direto da página dele: ele entra em Meus times, com lembrete automático dos jogos
- A lista antiga de jogos do guia continua em "Guia de jogos"
- Correção: no detalhe do jogo, a lista "Onde assistir" ficava espremida na TV quando aparecia o placar com escudos; agora o painel rola inteiro

## 0.24.8
- Correção: filmes e séries com número ou parte entre colchetes ("Holed [01]", "Duna [Parte 2]", "Kill Bill [Vol. 2]") eram juntados numa capa só como se fossem versões; agora cada um tem sua capa. Dublado, Legendado e 4K do mesmo título continuam juntos

## 0.24.7
- Correção: o nome do canal não perde mais o que vem depois da qualidade — "XXX 4K HOLED 01" aparecia como "XXX 4K 01", e canais de estúdios diferentes ficavam com o mesmo nome
- Números romanos e pequenos (Ⅰ, Ⅹ, ¹, ²) no nome viram números comuns e esses canais não são mais juntados
- Depois de atualizar, use Ajustes › Lista › "Atualizar lista agora" para recarregar os canais

## 0.24.6
- Correção: canais diferentes com o mesmo nome no servidor (ex.: 10 canais "XXX 4K" na categoria Adultos) eram juntados num só; agora aparecem todos, numerados de 1 a 10. Só o mesmo canal vindo de outro servidor, ou marcado como [ALT], BACKUP ou H265, continua como fonte reserva
- Canais com números decorados (❶, ①, 🔟, ０…) agora mostram o número normal e não são mais juntados
- Depois de atualizar, use Ajustes › Lista › "Atualizar lista agora" para recarregar os canais

## 0.24.5
- Ajustes: a coluna de seções rola quando não cabe na tela (antes "Dados e limpeza" e "Sobre" ficavam cortados)
- Fileiras de capas: a capa em foco não tem mais a borda de cima cortada
- Revisão de todas as telas com o controle em janela larga/baixa e no tamanho da TV: nada mais fica escondido ao navegar

## 0.24.4
- Correção: canais numerados ou de nome parecido ("XXX HD 01", "XXX HD 02", "Canal (1)", "Canal (2)") eram juntados num só; agora cada um aparece — só fontes reservas do mesmo canal ([ALT], BACKUP, H265) continuam juntas
- Canais que o servidor coloca em mais de uma categoria aparecem em todas elas (sem repetir em "Todos")
- Depois de atualizar, use Ajustes › Lista › "Atualizar lista agora" para recarregar os canais

## 0.24.3
- Busca: botão "Ver todos" em cada fileira (Filmes, Séries, Canais, Gênero) que mostra todos os resultados de uma vez, em grade; Voltar retorna às fileiras

## 0.24.2
- Dublado/legendado: reconhece mais jeitos de a lista marcar ([L], (D), Leg, Dual, Nacional e categorias como "Legendados"), com selo na capa e nas versões do detalhe
- Versões que não dizem o áudio mostram a categoria de onde vêm, para dar para diferenciar
- Início: ao voltar para o topo, o destaque aparece inteiro (antes ficava cortado sob o menu)

## 0.24.1
- Destaque da semana: o card grande não cresce mais por cima dos vizinhos ao receber o foco
- Destaque da semana sem a arte do TMDB: mostra a capa da própria lista sobre um fundo desfocado (antes ficava vazio)

## 0.24.0 — proteção, listas e conforto
- Ajustes › Proteção: senha de 4 números; categorias de adulto (+18) ficam protegidas e somem do app até digitar a senha; proteja ou esconda qualquer categoria de Ao vivo, Filmes e Séries
- Esconder canal pela barra do canal (volta em Ajustes › Proteção); "🔒 Protegidas" na lista de categorias do Ao vivo
- Ao vivo: "Do início" na barra do canal para ver desde o começo o programa que está passando (canais que gravam)
- O app lembra o áudio e a legenda escolhidos em cada série e canal
- Um card só para o mesmo filme em várias versões; no detalhe, escolha HD, Legendado, Dublado ou 4K
- Marcar filme como visto e marcar a série inteira; a série abre direto no próximo episódio
- "Continuar assistindo": card "Tirar títulos daqui" para limpar o que você não vai terminar
- Busca tolerante a erros de digitação e pelo nome em outro idioma (TMDB)
- Várias listas IPTV no mesmo app: as listas usadas ficam em Ajustes › Lista para trocar com um toque
- Painel da assinatura: dias até vencer, telas em uso agora e aviso no Início faltando 7 dias

## 0.23.0 — visual premium IV
- Busca nova: teclado em grade na tela, resultados com capas em fileiras e busca por ator/diretor ("ana souza") e por gênero ("terror")
- Capa que cresce até virar a tela de detalhes ao apertar OK (fora na TV LG)
- Selo "NOVO EP." com brilho nas séries que você acompanha quando sai episódio novo, e botão "Me avise" no próximo episódio
- Coleções viraram maratona: progresso de quantos filmes já viu, "Continuar maratona" e, em Star Wars e X-Men, ordem da história
- "Ainda está assistindo?" depois de 3 episódios seguidos sem tocar no controle
- Dia de jogo: quando um dos Meus times joga hoje, faixa no alto do Início com as cores do time, contagem regressiva, placar ao vivo e o canal
- Guia: o programa em foco aparece com imagem grande (do guia ou do TMDB), sinopse e quanto falta para terminar
- Correção: detalhe de filme/série aberto do Início rolado aparecia cortado

## 0.22.0 — visual premium III
- Ao abrir o app depois de ver um filme ou série, tela "Continuar assistindo" com a arte, o tempo que falta e o botão de retomar
- Início muda com a hora do dia: "Bom dia, Samuel", cor de fundo e ordem das fileiras (de manhã os canais, à noite "Para assistir hoje à noite")
- "Chegando esta semana": estreias da semana nos streamings e novos episódios das séries que você acompanha
- Cards de canal no Início mostram o canal ao vivo (sem som) depois de 2 s com o foco (fora na TV LG)
- Página do ator/atriz: foto, biografia, idade, cidade e os títulos dele que estão na sua lista (OK no elenco)
- Classificação indicativa (L, 10, 12, 14, 16, 18) nas cores oficiais no detalhe
- Episódios vistos com ✓ e "Temporada 1 · 3 de 10 vistos", com marcar/desmarcar a temporada inteira
- Filmes: miniatura da cena na barra de tempo; abertura "modo cinema" com a logo; créditos finais com o vídeo no canto, "Continuar a coleção" e "Semelhantes"
- Protetor de tela com as artes da sua lista e relógio após 5 min pausado (qualquer tecla volta)
- Novo tema "OLED (preto absoluto)" em Ajustes › Aparência
- Correção: o player de filmes podia travar com "erro" logo após começar (laço de atualização da tela)

## 0.21.0 — visual premium II
- Trailer silencioso no destaque do Início e no Destaque da semana (depois de alguns segundos com o foco)
- Capas que se expandem: parado ~2 s numa capa, abre um card largo com arte, logo, nota, selos e sinopse
- Player: pausa com logo, episódio e sinopse; barra de tempo fina que engrossa; botões em vidro; contagem circular do próximo episódio
- Abertura animada do PRISMA
- Início: "Porque você assistiu…", "Para assistir hoje à noite" e "Coleções e sagas"
- Filmes › Top: "Explorar por gênero" em cartões ilustrados e "Coleções e sagas" (tela própria, em ordem de lançamento)
- Cor do título (dominante do pôster) no fundo e no botão principal do detalhe
- Capa em foco "respira" na TV e inclina com o mouse no computador; títulos editoriais ("Top 10 Netflix")
- Menu do Início transparente no topo, com vidro ao rolar
- Ao vivo: novo visual "Cartão" (Ajustes › Player › Visual da tela cheia)
- Jogos com escudos, cores dos times, minuto pulsando e gols na linha do tempo
- Guia: linha "agora" brilhando, programa em andamento com imagem e progresso
- Favoritos e Minha lista com animação e aviso; confete ao terminar uma temporada
- Estados vazios ilustrados; sons de navegação opcionais (Ajustes › Aparência)

## 0.20.0 — visual premium
- Início: destaque com a arte do filme/série e a logo oficial do título; "Continuar assistindo" em cards horizontais com a cena e o tempo que falta; "Destaque da semana" com um card grande e dois médios
- Top 10 com o número grande atrás da capa, em todas as fileiras de ranking
- O fundo da tela acompanha a capa em foco (arte do título ou a cor dele)
- Capas com selos (NOVO, 4K, DUB, LEG), aparecendo com fade; capas sem imagem ganham arte própria
- Detalhe do filme/série: fundo em tela cheia, logo do título, episódios com miniatura e sinopse, elenco com foto e "Semelhantes" da sua lista
- Canais com a imagem do programa (quando o guia traz) e barra de progresso
- Banner do streaming encolhe ao descer pelas listas; transições suaves entre abas; esqueletos enquanto carrega
- Tema Apple TV mais fiel (foco com elevação e brilho, cantos maiores, menu em vidro)
- Perfis com avatares ilustrados e o último título visto
- Correção: a fileira de streamings ficava se redesenhando sem parar

## 0.19.6
- Séries › streaming: sem a fileira de categorias acima das capas (mostra sempre todas as séries do streaming)

## 0.19.5
- Filmes e Séries › Todos: nova categoria "Últimos adicionados" (os 100 títulos mais novos da lista)
- Categorias de lançamentos (ex.: "Top Lançamentos 2026") aparecem logo abaixo de "Todos"

## 0.19.4
- Filmes › streaming: agora também mostra "Todos · <streaming>" — os filmes da sua lista que estão naquele streaming (pelo catálogo do TMDB), igual em Séries
- Banner do streaming volta inteiro ao subir de novo para o topo
- Ordem dos botões: Todos (padrão) e depois 🔥 Top

## 0.19.3
- Filmes e Séries › streaming: sem a coluna da esquerda — uma página só com o banner, o Top 10 em carrossel, os gêneros e, embaixo, todas as capas do streaming (com categorias e ordenação)
- Filmes e Séries › Top: sem a coluna da esquerda, só os carrosséis
- Filmes e Séries › Todos: escolher a categoria só de andar ▲▼ na coluna; ◀ ▶ passam entre a coluna e as capas sem escapar para outros botões
- Navegação pelo controle revisada em todas as fileiras: ▲▼ vão sempre para a fileira vizinha (mesmo curta) e nunca para a capa ao lado

## 0.19.2
- Início: para cada streaming, uma fileira "Top 10 Filmes" e logo abaixo "Top 10 Séries"
- Filmes e Séries: o botão 🔥 Top vem antes de "Todos"
- Navegação pelo controle no Início: ◀ ▶ não pulam mais para outra fileira nas pontas dos carrosséis, ▲ não salta para o menu do topo, e a fileira em foco aparece sempre inteira (descendo ou subindo)

## 0.19.1
- Coluna de categorias com a mesma largura em todas as abas (Ao vivo, Filmes, Séries e menu da tela cheia), calculada pelo nome mais longo da sua lista: nenhum nome cortado

## 0.19.0
- Filmes e Séries › Top: todas as listas uma embaixo da outra, cada uma em carrossel (como no Início)
- Nova lista "Adicionados recentemente" (os 10 últimos que chegaram na sua lista)
- Ordem: Adicionados recentemente, Chegaram ao streaming, Em alta, Mais aclamados, Top 10 de cada streaming, especiais e gêneros — a mesma na coluna da esquerda e nas capas
- Ao escolher um streaming: banner exclusivo da marca, Top 10 dele e listas por gênero (Terror no HBO Max, Comédia na Netflix…)
- Correção: ao descer pelas capas, a fileira de cima não fica mais cortada

## 0.18.1
- Filmes: a fileira de streamings aparece mesmo quando a lista não separa os filmes por streaming nas categorias — tocar no streaming abre o Top 10 dele
- O botão 🔥 Top fica sempre visível em Filmes e Séries

## 0.18.0
- Filmes e Séries: novo botão 🔥 Top com o Top 10 oficial da Netflix, os mais populares de cada streaming, Top 10 por gênero (terror, comédia, ação…), lançamentos, aclamados, doramas, novelas turcas, animes e nacionais — só o que está na sua lista
- Ao escolher um streaming, o Top 10 dele aparece no alto das categorias
- Início: Top 10 canais agora (com o que está passando), Top 10 da semana e Top de cada streaming, filmes e séries juntos
- As listas se atualizam sozinhas várias vezes por dia, sem versão nova do app (Ajustes › Serviços mostra quando foram baixadas)
- Jogos: usa também o guia completo e o placar do dia da ESPN (com os canais prováveis); se não achar nada, mostra o motivo
- Aparência: Estrutura agora é Menu Horizontal ou Menu Vertical; tema padrão Apple TV

## 0.17.0
- Agora na TV: mosaico com o que está passando em cada canal (menu da tela cheia)
- Grupo Gravações no menu da tela cheia (canais que gravam)
- Meus times: lembrete automático dos jogos e aviso de gol
- Jogos: tabela do campeonato, próximos jogos, estatísticas e escalações
- Início: Destaques de hoje (jogos, filmes e grandes programas)
- Ajustes › Lista: guia de programação extra (XMLTV) e guias públicos sugeridos

## 0.16.8
- Atualização dentro do app agora lê as versões direto do GitHub do PRISMA (repositório público)

## 0.16.7
- PIP simplificado: uma tela pequena a mais, com só duas opções — Desl/Lig e Trocar PIP

## 0.16.6
- Logotipos coloridos em alta definição dos 14 streamings (Netflix, HBO Max, Disney+, Apple TV, Prime Video, Paramount+, Globoplay, Crunchyroll, +SBT, AMC+, LIONSGATE+, FunimationNow, DIRECTV, Claro video)
- Opção em Ajustes › Aparência › Logotipos dos streamings: Coloridos (padrão) ou Brancos

## 0.16.5
- Atualizações: quando o canal público de atualizações ainda não existe, o app avisa isso (antes dizia "Nenhuma atualização disponível")

## 0.16.4
- Streamings em Filmes e Séries: logotipos brancos do mesmo tamanho, em carrossel com setas
- Novos: Funimation Now, Lionsgate, Claro Vídeo, SBT+, DirecTV GO, AMC+ (aparecem quando a sua lista tem essas categorias)

## 0.16.3
- Início: o destaque "Continuar assistindo" usa a largura toda, com a programação (Agora, A seguir, Depois) à direita
- Ao vivo: o vídeo ocupa toda a coluna da direita (sem os quadros de programação embaixo)

## 0.16.2
- Logotipos de Netflix, Prime Video, Disney+, HBO Max, Globoplay, Apple TV, Paramount+ e Crunchyroll em Filmes e Séries
- Menu da lista em tela cheia rola até os grupos de baixo
- Com o PIP ligado, ▲▼ voltam a trocar o canal (o menu do PIP fecha sozinho)
- Na tela cheia, OK sempre abre a lista de canais; as funções da barra se escolhem com ◀▶
- A aba Anime foi incorporada em Séries

## 0.16.1
- "Nenhuma atualização disponível" ao procurar atualização quando não há versão nova
- Lista de canais da tela cheia no visual Clássico (cinza, como a barra clássica) ou Prisma (cores do tema), em Ajustes › Player › Visual da tela cheia

## 0.16.0
- Ao vivo: andar na lista já troca o canal no vídeo; OK abre a tela cheia
- Tela cheia: OK abre a lista de canais por cima do vídeo
- ◀ abre o menu: Buscar, Agendar programação, Favoritos, Lista de canais, Guia de 7 dias e os grupos
- ▶ num canal mostra a programação dos dias anteriores e seguintes

## 0.15.0
- Atualizar o PRISMA de dentro do app (Ajustes › Sobre), no Windows, no Android/Google TV e na TV LG
- Aviso de versão nova ao abrir o app
- Na TV LG, a atualização baixa só o código novo e volta sozinha para a versão instalada se algo der errado

## 0.14.0
- Programação do canal por dia: seta → na lista de canais
- Gravações (programas que já passaram) e lembretes direto na programação
- Ajustes › Lista mostra quantos dias de guia a sua lista envia

## 0.13.0
- Barra do canal clássica, PIP com até 3 janelas, bloquear canal com senha, qualidade e formato da imagem
