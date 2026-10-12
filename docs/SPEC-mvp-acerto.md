# SPEC: MVP "Meu acerto" (caixa de um motoboy)

## Objetivo
App de celular para o Felipe (motoboy) lançar as próprias comandas durante a noite e ter a conta do acerto pronta quando voltar à pizzaria. No fim da noite ele compara com o acerto feito pelo Luan. Serve para validar a conta e o fluxo de o motoboy lançar as comandas, antes de levar o sistema para o Luan e os outros motoboys.

## Escopo
Dentro:
- Uma noite aberta por vez (abrir, lançar, conferir, fechar) e histórico das noites.
- Lançar a comanda ao pegar a entrega; na porta, marcar entregue (confirmando ou trocando a forma de pagamento) ou voltou.
- Conta do acerto em tempo real.
- Conferência: dinheiro contado, falta ou sobra, valor a receber.
- Comparação com o acerto feito pelo Luan.
- Ajustes: áreas e taxas, caixa e diária padrão.
- Backup: exportar e importar JSON.

Fora (não construir agora): outros motoboys, tela do Luan, despacho, status do Pix vindo do Luan, crédito de cliente, cobrança em dobro, retiradas, login, nuvem.

## Stack
- Vite + React + TypeScript, PWA instalável que funciona offline (vite-plugin-pwa).
- Dados no aparelho, em IndexedDB (Dexie), atrás de uma interface em `src/data/repo.ts`. Na próxima versão a implementação troca para Supabase sem mexer nas telas.
- Pedir `navigator.storage.persist()` na primeira abertura.
- Regras e cálculo em `src/domain/` (funções puras), com testes em Vitest.
- Deploy na Vercel.
- Dinheiro sempre em centavos (inteiro). Exibir como `R$ 1.234,56`.

## Regras de negócio
- **R1 Comanda.** Identificada pelo código de 4 dígitos (final do telefone do cliente). O código pode repetir na noite: se já existe um com status diferente de "voltou", avisar e pedir um segundo toque para lançar.
- **R2 Total.** O total da comanda já inclui a taxa de entrega. Total menor que a taxa da área é bloqueado.
- **R3 Taxa.** Por área, em tabela editável: Aragarças 5, Pontal 10, Barra 12, Parque de Exposições 15. O motoboy recebe a mesma taxa que o cliente paga. A taxa é gravada na comanda no lançamento; mudar a tabela não altera comandas já lançadas.
- **R4 Formas de pagamento.** Dinheiro, cartão, Pix na máquina, Pix antecipado. Uma comanda pode ter várias partes (pagamento misto); a soma das partes é igual ao total.
- **R5 Troco por Pix.** O cliente pagou em dinheiro a mais e a pizzaria devolveu a diferença por Pix. Esse valor fica com o motoboy e entra no dinheiro a devolver. Só existe se a comanda tiver parte em dinheiro.
- **R6 Status.** `em_rota` ao lançar, depois `entregue` ou `voltou`. Comanda que voltou: a taxa conta, os valores não. Comanda ainda em rota no fechamento conta como entregue, mas o app avisa antes de fechar.
- **R7 Saiu de novo.** Pedido que voltou e sai outra vez vira uma comanda nova, com o mesmo código, e gera outra taxa.
- **R8 Caixa inicial.** R$ 80 por padrão, editável na noite. É devolvido no acerto.
- **R9 Diária.** R$ 30 por padrão, editável na noite.
- **R10 Acerto.** O motoboy devolve todo o dinheiro (caixa + recebido) e recebe à parte, em dinheiro, diária + taxas.
- **R11 Falta e sobra.** Falta é descontada do que ele recebe; se passar disso, ele completa do bolso. Sobra fica retida (não é dele) até descobrir a origem.
- **R12 Pix antecipado.** Não passa pela mão do motoboy; só a taxa conta.
- **R13 Data da noite.** O turno vai das 18h à meia-noite. Noite aberta entre 00h e 06h fica com a data do dia anterior.

## Cálculo: `src/domain/acerto.ts`
```
entregues     = comandas com status ≠ voltou   (em_rota conta como entregue)
dinheiro      = Σ partes em dinheiro das entregues
troco         = Σ troco das entregues que têm parte em dinheiro
cartao        = Σ partes em cartão das entregues
pixMaquina    = Σ partes em Pix na máquina das entregues
pixAntecipado = Σ partes em Pix antecipado das entregues
taxas         = Σ taxa de todas as comandas, inclusive as que voltaram

devolver   = caixaInicial + dinheiro + troco
maquininha = cartao + pixMaquina
receber    = diaria + taxas

se dinheiroContado foi informado:
  dif      = dinheiroContado − devolver
  falta    = max(0, −dif)
  sobra    = max(0, dif)
  pagar    = max(0, receber − falta)
  completa = max(0, falta − receber)
```

## Casos de teste (R$; caixa 80, diária 30)
Noite base:

| Código | Total | Área | Pagamento | Extra |
|---|---|---|---|---|
| 3557 | 113 | Barra | dinheiro | |
| 0017 | 60 | Aragarças | Pix antecipado | |
| 2672 | 90 | Pontal | cartão | |
| 0910 | 72 | Barra | Pix na máquina | |
| 3595 | 47 | Aragarças | dinheiro | troco 3 |
| 8094 | 65 | Barra | dinheiro | voltou |

- **T1** Base: devolver 243, maquininha 162, receber 86, pixAntecipado 60.
- **T2** Base + contado 240: falta 3, pagar 83.
- **T3** Base + contado 243: bate, pagar 86.
- **T4** Base + contado 250: sobra 7, pagar 86.
- **T5** Base + contado 140: falta 103, pagar 0, completa 17.
- **T6** Base + comanda 1234, total 50, Pontal, 20 Pix antecipado + 30 dinheiro: devolver 273, maquininha 162, receber 96, pixAntecipado 80.
- **T7** Base + 8094 saiu de novo com ele (nova comanda 8094, 65, Barra, dinheiro, entregue): devolver 308, receber 98.
- **T8** Base, depois a taxa de Barra muda para 13: receber continua 86.
- **T9** Pagamento misto cuja soma difere do total: lançamento bloqueado com mensagem.

## Telas (celular, uso com uma mão, botões de 44px ou mais)
1. **Noite** (tela principal)
   - Sem noite aberta: botão "Abrir noite", com data, caixa e diária preenchidos e editáveis.
   - Barra fixa no topo com os três números: Devolver, Maquininha, Receber.
   - Formulário "Lançar comanda": código (teclado numérico, 4 dígitos, pula para o total), total, área (chips com a taxa), forma prevista (chips). Link "Pagou de mais de um jeito" abre linhas de forma + valor; uma linha vazia fica com o resto. Troco por Pix aparece só se houver dinheiro. A comanda entra como em rota.
   - Lista "Em rota", cada comanda com três ações: **Entregue** (mantém a forma prevista), **Trocou a forma** (abre as formas e a divisão), **Voltou**.
   - Listas "Entregues" e "Voltaram". Tocar abre editar ou excluir (excluir com dois toques). Comanda que voltou tem a ação **Saiu de novo**, que cria a cópia em rota.
2. **Acerto**
   - Conta detalhada, mostrando de onde vem cada número (ex.: "80 de caixa + 160 em dinheiro + 3 de troco por Pix").
   - Lista do que a maquininha deve mostrar (hora da entrega, código, forma, valor), separada em cartão e Pix na máquina com o total de cada, em ordem de horário, para bater com o relatório. Cada linha é marcada como conferida quando o comprovante impresso é achado.
   - Dinheiro contado: bate, falta ou sobra; quanto receber; quanto completar.
   - Comparação com o Luan: "Quanto o Luan te pagou", "Falta ou sobra que o Luan achou", tempo do acerto em minutos e observação. Mostrar se bateu com o app.
   - Fechar a noite (avisa se há comanda em rota). Noite fechada fica só para leitura, com botão "Reabrir".
3. **Histórico**: lista de noites com data, número de comandas, devolver, receber, pago e um selo "bateu com o Luan" ou "diferença de R$ x". Abrir uma noite antiga em modo leitura. Exportar e importar JSON (importar substitui tudo, com dois toques).
4. **Ajustes**: áreas e taxas (adicionar, editar, desativar) e valores padrão de caixa e diária.

Sem `alert` e `confirm`: confirmações com dois toques. Textos curtos, em português do Brasil.

## Modelo de dados (já no formato das tabelas do Supabase)
```ts
type Forma = 'dinheiro' | 'cartao' | 'pix_maquina' | 'pix_antecipado'
type Status = 'em_rota' | 'entregue' | 'voltou'

interface Area { id: string; nome: string; taxa: number; ativa: boolean }

interface Noite {
  id: string; data: string            // YYYY-MM-DD
  caixaInicial: number; diaria: number
  dinheiroContado: number | null
  fechadaEm: string | null
  luanPagou: number | null
  luanDiferenca: number | null        // negativo = falta, positivo = sobra
  minutosAcerto: number | null
  obs: string
}

interface Pagamento { forma: Forma; valor: number; conferido?: boolean }  // comprovante conferido no acerto

interface Comanda {
  id: string; noiteId: string; codigo: string
  total: number; areaId: string; taxa: number
  status: Status; troco: number
  pagamentos: Pagamento[]
  criadaEm: string; atualizadaEm: string
  finalizadaEm: string | null         // hora em que foi marcada entregue (ou voltou)
}
```
Na versão com Supabase entram `motoboy_id` em `noites` e uma tabela `pagamentos`.

## Ordem de construção
1. Projeto (Vite + React + TS + PWA), tipos e `acerto.ts`, com T1 a T9 passando.
2. Repositório local (Dexie) e abrir/fechar noite.
3. Lançar comanda, com pagamento dividido, e as listas.
4. Ações em rota (entregue, trocou, voltou, saiu de novo) e edição.
5. Tela de acerto, conferência e comparação com o Luan.
6. Histórico, exportar e importar.
7. Ajustes. Deploy na Vercel e instalação no celular.

## Pronto quando
- T1 a T9 passam.
- Funciona em modo avião e mantém os dados ao fechar e abrir o app.
- Dá para lançar uma comanda em menos de 15 segundos, com uma mão.
- A conta de uma noite real bate com o acerto feito pelo Luan, ou a diferença tem explicação anotada.
