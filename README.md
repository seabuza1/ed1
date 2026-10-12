# Meu acerto

App de celular (PWA offline) para o motoboy lançar as comandas da noite e ter a conta do acerto pronta. Veja `CLAUDE.md` e `docs/SPEC-mvp-acerto.md`.

```sh
npm install
npm run dev     # desenvolvimento
npm test        # testes (cálculo T1 a T9, regras, repositório)
npm run build   # build de produção com service worker (pasta dist)
```

## Estrutura
- `src/domain/`: regras e contas, funções puras com testes (`acerto.ts`, `comanda.ts`, `noite.ts`, `backup.ts`, `ajustes.ts`).
- `src/data/repo.ts`: interface de dados; hoje IndexedDB (`repoLocal.ts`, Dexie), depois Supabase.
- `src/telas/` e `src/ui/`: telas e componentes. Não fazem conta.

## Deploy (Vercel)
Endereço: **https://acerto-motoboy.vercel.app** (projeto `acerto-motoboy`, ligado a este repositório).

Projeto Vite: a Vercel detecta sozinha (build `npm run build`, saída `dist`). A branch de produção é `main`: o que entra na `main` vai para o endereço acima; outras branches geram prévias.

## Instalar no celular (Android, Chrome)
1. Abra o endereço do app no Chrome.
2. Menu ⋮ → **Instalar app** (ou **Adicionar à tela inicial**).
3. Abra uma vez com internet; depois funciona em modo avião.

No iPhone (Safari): Compartilhar → **Adicionar à Tela de Início**.

Os dados ficam só no aparelho. Exporte o backup no Histórico de vez em quando; os arquivos `acerto-backup-*.json` não vão para o repositório.
