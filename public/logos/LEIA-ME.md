# Logotipos do PRISMA

Ordem de prioridade (veja `src/core/logos.ts`):

1. `custom/` — logos escolhidos pelo usuário. `custom/meus-logos.json` liga o nome do canal ao arquivo:
   `{ "globo sp": "globo-sp.png", "sportv 2": "sportv2.png" }`
   O nome é comparado sem acentos, maiúsculas, símbolos e marcas de qualidade (HD, FHD, 4K, H265, [ALT]…),
   então um logo vale para todas as versões do canal.
2. `br/` — logos oficiais do projeto [tv-logo/tv-logos](https://github.com/tv-logo/tv-logos) (pasta countries/brazil),
   livres para uso pessoal (CC BY-SA / CC BY-NC-SA; marcas pertencem aos donos). `br/catalogo.json` é gerado dos nomes dos arquivos.
3. O logo que veio na lista IPTV.
4. Iniciais do canal.
