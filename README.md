# PRISMA — app (Fase 1)

Player de IPTV para uso pessoal. Lê a lista que você assina (Xtream ou M3U) e mostra os canais no visual da **estrutura A** (v2).

## O que já funciona (Fase 1 · passos 1 e 2)

| Parte | Situação |
|---|---|
| Lista **Xtream** (IPTV Smarters / XCIPTV): servidor + usuário + senha | ✅ login, conta vencida ou senha errada, validade, telas simultâneas |
| Lista **M3U / M3U8 / SS IPTV** por link ou arquivo | ✅ `tvg-*`, `group-title`, `#EXTGRP`, `#EXTVLCOPT`, `url\|User-Agent=…`, endereços relativos |
| Link `get.php?username=…` | ✅ vira Xtream automaticamente (guia e categorias melhores) |
| Canal repetido na lista | ✅ vira **fonte 2** do mesmo canal |
| **Player** HLS (hls.js), MPEG-TS (mpegts.js) e MP4 nativo | ✅ prévia → tela cheia com o mesmo vídeo, sem recarregar |
| Canal fora do ar | ✅ tenta as outras fontes sozinho; depois mostra "Tentar de novo / Próximo canal" |
| Controle remoto | ✅ setas (foco espacial), OK, Voltar (LG 461 / Esc), Canal +/−, números para ir direto |
| Ao vivo (estrutura A) | ✅ categorias, favoritos, lista com milhares de canais (virtual), prévia, "A seguir" |
| Guia agora / a seguir | ✅ pela API Xtream · ⏳ XMLTV completo (passo 3) |
| Início, Busca, Ajustes › Lista | ✅ versão simples |
| Filmes, Séries, Anime, Jogos, Minha lista | ⏳ telas "em breve" (passos 3–5) |

## Rodar no computador

```bash
npm install
npm run dev          # http://127.0.0.1:5173  (com o proxy das listas)
```

Para usar no dia a dia (versão compilada):

```bash
npm run build
npm run serve        # http://127.0.0.1:4173
```

No navegador as listas IPTV não liberam CORS, então o app pede tudo ao **proxy local** (`server/proxy.mjs`), que também reescreve as playlists HLS. Para abrir de outro aparelho da casa: `HOST=0.0.0.0 npm run serve`.

## Instalar na TV LG (webOS)

```bash
npm run build:webos                     # gera dist-webos/ (com appinfo.json e ícones)
npm install -g @webos-tools/cli         # uma vez
ares-setup-device                       # cadastra a TV (modo desenvolvedor ligado na TV)
ares-package dist-webos                 # gera com.prisma.iptv_0.1.0_all.ipk
ares-install --device tv com.prisma.iptv_0.1.0_all.ipk
ares-launch --device tv com.prisma.iptv
```

Na TV o app acessa a lista direto (sem proxy). O build usa só scripts "legacy" porque módulos ES não carregam via `file://`.

> **Compatibilidade:** o layout usa `gap` em flexbox, que precisa de Chromium 84+ — TVs LG **webOS 22 (2022) ou mais novas**. Em TVs mais antigas o app abre, mas os espaçamentos podem sair errados. Se a sua TV for anterior a 2022, me avise que eu troco o `gap` por margens.

## Testar sem a lista real

- **Lista de teste** (na tela "Adicione a sua lista"): 6 canais gerados localmente, um fora do ar e um com fonte 2.
- **Xtream falso:** `node test/fake-xtream.mjs` → servidor `127.0.0.1:8090`, usuário `teste`, senha `1234` (407 canais, guia, canal quebrado).
- Testes do leitor de listas: `npm test`.

## Estrutura

```
src/core/     m3u.ts (leitor M3U) · xtream.ts (API Xtream) · source.ts (carga única)
              engine.ts (hls.js / mpegts.js / nativo) · epg.ts · net.ts (proxy) · storage.ts (IndexedDB)
src/ui/       nav.ts (foco espacial / controle) · VirtualList.tsx · bits.tsx (logo, ícones)
src/screens/  AddList · LiveTV · Player · Other (Início, Busca, Ajustes, Em breve)
server/       proxy.mjs · serve.mjs
webos/        appinfo.json + ícones da LG
```

## Próximos passos

3. Guia XMLTV completo (listas M3U com `url-tvg`) e grade por dia
4. Filmes / Séries / Anime + TMDB + mapeamento de streamings + Minha lista
5. Estruturas B e C, temas Prisma/Netflix, Ajustes › Aparência, perfis
6. Android / Android TV (Capacitor), depois Roku
