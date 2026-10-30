---
name: trabalhador-flatt
description: Delega trabalho braçal a um trabalhador barato (outro Claude Code, com o modelo qwen3.8-27b da flatt) - ler e resumir arquivos grandes, buscas pelo código, edições mecânicas e repetitivas, rascunho de código ou de testes seguindo um padrão que já existe. Use quando a tarefa for clara e der para conferir o resultado; o plano, as decisões e a revisão ficam com você.
---

# Trabalhador flatt

Você é a mente; o trabalhador faz o braçal. Ele é outro Claude Code, no mesmo diretório, com o modelo `qwen3.8-27b` da flatt, e lê o `CLAUDE.md` do projeto. Lê, busca e edita arquivos (Read, Glob, Grep, Edit, Write); não roda comandos.

## Como chamar

Da raiz do projeto, com `timeout` 600000 (tarefa grande: `run_in_background`):

```bash
node .claude/skills/trabalhador-flatt/flatt.mjs <<'TAREFA'
<a tarefa completa>
TAREFA
```

- O trabalhador não vê esta conversa. Diga os arquivos, o que mudar, a regra do projeto que importa e como responder (curto).
- Uma tarefa por chamada, pequena e verificável. Tarefas independentes que não mexem nos mesmos arquivos podem ir em paralelo.
- A chave vem de `FLATT_API_KEY` (variável do ambiente de nuvem ou do computador). Sem ela, o script avisa: faça você mesmo.

## Depois

- Confira sempre: `git diff`, `npm test` e `npm run lint`. Ele erra mais que você.
- Errou: corrija você ou mande de novo com instrução mais precisa.
- Não delegue decisão de arquitetura, regra de acesso (RLS), conta de dinheiro em `src/domain/` sem teste nem nada com segredo.
- Falhou (503, demora, resposta vazia): a flatt às vezes cai; faça você mesmo.
