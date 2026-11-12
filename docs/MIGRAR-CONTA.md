# PRISMA — passagem para outra conta do Claude (documento completo, 11/11/2026 · versão 0.34.3; a conta nova já fez a 0.34.4)

Este é o documento único para continuar o PRISMA em outra conta do Claude **sem perder nada**.
Ele complementa o documento original do projeto, `docs/PRISMA-continuidade.md` (marca, design,
arquitetura e o histórico de cada versão desde a 0.10.0), e resume tudo o que foi feito na conta
anterior, as regras de trabalho, como testar e publicar, e o que ainda falta.

Tudo o que importa está no **GitHub** (código, histórico, documentos, workflows e secrets), não na conversa:

- Repositório: **https://github.com/xSam10-10/prisma** (público, branch `main`)
- Cópia local no PC do Samuel: `C:\Users\Samuel Costa\Downloads\prisma` (em dia com o GitHub em 11/11)
- Versão publicada: **0.35.0** (Release `v2026.11.12-0122`: Windows, TV LG, Android e Roku)
- Ordem de leitura para a nova conversa: **este arquivo** → `docs/PRISMA-continuidade.md` (seção 0 e as
  seções 10as–10az) → `docs/PENDENCIAS.md` → `release-notes.md`.

---

## 1. Passo a passo na conta nova

### Opção A (recomendada): Claude Code no próprio PC
É como a conta anterior trabalhava desde 10/11. O PC já tem tudo pronto: a pasta do projeto, o `gh`
(GitHub CLI) logado na conta dona do repositório, Node/npm e o Playwright instalado globalmente.
1. Abra o app do Claude (Code) com a **conta nova**.
2. Abra a pasta **`C:\Users\Samuel Costa\Downloads\prisma`** como projeto.
3. Cole a mensagem da seção 2 como primeira mensagem.

Antes, no terminal da pasta, confira se está tudo em dia:
```bash
git pull
```
```bash
gh auth status
```
O `gh auth status` deve mostrar a conta do GitHub logada. Se não mostrar, rode `gh auth login`.

### Opção B: sessão na nuvem (claude.ai/code)
1. Com a conta nova, abra **https://claude.ai/connect-github** e conecte a **mesma conta do GitHub**.
2. Instale/autorize o **Claude GitHub App** no repositório `xSam10-10/prisma` (sem isso não publica).
3. Crie uma sessão na nuvem com o repositório `xSam10-10/prisma`, branch `main`, e cole a mensagem da seção 2.
4. Limite da nuvem: ESPN, TMDB, ThePornDB, guias públicos e o servidor da Goldcard podem não abrir de
   lá. Nesse caso, teste com o servidor falso e peça ao Samuel o teste real.

## 2. Primeira mensagem (copiar e colar)

```
Vamos continuar o projeto PRISMA (meu player de IPTV), que veio de outra conta do Claude. Antes de qualquer coisa, leia `docs/MIGRAR-CONTA.md` inteiro, depois `docs/PRISMA-continuidade.md` (seção 0 e as seções 10as a 10az), `docs/PENDENCIAS.md` e `release-notes.md`. Confirme que entendeu: o estado atual (versão 0.34.3), como publicar uma versão (workflow `release.yml`), as verificações antes de publicar (incluindo `test/scan-foco.mjs`) e o servidor falso de testes (`test/fake-xtream.mjs`, inclusive a ThePornDB falsa). Confira também se você consegue dar push na `main` e rodar `gh workflow run` neste repositório.

Regras: responda sempre em português; os dados da minha assinatura Goldcard eu passo por aqui quando precisar — nunca grave nenhuma credencial no repositório; a chave do TMDB fica só no secret `TMDB_KEY` do GitHub. Commits com o autor "Samuel Costa". Só publique uma versão depois que eu disser "Sim, publique".

Não há melhorias de desenvolvimento pendentes; o que falta são os meus testes nos aparelhos (lista "Depende do Samuel" em `docs/PENDENCIAS.md`). Vou trazer os próximos pedidos.
```

## 3. Regras e jeito de trabalhar do Samuel (valem sempre)

- **Idioma:** tudo em português, inclusive commits, notas de versão e documentos.
- **Credenciais:** os dados da Goldcard (servidor Xtream `http://lvbxsmart.xyz`, usuário e senha) só na
  conversa e quando ele mandar. **Nunca** gravar no repositório.
- **Chaves:**
  - TMDB: no secret `TMDB_KEY` do GitHub, usado pelos Tops.
  - TMDB e ThePornDB nos aparelhos: em Ajustes › Serviços. Com a nuvem ligada, elas vão pelo Gist
    privado do Samuel para os outros aparelhos (desde a 0.31.0). Nunca no código.
  - Se o Samuel disser que mandou um token e ele não estiver na mensagem, avisar e pedir para colar
    direto no app, não na conversa.
- **Commits:** autor "Samuel Costa" (`git -c user.name="Samuel Costa" commit ...`).
- **Publicar:** só depois de ele responder **"Sim, publique"**. Ao fim de cada lote, perguntar
  "Publico a x.y.z agora?".
- **Ritmo:** depois de cada lote, testar a navegação pelo controle (setas, OK e Voltar), subir a versão,
  atualizar os documentos e fazer o commit local. A publicação espera a autorização.
- **Visual:** "mega premium", com cara de app oficial. Quando ele disser "só sugira / não crie nada",
  responder só com a opinião.
- **Honestidade:** sempre dizer o que foi testado só com a lista de teste e o que depende da TV real,
  da Goldcard, do TMDB ou da ThePornDB.
- **Não oferecer de novo:** os itens e as sugestões de design que ele descartou estão no topo de
  `docs/PENDENCIAS.md`.
- **Prints do Samuel:** ele costuma mandar prints do PC (tela larga) e do celular, que mostram a
  versão em uso. Se a tela não tiver o que a versão nova deveria ter, ele provavelmente ainda não
  atualizou o aparelho. Avisar.

## 4. Como testar e publicar (comandos usados no PC)

**Verificações antes de publicar:**
```bash
npx tsc --noEmit -p .
```
```bash
npx vitest run
```
```bash
npm run build:webos
```
```bash
npx es-check es5 'dist-webos/**/*.js'
```

O que cada uma confere:
- **`tsc`:** os tipos do código.
- **`vitest`:** 113 testes na 0.34.3.
- **`build:webos` + `es-check`:** a versão da TV LG de 2017 (Chrome 38). Nela vale:
  - nada de CSS `gap`, `grid` ou variáveis;
  - `flex` sempre com os prefixos `-webkit-`;
  - JS final em ES5.

**Varredura de foco** (navegação pelo controle em todas as telas). Precisa do servidor falso e do
Vite rodando (veja abaixo):
```bash
NPMROOT="$(npm root -g)" CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node test/scan-foco.mjs
```
Deve terminar com "0 problemas" em todas as telas.

**Servidor falso e app de teste:**
- **Servidor Xtream falso:** `node test/fake-xtream.mjs`, na porta 8090, usuário `teste`, senha `1234`. Ele também tem:
  - ESPN falsa em `/espn/...` e TMDB falso em `/tmdb/...`;
  - atualizações em `/updates/` (com `UPDATE_DIR`);
  - ThePornDB falsa em `/tpdb/...`, com o token `tpdb-teste`;
  - a categoria **"ADULTOS +18"** (id 107), com títulos inventados para testar capas, atrizes (Ana Exemplo, Bia Modelo, Carla Teste e o ator Joao, que deve ficar de fora), produtoras (Vixen, [Tiny4K], Blacked.24…, Brasileirinhas) e a capa do OnlyFans ("Video Fans Especial Quinze").
- **App de teste:** `npx vite --port 5173`.
- **Apontar o app para a ThePornDB falsa:** no navegador de teste, gravar no `localStorage`:
  - `prisma.tpdbKey = "tpdb-teste"`;
  - `prisma.tpdbBase = "http://127.0.0.1:8090/tpdb"`.
- **Ligar os dois servidores pelo app do Claude:** `.claude/launch.json`, com as configurações
  "fake-xtream" (`node test/fake-xtream.mjs`, porta 8090) e "vite" (`npx vite --port 5173`). Esse
  arquivo não vai para o GitHub; se faltar, recrie-o com isso.

**Roteiros Playwright no PC:**
- Usam o **Edge** como navegador: `CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"`.
- O Playwright está instalado globalmente: `NPMROOT=$(npm root -g)` e
  `createRequire(process.env.NPMROOT + '/')('playwright')`.
- Segure as requisições de vídeo com `page.route(/\/live\//, () => {})`.
- Para logar: preencher `#f-server`, `#f-user` e `#f-pass` e clicar em "Entrar".

**Lição desta conta (evita bug):**
- Ao editar arquivos com scripts `node` dentro de comandos do terminal, as barras invertidas de
  expressões regulares somem (`/\s+/` vira `/s+/`). Isso aconteceu várias vezes.
- Para trechos com regex, use a ferramenta de edição de arquivo, ou escreva o script num arquivo
  `.cjs` antes de rodar.
- Depois, confira com `grep` se as barras continuam lá.

**Publicar** (só depois de "Sim, publique"):
1. Subir a versão em `package.json` e `webos/appinfo.json`.
2. Escrever as novidades no topo de `release-notes.md`; a primeira linha aparece no aviso de atualização.
3. Atualizar `docs/PRISMA-continuidade.md` com uma nova seção 10xx e a versão na seção 0.
4. Atualizar `docs/PENDENCIAS.md` ("Depende do Samuel"), `docs/COMECAR-NOVA-CONVERSA.md` e este arquivo (a versão).
5. Fazer o commit e publicar:
```bash
git pull --rebase -q && git push -q origin main && gh workflow run release.yml --repo xSam10-10/prisma --ref main
```
6. Acompanhar o build (pega o número do último run e espera terminar):
```bash
gh run watch "$(gh run list --repo xSam10-10/prisma --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')" --repo xSam10-10/prisma --exit-status
```
7. Conferir os arquivos da Release:
```bash
gh release view --repo xSam10-10/prisma --json tagName,assets -q '.tagName, (.assets[].name)'
```
A Release deve ter:
- **Windows:** `PRISMA-Setup-x.exe`, `.blockmap` e `latest.yml`;
- **TV LG:** `com.prisma.iptv_x_all.ipk` e `prisma-webos-x.json`;
- **Android:** `PRISMA-Android-x.apk`;
- **Roku:** `PRISMA-Roku-x.zip`;
- **manifesto:** `prisma-update.json`. Para ver a versão dentro dele:
```bash
gh release download --repo xSam10-10/prisma -p prisma-update.json -O -
```

Os outros workflows rodam sozinhos e não precisam de ação:
- **`tops.yml`:** 4×/dia, gera `prisma-tops.json`.
- **`sports.yml`:** a cada 2 h, gera `prisma-sports.json`.
- **`android.yml`:** build do Android.

## 5. O que foi feito na conta anterior (resumo de 0.31.0 a 0.34.3, em 11/11/2026)

Antes disso, a conta já tinha feito o resto do app (0.10.0 → 0.30.0: TV ao vivo, Filmes/Séries premium,
Tops, centro de esportes com F1, temas dos streamings, nuvem, ExoPlayer e Roku). Detalhes de cada
versão em `docs/PRISMA-continuidade.md`, seções 10b–10ar.

**0.31.0: capas oficiais da categoria de adultos e chaves pela nuvem.** Títulos adultos com capa genérica
(a mesma imagem em 3 ou mais títulos, ou nome de "sem imagem") buscam a capa na **ThePornDB**
(api.theporndb.net, token grátis do Samuel em Ajustes › Serviços), e o TMDB adulto fica como reserva.
As chaves TMDB e ThePornDB vão pela nuvem (Gist).

**0.31.1:** logotipos de Star+, Discovery+ e Hulu (enviados pelo Samuel).

**0.32.0: atrizes, senha com horário livre e correção das capas.**
- **Capas:** não atualizavam com o token. Três causas:
  - só buscava com a chave do TMDB;
  - capa quebrada não disparava a busca;
  - o "sem capa" antigo ficava guardado (o cache passou a incluir quais chaves existem).
- **Senha dos adultos:** a categoria pede senha só fora do **horário livre** (padrão: das 22:00 às 06:00,
  ajustável em Proteção › Horário livre; mudar o horário pede a senha). Fica em
  `src/core/parental.ts` (`freeHours`) e vai pela nuvem.
- **Filtro de atrizes:** só dentro da categoria de adultos, com fotos da ThePornDB e sem atores homens.

**0.33.0: mais capas e capa com a foto da atriz.**
- **Busca por nome parecido na ThePornDB:** o mesmo volume ou parte é obrigatório ("Grande Festa 10"
  acha "Grande Festa Vol. 10", mas o 11 não); aceita uma letra de diferença e recusa ano muito diferente.
- **Sem capa em lugar nenhum:** a capa vira a foto em pé da atriz, e a do título é a principal. Com mais
  de uma atriz, parar o controle ou o mouse 3 s na capa faz as fotos se revezarem a cada 3 s.

**0.34.0: produtoras e fileiras sem cortes.**
- **Fileiras sem carrossel:** a fileira de atrizes mostra só as que cabem (até 10), mais o botão
  **"Ver todas"**, que abre uma página com todas, em várias fileiras e com busca.
- **Filtro por produtora:** igual ao de atrizes, com logotipo da ThePornDB. A produtora é tirada do
  título ("Estúdio - Atriz - Título", "[Estúdio]", "Estudio.24.03.15.…" ou um nome conhecido no
  começo), e há uma lista `KNOWN` de produtoras famosas, incluindo Brasileirinhas.
- **Nome cortado no celular:** ao rolar a grade, as fileiras de filtro se recolhem
  (`VirtualGrid.onScrolled`).

**0.34.1:** filme com capa genérica usa a foto da atriz que o **filtro** achou no título. O filtro acha o
nome em qualquer lugar do título; a capa antes só reconhecia o formato "Estúdio - Atriz - Título".
Atrizes guardadas sem foto em pé são conferidas de novo.

**0.34.2: atualização automática e mais atrizes.**
- **Atualização automática:** o app confere ao abrir e a cada 6 h.
  - **TV LG e Windows:** baixa sozinho e avisa; vale ao reabrir, ou na hora pelo botão "Reabrir agora".
  - **Android:** "Atualizar agora" (o sistema exige a confirmação).
  - **Roku e navegador:** não se atualizam.
  - Liga e desliga em Ajustes › Sobre ("Atualizar sozinho ao abrir"). Vale para quem já está na 0.34.2 ou mais nova.
- **Produtoras:** "Ver todas" aparece sempre, e "FansDB: …" deixou de contar como produtora.
- **Mais atrizes:** títulos em MAIÚSCULAS são reconhecidos; nomes colados no título ("Kissa Sins Gets…")
  são conferidos quando se repetem; agora confere até 150 nomes e 250 títulos por abertura.

**0.34.3:** quando não há capa nem foto da atriz, a capa vira a imagem da página **"FansDB: Fulana"**
(OnlyFans). Ordem da capa nos adultos:
1. ThePornDB;
2. TMDB adulto;
3. foto da atriz;
4. imagem do OnlyFans;
5. capa genérica da lista.

**Arquivos principais da parte adulta:**
- **`src/core/tpdb.ts`:** cliente da ThePornDB. Busca `parse=` e `q=` (nome parecido com `similar`/`titlePart`), atrizes (`tpdbPerformer`, `toPerformer` exclui homens), produtoras (`tpdbSite`, `toStudio`) e OnlyFans (`fansOf`).
- **`src/core/tmdb.ts` › `adultInfo`:** a ordem das capas e o `actressCover`. Cache `adult5|…` em IndexedDB. Trocar o prefixo refaz as buscas na próxima abertura.
- **`src/core/actresses.ts`:**
  - `namesInTitle`, `leadNames` e `studiosOf`;
  - `buildActresses`: com token, o nome do título só entra se a ThePornDB confirmar; sem token, precisa aparecer em 2 ou mais títulos; uma atriz já conhecida ganha todos os títulos com o nome dela;
  - `namesToVerify` e `castByItem`.
- **`src/core/studios.ts`:** `studioInTitle`, `buildStudios`, `studiosToVerify` e `KNOWN`.
- **`src/screens/Actresses.tsx`:** `useAdultFilters` (enriquece os títulos e confere nomes na ThePornDB, 3 de cada vez, e guarda no IndexedDB `tpdbPerf`/`tpdbSite`), `FilterRow` (a fileira que cabe na tela) e `PickPage` ("Ver todas").
- **`src/screens/Vod.tsx`:** `PosterCard` (capa de atriz com revezamento e `fallbackCast`) e as fileiras na categoria adulta (`adultCat`).
- **`src/core/parental.ts`:** senha e horário livre.
- **Atualização automática:** `src/core/updater.ts` (`autoInstall`, `applyNow`) e `src/App.tsx` (o aviso).

## 6. O que falta

**Desenvolvimento:** nada pendente. O Samuel tirou da lista tudo o que restava das sugestões originais;
a lista de descartados está no topo de `docs/PENDENCIAS.md`.

**Testes que dependem do Samuel** (cópia de `docs/PENDENCIAS.md`):
- **0.34.4:** filmes e séries mostram Dublado/Legendado na capa e no detalhe; conferir se algum legendado aparece como Dublado (na Goldcard, sem marca = dublado) e mandar o nome. Em Jogos, o cartão da F1 em foco cabe na tela.
- **0.35.0:** abrir o app na TV, no celular e no PC e conferir: abre sem atraso, fontes iguais às de antes, canais HLS e .ts tocando por bastante tempo sem travar, guia aparece sem congelar a tela, Jogos e Ajustes abrindo normalmente. A "Lista de teste" não existe mais.
- **0.34.7:** na TV ao vivo, conferir os ícones do lote 2 (DAZN, CazéTV, GOAT, Max, NFL, UFC, Fórmula 1, Viva, TV Escola, Tooncast…); Central TV, TV Pampa e TV Clube estão marcados para revisar (contraste).
- **0.34.6:** na TV ao vivo, conferir os ícones novos (Globo, Record, Band, SBT, ESPN 1–6, HBO e HBO+, Telecine…) na TV e no celular; Sabor & Arte, CNN Brasil Money e Paramount+ estão marcados para revisar (contraste). Os canais HBO+ devem aparecer na categoria HBO.
- **0.34.5:** na categoria de adultos, filtrar por uma atriz com poucos filmes e descer para as capas: as fileiras de atrizes e produtoras somem e a capa aparece inteira; ▲ mostra os filtros de novo.
- **0.34.4:** em Ajustes › Serviços, tocar em "Mostrar" no campo da ThePornDB e ver o token; em Ajustes › Dados e limpeza, com a nuvem ligada, "Mostrar token" mostra o token do GitHub do aparelho.
- **0.34.3:** filme de cena "FansDB" sem capa nem foto da atriz deve mostrar a imagem do OnlyFans.
- **0.34.2:** abrir o PRISMA na TV/Windows numa versão antiga e ver o aviso "baixado"; no Android,
  "Atualizar agora". Ver se a lista de atrizes cresce a cada abertura (eram 37 atrizes em 10.119 títulos
  na 0.34.0).
- **0.34.1:** filtrar a "Kissa Sins" de novo; os 2 filmes genéricos devem mostrar a foto dela.
- **0.34.0:** fileira de atrizes sem cortes com "Ver todas"; filtro por produtora com logotipos na lista
  real; no celular, rolar a lista e ver as fileiras se recolherem.
- **0.33.0:** mais capas (nome parecido) e capa com a foto da atriz, trocando após 3 s.
- **0.32.0:** senha da categoria adulta antes das 22:00 e sem senha depois.
- **0.30.0:**
  - criar o token do GitHub (só "gist") e ligar a nuvem em cada aparelho;
  - Android: player novo (ExoPlayer) em filmes e séries;
  - Roku: instalar o PRISMA-Roku pelo modo desenvolvedor (`roku/LEIAME.md`).
- **Jogos com a Goldcard:** canais dos jogos e da F1 no guia, placar na tela.
- **Atualização dentro do app na TV LG e no Android:** conferir uma vez (no Windows já funciona).
- **TV LG OLED B7 (webOS 3.5) e celular/Google TV:** vídeo, PIP com 2 telas, placar, banners dos streamings.

**Ideias guardadas** (só se o Samuel pedir):
- Jogos: manchetes e mais ligas (Série B, Estaduais, NBA).
- Roku: guia, favoritos e o visual do app principal.
- Adultos:
  - **Se a lista real mostrar padrões de título que não reconhecemos:** pedir ao Samuel alguns nomes exatos de filmes e ajustar `namesInTitle`/`studioInTitle`.
  - **Se a ThePornDB começar a limitar as buscas:** diminuir `ENRICH` (250) e o número de nomes conferidos por vez (150) em `Actresses.tsx`.

## 7. O que continua funcionando sozinho (não depende da conta do Claude)

- **Atualização dentro do app:** lê as Releases públicas do GitHub; desde a 0.34.2 é automática.
- **Tops e esportes:** gerados pelos workflows `tops.yml` e `sports.yml`.
- **Secrets do GitHub:** `TMDB_KEY` e a assinatura do Android.
- **Dados de cada aparelho:** favoritos, perfis, progresso, senha e chaves. Com a nuvem ligada, também
  ficam no Gist privado do Samuel.

## 8. Se algo der errado

- **"Não consigo dar push / publicar":**
  - no PC: `gh auth status`, ou `gh auth login` com a conta dona do repositório;
  - na nuvem: refazer a seção 1, opção B.
- **A conversa não achou alguma informação:** "está em docs/MIGRAR-CONTA.md, docs/PRISMA-continuidade.md e
  docs/PENDENCIAS.md".
- **Cópia de segurança extra:** no GitHub, botão verde **Code › Download ZIP**.
