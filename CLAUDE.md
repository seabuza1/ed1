# Acerto dos motoboys

Sistema para a pizzaria onde trabalho como motoboy, construído aos poucos. Agora: MVP do acerto de um motoboy só (o meu), usado por mim no celular.

## Docs
- `docs/SPEC-mvp-acerto.md`: o que construir agora (escopo, regras, cálculo, testes, telas, ordem).
- `docs/requisitos.md`: levantamento completo da operação. Só contexto: não implementar nada fora da spec.

## Stack
Vite + React + TypeScript, PWA offline. Dados em IndexedDB (Dexie) atrás de `src/data/repo.ts`, para trocar por Supabase depois. Testes com Vitest. Deploy na Vercel.

## Convenções
- Dinheiro sempre em centavos (inteiro). Exibir como `R$ 1.234,56`.
- Regras e contas só em `src/domain/`, em funções puras e testadas. Telas não fazem conta.
- Interface em português do Brasil, mobile-first, botões de 44px ou mais, uso com uma mão.
- Sem `alert`/`confirm`: confirmação com dois toques.
- Backups `.json` ficam fora do repositório (`.gitignore`).
- Respostas e resumos curtos.

## Glossário
- **comanda**: pedido em papel, identificado pelos 4 últimos dígitos do telefone do cliente.
- **acerto**: fechamento do caixa do motoboy com o Luan no fim da noite.
- **caixa**: R$ 80 de troco que o motoboy leva e devolve.
- **diária**: R$ 30 por noite trabalhada.
- **taxa**: valor da entrega por cidade ou área; o motoboy recebe a mesma taxa que o cliente paga.
- **Pix antecipado**: o cliente pagou antes; não passa pela mão do motoboy.
- **troco por Pix**: o cliente pagou em dinheiro a mais e a pizzaria devolveu a diferença por Pix.
