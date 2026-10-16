# Sistema da pizzaria: requisitos levantados

Atualizado em 16/10/2026. Fonte: conversa com o Felipe (motoboy da casa e desenvolvedor), duas fotos (folha de expedição e uma comanda), dois prints do grupo de entregas no WhatsApp e as respostas do Luan na página "Conversa com o Luan" (12/10, texto original na seção 13).

Marcação usada: **[C]** confirmado pelo Felipe · **[L]** confirmado ou corrigido pelo Luan · **[S]** suposição ainda não confirmada · **[?]** em aberto.

Em 12/10 o Luan conferiu 10 pontos da seção 4: nove certos e uma correção, no tempo do acerto (seção 4.6).

---

## 1. Contexto

- Nome: Mel Pizzaria (visto nos prints do grupo de entregas).
- [C] Pizzaria com faturamento de cerca de R$ 100 mil/mês e cerca de 100 entregas por noite.
- [C] Atende três cidades: Aragarças, Pontal do Araguaia e Barra do Garças.
- [C] Também entrega em algumas zonas rurais e distritos distantes, que têm taxa própria.
- [C] Funciona de quarta a domingo. O atendimento começa às 19h.
- [C] Pedidos anotados à mão em comandas de papel.
- [C] Clientes pedem pelo WhatsApp, conversando com uma pessoa.
- [C] Já tentou usar o Saipos e não deu certo, por dois motivos:
  1. foi implantado de uma vez só;
  2. os clientes, acostumados a pedir manualmente pelo WhatsApp, não se adaptaram ao pedido automático.
- [C] Maior gargalo hoje: a expedição das entregas e o acerto financeiro dos motoboys.

## 2. Objetivo e princípios

- [C] Destino final: um PDV completo, que pega pedido, imprime na cozinha, controla entregador, fecha o caixa automaticamente e recebe pedidos de garçom pelo sistema.
- [C] Implantar aos poucos, sem comprometer a operação.
- [C] Aceitar pedido manual e automático: o cliente não pode ser obrigado a mudar o jeito de pedir.
- [S] Cada fase substitui um papel só e roda algumas noites junto com o papel antes de o papel sair.
- [S] O papel continua como plano B se o sistema ou a internet cair.

## 3. Pessoas

| Quem | O que faz |
|---|---|
| Luan | [C] Cuida do celular dedicado ao WhatsApp. [C] Manda as localizações no grupo de entrega. [C] Confere o Pix antecipado e avisa o motoboy. [C] Cuida de todo o despacho das entregas: preenche a folha, decide quem leva cada pedido e, em dia movimentado, separa os pedidos para o motoboy que está perto de voltar. [L] Anota pedidos, separa entregas de retiradas e avisa pelo WhatsApp os clientes que vão retirar. [C] Faz o acerto dos motoboys no fim da noite. |
| Dona | [C] Fica no caixa e atende o WhatsApp no segundo celular, dividindo as duas funções. [C] Vai usar o sistema. [C] Resolve os casos de cliente que pagou duas vezes. [C] Cuida do dinheiro depois do acerto dos motoboys. [?] Quanto está envolvida nas decisões do projeto. |
| Motoboys | [C] Geralmente 4 de quarta a sexta e 5 no sábado e domingo. Na folha fotografada: Felipe (1), João (2), Goes (3), Vitor (4), Arthur (5). [C] Todos têm celular com internet durante o turno. |
| Garçons | [?] Quantidade e rotina ainda não levantadas. |
| Cozinha | [?] Equipe e rotina ainda não levantadas. |

## 4. Como funciona hoje

### 4.1 Atendimento
- [C] Duas pessoas, dois celulares, no mesmo número de WhatsApp: o Luan, só no celular, e a dona, que divide o atendimento com o caixa.
- [C] Problema: uma começa um atendimento e a outra não sabe se deve atender ou não.
- [L] Anotar um pedido leva de 3 a 5 minutos. Depende do movimento, do fluxo de mensagens e de o cliente facilitar ou não: dizer a forma de pagamento, mandar a localização e autorizar a produção.
- [L] Faz parte do pedido o cliente autorizar a produção. [?] Como isso acontece e em que momento.
- [L] Numa noite cheia, o Luan anota pedidos e separa quais serão entregues e quais serão retirados no balcão. A retirada é o que mais toma tempo dele, porque é preciso avisar o cliente pelo WhatsApp.

### 4.2 Comanda de papel
Campos vistos na comanda fotografada:
- [C] Código de 4 dígitos = final do telefone do cliente (ex.: 3557).
- [C] Asterisco = promoção da noite, que muda todo dia. [L] Costuma ser um desconto de R$ 3 a R$ 23 nas pizzas da categoria "tradicionais", salvo raras exceções.
- Tamanho (G), sabores, bebida (Coca Zero 2 L), bairro, ponto de referência, total (R$ 113,00).
- [C] A forma de pagamento sempre está escrita: cartão, Pix ou dinheiro.
- [C] O total já inclui a taxa de entrega (ex.: pizza R$ 60 + taxa R$ 12 = R$ 72).
- [C] Retirada no balcão e mesas usam a mesma comanda e também são identificadas pelo telefone.
- [L] A comanda é levada à mão pelo atendente até a cozinha.
- [C] A comanda vai com o motoboy e volta com ele: é entregue ao Luan no acerto.

### 4.3 Folha de expedição
- [C] Quem preenche a folha é o Luan.
- [C] Uma coluna por motoboy, com os códigos de 4 dígitos dos pedidos que ele levou.
- [C] Coluna "PIX": todos os pedidos com Pix antecipado (os códigos se repetem das colunas dos motoboys).
- [C] Pontinho ao lado do código: feito pelo próprio entregador, só quando o Luan esquece de mandar a localização daquela entrega. É exceção, não regra.
- [C] Seta com valor (ex.: "→ 3,00") = troco devolvido ao cliente por Pix.
- [C] Rodapé "10/10 – 80,00" = data e caixa de R$ 80 que cada motoboy recebe e devolve no final.

### 4.4 Despacho
- [C] O Luan cuida de todo o despacho das entregas.
- [C] Ordem de balcão: quem chegou primeiro leva. Não há regra de rota.
- [C] Em dia movimentado, o Luan usa o aviso de retorno para saber quem está perto de voltar e já deixa os pedidos separados para ele.
- [C] Em média 2 pedidos por viagem, no máximo 5.
- [C] Localização: o Luan manda a localização de cada entrega em um grupo de WhatsApp; cada entrega tem um identificador e o motoboy marca o seu, que traz o contato e a localização do cliente.

### 4.4.1 Grupo de entregas (lido nos prints de 11/10, 20:39 a 20:55)
- Grupo "Mel entregas", com a conta da pizzaria, o Luan e os motoboys.
- Para cada entrega a conta da pizzaria manda **duas mensagens seguidas**:
  1. a localização do cliente, encaminhada: ora um pino de localização do WhatsApp, ora um link do Google Maps (`maps.app.goo.gl/...`);
  2. o telefone do cliente, em mensagem separada.
- O final do telefone é o código do pedido (telefone terminado em 3837 = comanda 3837). É por esse número que o motoboy liga a mensagem à comanda.
- [C] O motoboy "pega" a entrega **respondendo à mensagem do telefone**, antes de sair da pizzaria. Cada motoboy marca de um jeito: nos prints, o Felipe responde com 👍 e o Goes com letras ("C", "X").
- [C] A marca serve para o motoboy achar a entrega. Não é usada no acerto, mas funciona como camada de segurança: se uma entrega não foi anotada no controle, é pelo grupo que se descobre quem fez.
- [C] O cliente sempre manda a localização. Quando manda o endereço escrito em vez do pino, quem pesquisa a rua no Maps é o motoboy.
- [C] Quando falta a localização, o motoboy pede no grupo.
- Entre a localização chegar e o motoboy marcar passaram cerca de 8 a 10 minutos nos prints (20:45/20:47 → 20:55).
- [C] Os motoboys avisam no grupo o tempo de retorno para a pizzaria. Nos prints: "Cinco minutos" e "Voltando 7".
- [C] O aviso não é obrigatório: cada um manda quando lembra, mais em dias movimentados. Serve para o Luan separar os pedidos para quem está perto de voltar.
- [S] Uma entrega = duas mensagens manuais do Luan. Em uma noite de 100 entregas são cerca de 200 mensagens.

### 4.5 Pagamento
- [C] Dinheiro: o motoboy recebe e leva o troco do caixa de R$ 80.
- [C] Cartão: o motoboy leva maquininha. Cada motoboy tem a sua.
- [C] Pix antecipado: o Luan confere manualmente se caiu e avisa o motoboy. Às vezes não avisa, e o motoboy sai sem saber se o Pix caiu ou quanto falta cobrar.
- [C] Sem aviso, cada motoboy decide na porta. O Felipe sempre cobra.
- [C] Por isso às vezes o cliente paga duas vezes (Pix e de novo na porta). Quem resolve esses casos é a dona.
- [C] Na cobrança em dobro, o cliente escolhe como receber de volta: Pix ou crédito para o próximo pedido.
- [C] O crédito não tem validade. Hoje fica anotado só na conversa de WhatsApp do cliente.
- [C] Pix na hora: sempre na maquininha, que já emite o comprovante.
- [C] Troco no Pix: o cliente paga em dinheiro e a pizzaria devolve a diferença por Pix.
- [C] **Pagamento misto existe, em qualquer combinação.** Exemplos dados: parte adiantada no Pix e o resto na hora em dinheiro e cartão; ou tudo no cartão.
- [L] No pagamento misto, a comanda traz o total e uma observação. Se o valor de cada parte aparece, depende do caso.
- [C] **O cliente troca a forma de pagamento na porta, e isso não fica registrado.** A forma real só aparece no acerto, quando o motoboy entrega a comanda e o Luan pergunta como foi pago.

### 4.6 Acerto dos motoboys
- [C] Feito pelo Luan. [L] Leva de 5 a 15 minutos por motoboy (o Felipe estimava cerca de 40 minutos para 5). Chuva, perda de comanda e formas de pagamento que não batem aumentam o tempo.
- [L] Comanda perdida atrasa o acerto. [S] Sem o papel, faltam o valor, a forma de pagamento e o comprovante grampeado.
- [C] Perder a comanda acontece com bastante frequência, no despacho e com o motoboy. Hoje é preciso pesquisar o pedido de novo e refazer a comanda. [S] A pesquisa é na conversa do WhatsApp.
- [C] Turno dos motoboys: das 18h à meia-noite. O atendimento começa às 19h.
- [C] Ordem: quem chegou mais cedo no início da noite fecha o caixa primeiro.
- [C] O motoboy entrega as comandas com o comprovante da maquininha grampeado em cada uma.
- [C] O Luan só pergunta a forma de pagamento das comandas que parecem diferentes. Uma troca na porta que não pareça diferente passa sem ser perguntada.
- [C] Somar, perguntar a forma de pagamento e bater os comprovantes: tudo isso toma tempo. Não há uma etapa que concentre o tempo. [L] Se o sistema fizesse uma coisa já na primeira semana, para o Luan seria somar o acerto.
- [C] O motoboy devolve tudo (caixa + dinheiro recebido) e recebe à parte.
- [C] Em 16/10: o Luan paga o motoboy com o próprio caixa inicial dele (o troco dado no começo da noite). O que faltar ele tira do caixa da empresa e anota a retirada. Ex.: caixa de R$ 75 e R$ 170 a receber → R$ 95 retirados do caixa da empresa. [C] A fonte do pagamento é o caixa inicial, e não todo o dinheiro que o motoboy traz; o dinheiro das vendas vai todo para a empresa.
- [C] Recebe diária de R$ 30, igual para todos, mais as taxas das entregas.
- [C] Diária e taxas são pagas em dinheiro, na mesma noite.
- [C] O que acontece com o dinheiro depois do acerto é com a dona. [?] Detalhes a perguntar a ela.
- [C] A taxa que o cliente paga é a mesma que o motoboy recebe.
- [C] Maquininha: o Luan imprime o relatório da máquina e associa o comprovante de cada comanda a uma linha do relatório.
- [C] Quando não fecha: confere todos os comprovantes e o dinheiro até achar o erro, seja de comanda ou de dinheiro.
- [C] Se faltar dinheiro, o valor é descontado do motoboy, do que ele recebe na mesma noite. Se a falta passar do que ele tem a receber, ele completa do próprio bolso na hora. Se o erro for achado depois, o motoboy recebe de volta.
- [C] Se sobrar dinheiro, a sobra fica retida até descobrirem de onde veio, sem prazo.
- [C] O erro que causa a diferença pode estar em qualquer lugar: forma de pagamento errada, troco errado, comprovante faltando, comanda errada.

### 4.7 Pedido que volta
- [C] O motoboy recebe a taxa e a empresa assume o prejuízo.
- [C] Depois disso há três saídas: sai de novo (gera uma segunda taxa), o cliente retira, ou o pedido é cancelado.
- [C] Na segunda saída o código é anotado de novo na folha, e o pedido pode sair com outro motoboy.
- [?] Pedido já pago por Pix antecipado que volta e é cancelado: nunca aconteceu, sem regra definida.

## 5. Regras de negócio

| ID | Regra | Status |
|---|---|---|
| R1 | Pedido é identificado pela data + 4 últimos dígitos do telefone do cliente. | C |
| R2 | O mesmo código pode se repetir na noite (cliente que pede duas vezes, ou dois clientes com o mesmo final). O sistema avisa, mas permite. | S |
| R3 | Taxa padrão de entrega por cidade: Aragarças R$ 5, Pontal R$ 10, Barra R$ 12. Exceções em R34. | C |
| R4 | Total do pedido = itens + taxa de entrega. | C |
| R5 | Taxa do motoboy = taxa cobrada do cliente, inclusive nas zonas com taxa própria (R34). | C |
| R6 | Caixa inicial de R$ 80 por motoboy, devolvido no fim. | C |
| R7 | Diária de R$ 30 por motoboy, igual para todos. | C |
| R8 | No acerto o motoboy devolve todo o dinheiro e recebe diária + taxas à parte. | C |
| R9 | Formas de pagamento: dinheiro, cartão (maquininha), Pix antecipado, Pix na maquininha. | C |
| R10 | Cada motoboy tem uma maquininha. A conferência é pelo relatório impresso, comprovante por comprovante. | C |
| R11 | Pix antecipado precisa de conferência manual antes de ser dado como pago. | C |
| R12 | Troco no Pix só existe em pagamento em dinheiro; o motoboy fica com esse valor a mais em mãos. | C |
| R13 | Pedido que saiu e voltou: taxa devida ao motoboy, valor do pedido não recebido. | C |
| R14 | A taxa fica gravada no pedido; mudar a tabela de taxas não altera pedidos antigos. | S |
| R15 | Todo motoboy da noite recebe a diária cheia, independente da hora em que chegou. | C |
| R16 | Um pedido pode ter mais de um pagamento, em qualquer combinação de formas. | C |
| R17 | A forma de pagamento da comanda é a prevista. A forma real só é conhecida na volta do motoboy e precisa ser confirmada pedido a pedido. | C |
| R18 | A taxa é por saída, não por pedido: pedido que voltou e sai de novo paga a taxa duas vezes. | C |
| R19 | Pedido que voltou termina em uma de três situações: reentregue, retirado pelo cliente ou cancelado. | C |
| R20 | Falta de dinheiro no acerto é descontada do motoboy, do valor que ele recebe na mesma noite. Se passar desse valor, ele paga a diferença na hora. | C |
| R21 | Diária e taxas são pagas em dinheiro na mesma noite. | C |
| R22 | A ordem do acerto segue a ordem de chegada dos motoboys no início da noite. | C |
| R23 | O número de motoboys varia por noite (geralmente 4 de quarta a sexta, 5 no fim de semana). | C |
| R24 | Localização pendente é exceção, marcada pelo motoboy; o padrão é a localização já ter sido enviada. | C |
| R25 | Sobra de dinheiro no acerto fica retida (não vai para o motoboy nem para o caixa) até a origem ser descoberta. | C |
| R26 | Turno dos motoboys: 18h à meia-noite. A ordem de chegada define a ordem do acerto. | C |
| R27 | Cada pagamento na maquininha tem um comprovante grampeado na comanda correspondente. | C |
| R28 | Cada saída tem seu próprio motoboy: um pedido que volta pode sair de novo com outro, e cada um recebe a taxa da sua saída. | C |
| R29 | Pix antecipado só pode ser tratado como pago depois de conferido; até lá, o motoboy precisa ver o pedido como "Pix não confirmado". | S |
| R30 | Falta descontada ou paga pelo motoboy é devolvida a ele se o erro for achado depois. | C |
| R31 | Cobrança em dobro (Pix antecipado + pagamento na porta) é resolvida pela dona; o sistema precisa registrar o caso e a devolução ao cliente. | C (quem resolve) / S (registro) |
| R32 | Devolução de cobrança em dobro: o cliente escolhe entre Pix de volta ou crédito para o próximo pedido. | C |
| R33 | Crédito do cliente não tem validade. No sistema, fica ligado ao telefone completo e é usado como forma de pagamento em um pedido seguinte; como o Pix antecipado, não passa pela mão do motoboy. | C (sem validade) / S (resto) |
| R34 | A taxa é por região de entrega, não só por cidade: cada cidade tem a taxa padrão, e algumas áreas têm taxa própria. Levantada até agora: perto do Parque de Exposições de Barra do Garças, R$ 15. | C, L (valor) / S (modelo) |
| R35 | A promoção da noite muda todo dia e precisa ser definida a cada noite. Costuma ser um desconto em reais, de R$ 3 a R$ 23, nas pizzas da categoria "tradicionais". | C, L |
| R36 | Um pedido pode ser separado para um motoboy antes de ele voltar à pizzaria. Estados de uma saída: separado para o motoboy, em rota, entregue ou voltou. | C (separar) / S (estados) |
| R37 | Pizza meio a meio é cobrada pelo preço do sabor mais caro. | L |
| R38 | Comanda perdida não pode travar o acerto: o pedido lançado no sistema guarda o que o acerto precisa (código, total, forma de pagamento, motoboy). Perder a comanda é frequente. | C, L (o problema) / S (a solução) |

## 6. Cálculo do acerto

A conta é feita sobre **pagamentos** (um pedido pode ter vários) e sobre **saídas** (um pedido pode sair mais de uma vez).

Para cada motoboy, na noite:

```
dinheiro_a_devolver = caixa_inicial
                    + soma(pagamentos em dinheiro dos pedidos entregues)
                    + soma(troco devolvido por Pix nesses pedidos)

maquininha_esperada = soma(pagamentos em cartão dos pedidos entregues)
                    + soma(pagamentos em Pix na máquina dos pedidos entregues)

a_receber           = diária + soma(taxa de cada saída, inclusive das que voltaram)

diferença_dinheiro  = dinheiro_contado - dinheiro_a_devolver     (negativo = faltou)

pago_ao_motoboy     = a_receber - falta                          (falta é descontada, R20)
                      se der negativo, é o valor que o motoboy paga na hora
sobra_retida        = max(0, diferença_dinheiro)                 (fica pendente até achar a origem, R25)
```

- Pix antecipado e crédito do cliente (R33) não passam pela mão do motoboy: só entram na taxa.
- A forma de cada pagamento é a real, confirmada na volta (R17), não a que estava escrita na comanda.
- A maquininha é conferida transação a transação contra o relatório impresso (R10), não só pelo total.

### Exemplo conferido
Um motoboy com seis pedidos, cada um com um pagamento só:

| Código | Total | Cidade | Pagamento | Observação |
|---|---|---|---|---|
| 3557 | 113,00 | Barra | dinheiro | |
| 0017 | 60,00 | Aragarças | Pix antecipado | conferido |
| 2672 | 90,00 | Pontal | cartão | |
| 0910 | 72,00 | Barra | Pix na máquina | |
| 3595 | 47,00 | Aragarças | dinheiro | troco de 3,00 por Pix |
| 8094 | 65,00 | Barra | dinheiro | voltou sem entregar |

- Dinheiro a devolver: 80 + 113 + 47 + 3 = **R$ 243,00**
- Maquininha: 90 + 72 = **R$ 162,00**
- A receber: 30 + (12 + 5 + 10 + 12 + 5 + 12) = 30 + 56 = **R$ 86,00**

### Exemplo de pagamento misto (valores ilustrativos)
Pedido de R$ 100,00 em Barra, pago com R$ 40 de Pix antecipado, R$ 30 em dinheiro e R$ 30 no cartão:

- R$ 30 entram no dinheiro a devolver.
- R$ 30 entram na maquininha.
- R$ 40 já estão na conta da pizzaria e precisam ter sido conferidos.
- A taxa de R$ 12 conta uma vez só.

### Exemplo de segunda saída
O 8094 voltou e saiu de novo: a taxa de Barra conta duas vezes (12 + 12) e o valor do pedido entra na forma em que foi pago na segunda vez.

## 7. Problemas atuais

1. [C] O acerto é todo somado à mão. [L] Leva de 5 a 15 minutos por motoboy, mais com chuva, perda de comanda ou formas de pagamento que não batem.
2. [C] No WhatsApp, as duas atendentes não sabem quem está com qual cliente.
3. [C] Pix antecipado depende de o Luan conferir e avisar, e às vezes o aviso não chega.
4. [C] A forma de pagamento real não é registrada: o Luan pergunta no acerto, e só das comandas que parecem diferentes.
5. [C] Quando o caixa não fecha, é preciso reconferir todos os comprovantes e o dinheiro até achar o erro.
6. [C] O Luan às vezes esquece de mandar uma localização: o motoboy sinaliza na folha e pede no grupo.
7. [S] Cada entrega exige duas mensagens manuais no grupo (localização e telefone), e quem pegou é registrado duas vezes: no grupo e na folha.
   - [C] Endereço escrito em vez de pino dá mais trabalho: o motoboy precisa pesquisar a rua no Maps.
   - [C] Entregas às vezes não são anotadas no controle; o grupo é o que permite descobrir depois quem fez.
8. [S] A folha só tem o código; para somar valores e taxas é preciso voltar às comandas.
9. [S] Não há registro do que aconteceu em noites anteriores.
10. [C] O crédito do cliente só existe anotado na conversa de WhatsApp dele: para saber se tem saldo, é preciso procurar na conversa.
11. [L] Pedido para retirada dá mais trabalho que entrega: o Luan precisa avisar o cliente pelo WhatsApp.
12. [L] Anotar um pedido leva de 3 a 5 minutos, boa parte esperando o cliente dizer a forma de pagamento, mandar a localização e autorizar a produção.
13. [C] Comanda perdida acontece com bastante frequência, no despacho e com o motoboy: é preciso pesquisar o pedido de novo e refazer a comanda, e o acerto atrasa.

## 8. Fases propostas

| Fase | O que entra | Papel que substitui |
|---|---|---|
| 1 | Expedição e acerto dos motoboys | Folha de colunas e soma manual |
| 2 | Lançamento do pedido (WhatsApp, balcão, telefone) | Comanda escrita à mão |
| 3 | Impressão na cozinha | Via de papel da cozinha |
| 4 | Garçom pelo celular | Comanda de mesa |
| 5 | Caixa geral (abertura, sangria, fechamento) | Fechamento manual do caixa |
| 6 | Pedido automático por link (opcional para o cliente) | Nada: canal a mais |

A leitura de comanda por foto saiu do plano: quando o pedido nasce digitado (fase 2), não há manuscrito para ler.

### 8.2 Versão 1 (16/10)
[C] O MVP local está cumprindo o papel no teste. Pedidos do Felipe para a versão 1: lançamento mais fácil, layout mais limpo, entregas por cidade, conferir se perdeu comanda, registrar o que o Luan tira do caixa da empresa para pagar o motoboy, salvar na nuvem e um painel para o Luan acompanhar, com o resumo no formato da folha de papel. Especificação em `SPEC-v1.md`; banco em `001_schema.sql`.

### 8.1 MVP
**Decisão em 12/10:** [C] o primeiro teste é só o caixa do Felipe, lançado por ele mesmo no celular durante a noite. Testa ao mesmo tempo a conta do acerto e a ideia de o motoboy lançar as comandas (ver "Quem digita o quê"). A especificação para o Claude Code está em `SPEC-mvp-acerto.md`.

Proposta anterior, para quando o Luan entrar no teste: [S] o menor escopo que entrega o que o Luan mais quer (somar o acerto) sem mudar o despacho.

- **Onde entra:** só no acerto. O despacho continua na folha de papel; o Luan lança cada comanda quando o motoboy volta, no mesmo momento em que já confere.
- **Abrir a noite:** escolher os motoboys da noite e a ordem de chegada. Caixa de R$ 80 e diária de R$ 30 já preenchidos.
- **Lançar cada comanda:** código, total, cidade ou área (um toque), forma de pagamento real (um toque, com divisão no pagamento misto), troco por Pix e se voltou ou saiu de novo.
- **Conta do motoboy:** dinheiro a devolver, total esperado na maquininha, valor a receber (diária + taxas), dinheiro contado, falta ou sobra e o valor final pago a ele.
- **Resumo da noite:** recebido por forma de pagamento, total pago aos motoboys, faltas e sobras.
- **Fica para depois:** celular do motoboy, status do Pix, crédito, cobrança em dobro, separação para quem está voltando, retiradas e perfis de acesso.
- **Teste:** de 3 a 5 noites junto com o papel, medindo o tempo por motoboy (hoje de 5 a 15 minutos) e se os totais batem com a conta feita à mão.
- **Versão 1:** o lançamento passa para o despacho e para o celular do motoboy, o que resolve a comanda perdida (R38) e a troca de pagamento na porta. É aqui que entram os ajustes do Luan em quem anota o quê.

## 9. Requisitos já levantados por fase

### Fase 1: expedição e acerto
**Situação em 12/10:** as regras principais estão fechadas e dá para começar pelo modelo de dados. O usuário principal da fase 1 é o Luan, que preenche a folha e faz o acerto. Ele conferiu as regras (nove de dez certas) e escolheu somar o acerto como o que mais ajudaria na primeira semana. O que falta mexe pouco na estrutura: a lista completa das áreas com taxa própria (é configuração), a decisão sobre o crédito na fase 1 e os ajustes que o Luan quer na divisão de quem digita cada campo (ver "Quem digita o quê").

- Lançar pedido com: código, total, cidade ou zona de entrega (R34), forma de pagamento prevista, motoboy.
- [S] **Quem digita o quê**: o Luan já acumula WhatsApp, localizações no grupo, conferência do Pix, folha e acerto. Hoje, na folha, ele escreve só o código. Se a fase 1 pedir a ele também total, cidade e forma de pagamento na hora do despacho, o sistema aumenta o trabalho de quem está mais sobrecarregado. Opção a avaliar: o Luan marca só código e motoboy, como na folha; o motoboy completa total e cidade ao pegar a entrega, com a comanda na mão, e confirma a forma de pagamento na porta. No acerto, tudo já chega lançado. [L] O Luan achou que faz sentido, com ajustes. [?] Quais ajustes. [S] Seja qual for a divisão, o total e a forma de pagamento prevista precisam entrar no sistema no momento em que a comanda sai com o motoboy, porque é nesse trecho que ela costuma sumir (R38).
- [S] Tabela de taxas por região de entrega (R34), editável pela dona: a taxa padrão de cada cidade e as zonas com taxa própria.
- Tela no formato da folha: uma coluna por motoboy e uma de Pix antecipado a conferir.
- **Separar pedidos para quem está voltando** (R36): [C] em dia movimentado, o Luan usa o aviso de retorno para deixar os pedidos separados para o motoboy que está perto de voltar. [S] No sistema, o motoboy avisa o retorno com um toque ("volto em 5", "volto em 10"), opcional como hoje; a expedição vê quem está chegando e marca pedidos como "separado para" esse motoboy antes de ele sair.
- Motoboys da noite escolhidos a cada noite (4 ou 5), com a ordem de chegada registrada.
- **Vários pagamentos por pedido**, cada um com forma e valor (R16). [L] Hoje a comanda traz o total e uma observação, e nem sempre o valor de cada parte; a divisão precisa poder ser lançada depois, na porta ou no acerto.
- **Confirmação do pagamento real na volta**: tela que percorre os pedidos do motoboy e deixa trocar ou dividir a forma em poucos toques (R17).
- **Registro da forma de pagamento na porta**: [C] todos os motoboys têm celular com internet, e marcar na porta é viável. [S] O motoboy confirma ou troca a forma de pagamento no momento da entrega. Hoje o Luan só pergunta das comandas que parecem diferentes, então uma troca pode passar despercebida e só aparecer como diferença no caixa; registrar na hora elimina a pergunta e boa parte da busca pelo erro.
- [S] **Busca da diferença**: quando o caixa não fecha, o sistema aponta os candidatos em vez de reconferir tudo. Como o erro pode estar em qualquer lugar [C], a tela lista todos os pontos de verificação de cada pedido do motoboy: forma trocada, troco, comprovante sem pedido, pedido sem comprovante.
- **Sobra retida** (R25): valor pendente por motoboy e noite, sem prazo, com campo para registrar a origem quando for descoberta. Lista de sobras em aberto acumulada entre noites.
- **Status do Pix antecipado visível ao motoboy** (R29): conferido ou não, e quanto falta cobrar na porta. Substitui o aviso do Luan, que às vezes não chega, e evita a cobrança em dobro.
- **Descontos e devoluções do motoboy** (R30): registro de cada falta descontada ou paga do bolso, com o pedido ligado a ela, para devolver se o erro aparecer depois. Liga com a lista de sobras retidas: uma sobra encontrada pode ser a falta de outro.
- **Comanda perdida** (R38): [L] perder a comanda atrasa o acerto. [C] Acontece com bastante frequência, e hoje obriga a pesquisar o pedido de novo e refazer a comanda. [S] Com o pedido lançado no sistema, o papel deixa de ser a única fonte: o acerto continua com o valor, a forma de pagamento e o motoboy registrados, e o comprovante da maquininha pode ser achado pela lista de transações esperadas. [C] A comanda costuma sumir no despacho e com o motoboy, justamente o trecho que a fase 1 cobre, desde que os dados entrem quando a comanda sai com o motoboy (ver "Quem digita o quê"). O pedido completo, com itens e endereço, passa a ficar guardado na fase 2, e a reimpressão vem com a fase 3.
- **Casos de cobrança em dobro** (R31, R32): lista para a dona, com pedido, valor, como o cliente escolheu receber (Pix ou crédito) e se já foi resolvido.
- [S] **Crédito na fase 1**: o pedido da fase 1 só tem os 4 dígitos do telefone, e o crédito precisa do telefone completo. Ou a dona digita o telefone completo ao registrar a cobrança em dobro, ou o crédito continua no WhatsApp até a fase 2 trazer o cadastro de clientes. Decisão a tomar.
- **Tela da dona**: [C] ela usa o sistema no caixa. [S] Mostra o fechamento da noite, as sobras retidas, as faltas e devoluções aos motoboys, as cobranças em dobro e o total de créditos de clientes em aberto (eles não vencem).
- [S] **Perfis de acesso**: a dona vê tudo; o Luan lança, despacha e faz o acerto; o motoboy vê só as entregas dele.
- Como somar, perguntar e bater comprovantes tomam tempo igual, a fase 1 precisa atacar os três; nenhum sozinho resolve o tempo do acerto.
- **Saídas**: registrar que um pedido voltou e, se sair de novo, contar outra taxa (R18, R19).
- Marcações por pedido: localização pendente (exceção), promoção, troco por Pix, Pix conferido.
- Acerto por motoboy conforme a seção 6, com dinheiro contado, falta descontada e valor final a pagar em dinheiro.
- Lista das transações esperadas na maquininha de cada motoboy, na ordem do relatório, para o Luan bater comprovante por comprovante (R10).
- Resumo da noite: recebido por forma de pagamento, total a pagar aos motoboys, pendências.
- Usada no celular (o Luan e a dona só têm celular). [L] O celular funciona para o Luan; uma tela maior no balcão ajudaria a anotar vários pedidos ao mesmo tempo.
- Meta: baixar o acerto de 5 a 15 minutos por motoboy para poucos minutos.

### Fase 2: lançamento do pedido
- [C] Duas pessoas lançando ao mesmo tempo, cada uma em um celular.
- [S] Mais rápido que escrever à mão, com a atendente no meio de uma conversa no WhatsApp.
- [S] Cliente buscado pelo telefone, trazendo nome, endereço e cidade de pedidos anteriores.
- [S] Pedido em rascunho, que pode ser retomado depois: a dona atende o WhatsApp e o caixa ao mesmo tempo e é interrompida o tempo todo.
- [S] Aviso quando o Luan e a dona abrem pedido para o mesmo telefone.
- [S] Origem do pedido registrada: WhatsApp, balcão, mesa, link.
- [S] Enviar a localização ao motoboy pelo próprio sistema, para acabar com o esquecimento.
- [S] Guardar a localização do cliente nos dois formatos em que ela chega hoje (pino com latitude e longitude, ou link do Google Maps) e reaproveitar no próximo pedido do mesmo telefone.
- [S] O motoboy "pega" a entrega com um toque no sistema, antes de sair, o que substitui a resposta no grupo e a anotação na folha ao mesmo tempo.
- [S] Histórico de quem pegou cada entrega e a que horas, para manter a camada de segurança que o grupo dá hoje.
- Endereço escrito: [C] hoje quem pesquisa no Maps é o motoboy. [S] No sistema, a pesquisa é feita uma vez e a localização encontrada fica salva no cadastro do cliente, para o próximo pedido do mesmo telefone já vir com o pino.
- [S] Botão para ligar ou abrir o WhatsApp do cliente a partir do pedido, já que hoje o telefone vai solto no grupo.
- [S] Crédito do cliente (R33) aparece ao digitar o telefone e pode ser usado no pedido com um toque.
- [S] Migração dos créditos: os saldos que hoje existem só nas conversas de WhatsApp precisam entrar no sistema, de uma vez antes de implantar ou um a um quando o cliente pedir de novo.
- **Aviso de retirada**: [L] avisar pelo WhatsApp quem vai retirar é o que mais toma tempo do Luan. [S] Lista de retiradas e um toque que abre a conversa do cliente com a mensagem pronta. Precisa do telefone completo, então depende do cadastro de clientes; pode valer adiantar essa parte.
- **Autorização da produção**: [L] o cliente autoriza a produção durante o pedido. [S] O pedido fica "aguardando autorização" até o cliente confirmar, e só então vai para a cozinha. [?] Como funciona hoje.
- [L] Anotar um pedido leva de 3 a 5 minutos, boa parte esperando o cliente. [S] Antes do sistema, uma resposta rápida do WhatsApp Business pedindo forma de pagamento, localização e autorização numa mensagem só já pode encurtar a conversa.
- [L] Pizza meio a meio cobra o sabor mais caro (R37). O cardápio tem pelo menos a categoria "tradicionais", que é a que recebe a promoção da noite.
- [L] O layout precisa funcionar no celular e aproveitar uma tela maior, que ajudaria a anotar vários pedidos ao mesmo tempo.
- [?] Cardápio, tamanhos, bordas e adicionais. O Felipe vai mandar uma foto do cardápio.
- [S] Promoção da noite (R35) definida a cada noite, antes do atendimento, como um desconto em reais sobre a categoria "tradicionais"; pedidos com a promoção ficam marcados, como o asterisco de hoje.

### Fases 3 a 6
- [L] Fase 3: hoje a comanda é levada à mão pelo atendente até a cozinha.
- Fora isso, nada levantado ainda além do objetivo.

## 10. Restrições e riscos

- A equipe usa celular; não foi confirmado se há computador ou tablet.
- Internet vira ponto crítico a partir da fase 2.
- Nota fiscal (NFC-e): não levantado se a pizzaria emite hoje e como.
- O WhatsApp Business gratuito não tem "dono" de conversa. Saídas: etiquetas (grátis, testar se sincronizam entre os celulares), aviso pelo próprio sistema (fase 2) ou plataforma de multiatendimento com a API oficial (paga).
- Hoje o telefone e a localização de todos os clientes ficam visíveis para todos os membros do grupo. No sistema, cada motoboy pode ver só as entregas dele.
- A dona acumula o caixa, o WhatsApp e as decisões. Se o sistema deixar o trabalho dela mais lento, ele não pega, como aconteceu com o Saipos. Ela é a pessoa mais importante para testar cada fase.
- [C] O Luan concentra WhatsApp, localizações, Pix, folha, retiradas e acerto. [S] Os esquecimentos de localização e de aviso do Pix vêm dessa sobrecarga. A fase 1 só ajuda se tirar trabalho dele; se somar campos para ele digitar no meio do movimento, piora.
- Vários requisitos dependem de o motoboy usar o sistema no celular durante a entrega: pegar a entrega, ver se o Pix caiu, registrar como o cliente pagou, avisar o retorno. [C] Todos os motoboys têm celular com internet no turno, e o Felipe considera viável marcar na porta. [S] Ainda vale testar na prática que isso não atrasa a entrega: poucos toques e botões grandes.
- Falta de dinheiro é descontada do motoboy (R20): um erro de conta do sistema vira prejuízo para uma pessoa. O acerto precisa mostrar de onde veio cada valor, para ser conferido e contestado.

## 11. Tecnologia considerada (proposta, não decidida)

- Frontend: React + TypeScript, web responsiva.
- Backend e banco: Supabase (PostgreSQL), com atualização em tempo real entre os aparelhos.
- Impressão na cozinha: impressora térmica (modelo e conexão a definir).

## 12. Perguntas em aberto

Separadas por quem consegue responder.

### Para o Felipe
- F1. Ao pegar a entrega, daria para o motoboy digitar no celular o código, o total e a cidade que estão na comanda, ou isso atrasaria a saída?
- F2. Foto ou link do cardápio, com tamanhos, sabores, bordas, bebidas e preços. (pendente: o Felipe manda depois)

### Para o Luan
A primeira rodada (L1 a L10, página "Conversa com o Luan") foi respondida em 12/10; o texto original está na seção 13. Pendentes:
- L12. Que ajustes você faria na proposta de quem anota o quê?
- L13. O que é autorizar a produção: o cliente confirma o pedido antes de a cozinha começar? Como isso acontece hoje?
- L14. Na retirada, o aviso ao cliente é quando a pizza fica pronta? O texto é sempre o mesmo? Quantas retiradas há por noite, mais ou menos?
- L15. A área perto do Parque de Exposições é a única com taxa própria, ou há outras (zonas rurais, distritos)?

### Para a dona
- D1. Depois do acerto, para onde vai o dinheiro que o motoboy devolve?
- D2. Como é o fechamento do caixa geral hoje?
- D3. Pedido pago por Pix antecipado que volta e é cancelado: o valor é devolvido ou vira crédito?
- D4. Há desconto, cupom ou fidelidade?
- D5. A pizzaria emite nota fiscal (NFC-e)? Por qual sistema?
- D6. Quantas mesas, garçons e pessoas na cozinha, e como a conta da mesa é fechada?
- D7. Há computador, tablet, impressora térmica ou internet reserva na pizzaria?
- D8. Ela está de acordo com o projeto e quer participar das decisões?
- D9. Quem decide a promoção da noite?

### Mais à frente
- M1. Quem vai manter o sistema depois de pronto?

## 13. Respostas do Luan, 12/10 (texto original)

```
Respostas do Luan · 12/10/2026

O QUE JÁ ENTENDEMOS
1. Despacho: certo
2. Folha: certo
3. Grupo de entregas: certo
4. Pix antecipado: certo
5. Taxas: certo
6. Acerto: CORRIGIR: O tempo de fechamento de caixa é de aproximadamente 5 a 15 min por entregador, porém fator como chuva, perdão de comanda, inconsistência nas formas de pagamento podem interferir.
7. A conta do acerto: certo
8. Forma de pagamento e comprovantes: certo
9. Quando não fecha: certo
10. Pedido que volta: certo

PERGUNTAS
1. Numa noite cheia, quais tarefas você faz ao mesmo tempo, e qual mais te atrasa?
   Anoto pedidos, separo quais serão entregues e quais serão retirados no estabelecimento (esse segundo demanda mais tempo pois é necessário notificar o cliente via whatsapp)
2. Se o sistema pudesse fazer uma coisa por você já na primeira semana, qual seria?
   Somar o acerto
3. Quando o cliente paga parte em Pix e parte em dinheiro ou cartão, a comanda traz o valor de cada parte ou só o total?
   Depende · Valor total + observação
4. Quanto tempo leva para anotar um pedido, do primeiro “boa noite” à comanda pronta?
   3 a 5 min · Depende da demanda, do fluxo de mensagens e da facilidade que o cliente tem ou não em fazer um pedido (especificar forma de pagamento, enviar localização, autorizar produção)
5. Como se cobra a pizza meio a meio?
   Pelo sabor mais caro
6. Quais zonas rurais e distritos têm taxa própria, e qual o valor de cada um?
   Localização próxima ao parque de exposições de barra do Garças 15,00
7. O que a promoção da noite costuma dar, e quem decide qual vai ser?
   A promoção geralmente é um desconto no valor da pizza da categoria "tradicionais", que pode ir de 3,00 a 23,00. (Salvo raras excessões)
8. Como a comanda chega à cozinha hoje?
   Elevada manualmente pelo atendente
9. A proposta de quem anota o quê faz sentido para você?
   Com ajustes
10. O despacho no sistema seria feito no seu celular. Daria certo, ou uma tela maior no balcão ajudaria?
   Celular está bom · Porem, uma tela maior ajudaria a anotar várias pedidos simultaneamente
```

Nota: na resposta 6, "perdão de comanda" quer dizer perda de comanda (corrigido pelo Felipe em 12/10).
