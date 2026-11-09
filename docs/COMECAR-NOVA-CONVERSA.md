# Como continuar o PRISMA numa nova conversa

Este arquivo existe para trocar de conversa sem perder nada. Tudo o que importa está no repositório
**xSam10-10/prisma** (branch `main`), que a nova conversa lê sozinha.

## 1. Abrir a nova conversa
1. Abra o Claude Code (no app ou em claude.ai/code) e comece uma **nova sessão na nuvem**.
2. Escolha o repositório **xSam10-10/prisma** (branch `main`).
3. Cole a mensagem do item 2 abaixo como a primeira mensagem.

## 2. Mensagem para colar (primeira mensagem da nova conversa)

> Vamos continuar o projeto PRISMA (meu player de IPTV). Antes de qualquer coisa, leia `docs/PRISMA-continuidade.md` (comece pela seção 0), `docs/PENDENCIAS.md` e `release-notes.md`, e confirme que entendeu: o estado atual (versão 0.24.3), como publicar uma versão (workflow `release.yml`), as verificações antes de publicar e o servidor falso de testes (`test/fake-xtream.mjs`).
>
> Regras: responda sempre em português; os dados da minha assinatura Goldcard eu passo por aqui quando precisar — nunca grave nenhuma credencial no repositório; a chave do TMDB fica só no secret `TMDB_KEY`.
>
> O próximo trabalho é o novo "centro de esportes" da aba Jogos (ligas com tema próprio e Fórmula 1), descrito em `docs/PENDENCIAS.md`, seção 5. Ainda não implemente: primeiro me faça as perguntas em aberto dessa seção.

## 3. O que já está guardado no repositório
- `docs/PRISMA-continuidade.md` — história completa, arquitetura, como publicar e testar (seção 0 = resumo atual; seções 10x = o que entrou em cada versão).
- `docs/PENDENCIAS.md` — o que falta, por categoria, com prioridades; a **seção 5** tem a proposta da aba Jogos; no topo, as sugestões de design que você descartou.
- `release-notes.md` — novidades de cada versão (a de cima aparece no aviso de atualização do app).

## 4. Depois de abrir
- A nova conversa vai responder com um resumo e as perguntas da seção 5 de Jogos:
  ordem das ligas, se entra o Brasileirão, F1 no Início e notícias. Responda e diga "pode fazer".
- Se ela não achar algo, diga: "está em docs/PRISMA-continuidade.md e docs/PENDENCIAS.md".
