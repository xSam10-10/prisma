# PRISMA para Roku (versão básica)

Entra com a lista Xtream (servidor, usuário e senha, digitados no próprio Roku e
guardados só nele), mostra **Ao vivo** por categoria, **Filmes** e **Séries**
(temporadas e episódios) e toca no player do Roku.

## Instalar (modo desenvolvedor)

1. No controle do Roku, na tela inicial: **Home 3×, ▲ 2×, ▶, ◀, ▶, ◀, ▶**.
   Aparece a tela de desenvolvedor: anote o endereço (ex.: `http://192.168.0.20`),
   aceite e crie uma senha. O Roku reinicia.
2. No computador (mesma rede), abra esse endereço no navegador. Usuário `rokudev`
   e a senha que você criou.
3. Em **Upload**, escolha o `PRISMA-Roku-x.zip` (da página de Releases do GitHub)
   e clique em **Install with zip**. O PRISMA aparece no fim da tela inicial.

Para atualizar, repita o passo 3 com o zip novo (o Roku não atualiza sozinho apps
de desenvolvedor).

## Controle
- **◀ ▶** trocam entre menu, categorias e lista · **OK** abre · **Voltar** volta.
- No vídeo: **Voltar** sai; os botões de play/pausa e avanço do controle funcionam.

## Limitações desta versão
- Sem guia de programação, favoritos, Jogos e o visual dos streamings do app principal.
- Áudio e legenda: pelo menu ✱ do Roku durante o vídeo (quando o arquivo traz várias trilhas).
- Canais ao vivo tocam em HLS (`.m3u8`); se a lista só tiver `.ts`, avise.
