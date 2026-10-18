# SPEC v1: nuvem, painel do Luan e acerto mais fácil

Parte do MVP que já roda (`docs/SPEC-mvp-acerto.md`). Esta spec descreve só o que muda.

## O que entra
1. Layout mais limpo e lançamento com menos toques.
2. Entregas por cidade (na noite e no histórico).
3. Conferência de comandas, para achar comanda perdida.
4. Liquidação: como o Luan paga o motoboy e o que sai do caixa da empresa.
5. Nuvem (Supabase) com login, continuando a funcionar offline.
6. Painel do Luan: a folha da noite em tempo real, no formato da folha de papel, e a confirmação do acerto.
7. Coluna PIX: o Luan marca que o Pix caiu e o motoboy vê (última etapa).

Fora: lançamento do pedido pelo atendente, cozinha, crédito de cliente, cobrança em dobro, retiradas.

## Regras novas
- **R14 Liquidação.** O Luan paga o motoboy primeiro com o caixa inicial dele (o troco dado no começo da noite). O que passar disso sai do caixa da empresa e fica registrado como retirada. Ex.: caixa de R$ 75 e R$ 170 a receber → R$ 75 do caixa dele e R$ 95 retirados do caixa da empresa. Se o valor a receber for menor que o caixa, o resto do caixa vai para a empresa, junto com o dinheiro das vendas.
- **R15 Acerto confirmado.** Só a expedição (Luan) ou o admin confirma. A confirmação grava os valores do momento e trava o caixa e as comandas para o motoboy. Reabrir é do admin.
- **R16 Papel conferido.** No acerto, cada comanda pode ser marcada como "papel conferido". As não marcadas aparecem como possivelmente perdidas, com todos os dados para refazer (código, total, área, formas, troco, hora).
- **R17 Entregas por cidade.** Por área: entregues, que voltaram e taxas (a taxa conta também nas que voltaram).
- **R18 Papéis.** `motoboy`: vê e edita só os próprios caixas, até o acerto ser confirmado. `expedicao` (Luan): vê todos, confirma acertos, marca Pix e papel. `admin`: tudo, inclusive áreas e perfis.

## Cálculo: acrescentar em `src/domain/acerto.ts`
Depois de `pagar` e `completa`, que já existem:
```
doCaixaDele          = min(caixaInicial, pagar, contado)
retiradoCaixaEmpresa = pagar − doCaixaDele        // o Luan tira do caixa da empresa
vaiParaEmpresa       = contado − doCaixaDele + completa
porArea[área]        = { entregues, voltaram, taxas }
papelFaltando        = comandas com papelConferido = false
```
Conferência: `vaiParaEmpresa − retiradoCaixaEmpresa = devolver − receber + sobra` quando não há falta.

## Casos de teste novos (R$; base e T1 a T9 do MVP continuam valendo)
- **T10** Caixa inicial 75, diária 30. Comandas, todas no cartão: 10 em Barra de 50, 2 em Aragarças de 40, 1 em Pontal de 30. Contado 75 → devolver 75, maquininha 610, receber 170, pagar 170, doCaixaDele 75, retiradoCaixaEmpresa 95, vaiParaEmpresa 0.
- **T11** Base + contado 243 → pagar 86, doCaixaDele 80, retiradoCaixaEmpresa 6, vaiParaEmpresa 163.
- **T12** Base + contado 240 → falta 3, pagar 83, doCaixaDele 80, retiradoCaixaEmpresa 3, vaiParaEmpresa 160.
- **T13** Base + contado 140 → falta 103, pagar 0, completa 17, doCaixaDele 0, retiradoCaixaEmpresa 0, vaiParaEmpresa 157.
- **T14** Base + contado 250 → sobra 7, pagar 86, doCaixaDele 80, retiradoCaixaEmpresa 6, vaiParaEmpresa 170.
- **T15** Caixa 80, diária 30, uma comanda em Aragarças de 40 em dinheiro, contado 120 → receber 35, pagar 35, doCaixaDele 35, retiradoCaixaEmpresa 0, vaiParaEmpresa 85.
- **T16** Base → porArea: Barra 2 entregues e 1 voltou, taxas 36; Aragarças 2, taxas 10; Pontal 1, taxas 10.
- **T17** Base com papel conferido em todas menos 2672 → papelFaltando = [2672].

## Lançar com menos toques
- Tocar na forma de pagamento já lança a comanda, se código, total e área estiverem certos. Aparece "3557 lançada · Desfazer" por 5 segundos. O botão Lançar fica para o pagamento dividido.
- Área sugerida: se o código já apareceu antes (histórico do motoboy ou da pizzaria), a área do último pedido vem marcada.
- O total aceita "113" como R$ 113,00.
- Troco por Pix e "Pagou de mais de um jeito" ficam em "Mais opções".
- Na lista: "Entregue" com um toque; "Trocou a forma" e "Voltou" num menu da comanda. Desfazer no lugar de confirmar.
- Busca por código na noite.

## Layout limpo
- Barra inferior com 3 abas: Noite, Acerto, Histórico. Ajustes e Sair num ícone dentro do Histórico.
- Topo fino e fixo com Devolver, Maquininha e Receber.
- Uma ação principal por tela; o resto em link ou menu.
- Lista sem cartões: código grande à esquerda, área e forma em cinza, valor à direita; o status por cor e ícone.
- Tema escuro seguindo o sistema, com opção manual (o turno é à noite). Contraste alto e números em fonte mono tabular.
- Botões de 48px, alcançáveis com o polegar.

## Nuvem e offline
- Supabase: Postgres, Auth com e-mail e senha, Realtime. Tabelas, regras de acesso e realtime em `supabase/001_schema.sql`: rodar uma vez no SQL Editor. A conta nova vira motoboy; os papéis do admin e do Luan são definidos com os `update` do fim do arquivo.
- No cadastro, mandar o nome em `options.data.nome`.
- Local-first: toda alteração grava no IndexedDB e entra numa fila que sobe quando há internet. Indicador discreto: "Salvo na nuvem" ou "3 alterações esperando internet".
- IDs gerados no aparelho (uuid). Em conflito vale a última alteração (`atualizado_em`).
- Realtime em `caixas`, `comandas` e `acertos`: o painel do Luan atualiza sozinho, e o motoboy recebe o Pix confirmado e o acerto confirmado.
- Primeiro login: se houver dados da versão local, oferecer "Enviar meu histórico para a nuvem" (noites viram `caixas`; os campos de comparação com o Luan vão para `obs`).
- Trocar só a implementação de `src/data/repo.ts`; as telas não mudam por causa da nuvem.
- `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. A service role nunca vai para o front.

## Telas do motoboy (mudanças)
- **Noite:** layout novo; a comanda com Pix antecipado mostra "Pix confirmado" quando o Luan marcar.
- **Acerto:** entregas por cidade; conferência de papéis; liquidação ("do seu caixa", "o Luan tira do caixa da empresa", "vai para a empresa"); estado "Aguardando o Luan" ou "Confirmado por Luan às 23:48".
- **Histórico:** por noite e por período (semana e mês): noites trabalhadas, entregas por cidade, diárias, taxas e total recebido.

## Painel do Luan (rota `/painel`, só expedicao e admin)
**Folha da noite**, no formato da folha de papel:
```
 1 Felipe          2 João            PIX
 ─────────────     ─────────────     ──────────────
 3557  din         8498  pix+din     0017  caiu ✓
 0017  pix         1693  cartão      8498  conferir
 2672  cartão
 3595  din →3,00
 8094  voltou      (riscado)
 ─────────────     ─────────────
 16/10 · 80,00     16/10 · 80,00
 6 entregas        2 entregas
 Devolve 243,00    Devolve 117,00
 Recebe   86,00    Recebe   57,00
 Pendente          Pendente
```
- Uma coluna por motoboy, na ordem de chegada. No celular as colunas rolam para o lado; em tela maior ficam lado a lado.
- Cada código mostra a forma e o status (em rota, entregue, riscado se voltou), com "→ valor" para troco por Pix e "•" para papel não conferido depois de aberto o acerto.
- Coluna PIX com todos os Pix antecipados da noite; tocar marca "caiu" (`pix_confirmado`).
- Rodapé de cada coluna: data e caixa inicial, entregas, devolver, receber e estado do acerto.
- Tudo em tempo real.

**Caixa do motoboy** (tocar na coluna): conta completa, entregas por cidade, lista da maquininha, conferência de papéis (marcar cada comanda recebida; as faltando ficam no topo) e o dinheiro contado. Mostra a liquidação: "Pague R$ 75,00 do caixa dele e retire R$ 95,00 do caixa da empresa". O botão "Confirmar acerto" grava em `acertos` e trava o caixa.

**Resumo da noite:** recebido por forma de pagamento, total pago aos motoboys, total retirado do caixa da empresa, total que foi para a empresa, faltas, sobras e entregas por cidade.

## Ordem de construção
1. Cálculo novo, com T10 a T17 passando.
2. Layout limpo e lançamento com menos toques, ainda local.
3. Entregas por cidade, conferência de papéis e liquidação nas telas.
4. Supabase: rodar o SQL, login, repositório na nuvem com fila offline e envio do histórico local.
5. Painel do Luan: folha em tempo real, caixa do motoboy, confirmar acerto e resumo da noite.
6. Coluna PIX com "caiu" e aviso no app do motoboy.
7. Histórico por período.

## Pronto quando
- T1 a T17 passam.
- Em modo avião o motoboy lança e marca entregas; quando a internet volta, tudo sobe sozinho.
- O painel do Luan mostra uma comanda nova em poucos segundos.
- Um motoboy não vê o caixa de outro (testar com duas contas).
- Depois do acerto confirmado, o motoboy não edita o caixa nem as comandas.
- Uma noite real confirmada pelo Luan bate com o dinheiro na mão.
