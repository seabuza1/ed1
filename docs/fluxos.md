# Fluxos entre o celular e o painel

Os três caminhos que cruzam o app do motoboy e o painel do Luan. Os dois lados nunca se chamam: se encontram no Supabase. Funções pelo nome (os números de linha mudam).

O que os dois lados têm em comum:
- as tabelas `comandas`, `leituras` e `acertos` e o bucket `comandas`;
- `src/data/nuvem/linhas.ts`, que traduz linha do banco ↔ objeto do app nos dois lados (mudar uma coluna ali afeta os dois);
- `calcularAcerto()` (`src/domain/acerto.ts`): a mesma conta no celular e no painel.

## 1. Da foto à folha (motoboy → Luan)

No celular:
1. **Foto.** `tirarFoto()` (`src/telas/LancarComanda.tsx`) reduz para 1600 px e mede a nitidez (`prepararFoto()`, `src/ui/foto.ts`); tremida pede outra.
2. **Leitura.** `remoto.lerComanda()` (`src/data/nuvem/remoto.ts`) chama a função `ler-comanda`, que reserva uma vaga (`reservar_leitura`, 011) e faz a leitura dupla (`lerDuasVezes()`, R25).
3. **Confirmação.** `conferirLeitura()` (`src/domain/leitura.ts`) refaz a conta pelo cardápio (verde, amarelo, vermelho); o motoboy confirma a área e `comandaDaLeitura()` monta a comanda.
4. **No aparelho.** `lancar()` (`src/data/nuvem/repoNuvem.ts`) grava comanda, foto e registro da leitura no IndexedDB e na fila, numa transação.
5. **Na nuvem.** `enviar()` converte com `paraGravar()` (`linhas.ts`) e grava com `remoto.inserir()` em `comandas` e `leituras`; `enviarFotos()` sobe o JPEG para o bucket `comandas`.

No painel:
6. **Busca.** `carregarPainel()` (`src/data/painel.ts`) lê `caixas`, `comandas`, `acertos` e `leituras` e traduz com `linhaParaComanda()` (`linhas.ts`).
7. **Tempo real.** O canal de `usePainel()` (`src/data/painel.ts`) avisa quando a comanda chega e o painel recarrega.
8. **Folha.** `montarFolha()` (`src/domain/painel.ts`) monta uma coluna por motoboy, na ordem de chegada. Código com foto vira botão que abre a foto por link temporário (5 min).

Sem internet o passo 2 fica para depois: a foto espera na fila e `lerPendentes()` (`repoNuvem.ts`) lê quando a internet volta, só como conferência (R28).

## 2. Pix "caiu" (Luan → motoboy)

No painel:
1. **Coluna PIX.** `colunaPix()` (`src/domain/painel.ts`) junta os Pix antecipados da noite de todos os motoboys, sem as comandas que voltaram.
2. **Toque.** `marcarPix()` (`src/telas/Painel.tsx`) avisa "Pix da 0017 caiu" com desfazer e chama `acoes.marcarPix()` (`src/data/painel.ts`), que muda só `pix_confirmado`.

No Supabase:
3. **Trava.** O gatilho `pix_so_da_equipe` (006, refeito no 010): só a equipe marca; o motoboy que tentar fica com o valor antigo; comanda nova chega sem a marca; se o motoboy mudar o **valor** do Pix antecipado, a marca sai (o Luan conferiu outro valor). Mudar status ou outra forma mantém a marca.

No celular:
4. **Tempo real.** `remoto.ouvir()` recebe a comanda alterada; se o canal falhar, a sincronização de cada minuto traz igual.
5. **No aparelho.** `aoEvento()` → `aplicar()` (`repoNuvem.ts`) grava com `linhaParaComanda()`. O que o motoboy mudou e ainda está na fila fica por cima (`comPendentes()`), e o Pix nunca está nisso: o motoboy só sobe as colunas que ele mesmo mudou.
6. **Aviso.** `useAvisoPix()` (`src/ui/useAvisoPix.ts`, em `App.tsx`) compara com os já vistos (`pixQueCairam()`, `src/domain/comanda.ts`) e mostra "Pix da 0017 caiu". O que já estava confirmado ao abrir não avisa.
7. **Selo.** A lista da noite mostra "Pix confirmado" (`src/telas/ListasComandas.tsx`).

A marca do Luan tem três proteções: o gatilho no banco, o envio só das colunas alteradas e `aplicar()` que não deixa a fila apagar a marca. O gatilho é a principal: mesmo com erro no app, o banco não deixa o motoboy marcar o próprio Pix.

## 3. Confirmação do acerto (Luan trava o caixa)

No painel:
1. **Conta.** Em `CaixaNoPainel()` (`src/telas/Painel.tsx`) o Luan digita o dinheiro contado (`registrarContado()`).
2. **Valores.** `montarAcerto()` (`src/domain/painel.ts`) usa o mesmo `calcularAcerto()` do celular: falta, sobra, quanto pagar e de onde sai (R14, "Pague R$ 75,00 do caixa dele e retire R$ 95,00 do caixa da empresa").
3. **Dois toques.** "Confirmar acerto" pede o segundo toque; com comanda em rota, o aviso muda.
4. **Envio.** `confirmarAcerto()` (`src/data/painel.ts`) manda os valores e **o que o Luan viu**: quantas comandas, a última alteração, o caixa inicial e a diária.

No Supabase (`011_acerto_e_leitura.sql`):
5. **`confirmar_acerto`.** Confere que é da equipe, trava o caixa (`for update`), responde `já confirmado` se o acerto existe, e compara o que o Luan viu com o banco. Se o motoboy mudou algo nesse meio tempo, responde `mudou` e o painel pede para conferir de novo. Se bate, grava o acerto e fecha o caixa de uma vez (R15).
6. **Trava depois.** O gatilho `motoboy_sem_acerto` segura a escrita do motoboy nesse caixa: se chega durante a confirmação, espera e é recusada (42501). `supabase/teste/rls-acerto.sql` testa a recusa depois da confirmação.

No celular:
7. **Tempo real.** `aoEvento()` (`repoNuvem.ts`) recebe o acerto e grava no aparelho.
8. **Tela.** `ConteudoAcerto()` (`src/telas/TelaAcerto.tsx`) mostra "Confirmado por Luan às 23:48" e as listas ficam só leitura.
9. **Fila.** Alteração que ainda não tinha subido é recusada, com o aviso "sem permissão (o acerto pode já ter sido confirmado)"; as fotos esperam.

**Reabrir** é só do admin: `reabrirAcerto()` (`src/data/painel.ts`) apaga o acerto, o motoboy volta a editar e as fotos que esperavam sobem.

O app calcula os valores; o banco garante que o Luan confirmou o caixa que viu. As duas coisas juntas evitam fechar um acerto em cima de um caixa que mudou no último segundo.
