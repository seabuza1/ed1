import { formatarReais } from './dinheiro'
import type { Area, Comanda, Forma, Pagamento, Status } from './tipos'

export const FORMAS: Forma[] = ['dinheiro', 'cartao', 'pix_maquina', 'pix_antecipado']

export const NOMES_STATUS: Record<Status, string> = {
  em_rota: 'Em rota',
  entregue: 'Entregue',
  voltou: 'Voltou',
}

export const NOMES_FORMA: Record<Forma, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix_maquina: 'Pix na máquina',
  pix_antecipado: 'Pix antecipado',
}

export interface EntradaComanda {
  codigo: string
  total: number
  pagamentos: Pagamento[]
  troco: number
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string }

const ehCentavos = (n: number) => Number.isInteger(n) && n >= 0

export const temDinheiro = (pagamentos: Pagamento[]) =>
  pagamentos.some((p) => p.forma === 'dinheiro')

/** Primeira regra violada (R1, R2, R4, R5), ou null se a comanda é válida. */
export function validarComanda(entrada: EntradaComanda, taxa: number): string | null {
  const { codigo, total, pagamentos, troco } = entrada
  if (!/^\d{4}$/.test(codigo)) return 'O código precisa ter 4 dígitos.'
  if (!ehCentavos(total) || total === 0) return 'Informe o total.'
  if (total < taxa) return `Total menor que a taxa da área (${formatarReais(taxa)}).`
  if (pagamentos.length === 0) return 'Escolha a forma de pagamento.'
  if (pagamentos.some((p) => !ehCentavos(p.valor) || p.valor === 0))
    return 'Cada forma de pagamento precisa de um valor.'
  const soma = pagamentos.reduce((s, p) => s + p.valor, 0)
  if (soma !== total)
    return `As formas somam ${formatarReais(soma)}, mas o total é ${formatarReais(total)}.`
  if (!ehCentavos(troco)) return 'Troco por Pix inválido.'
  if (troco > 0 && !temDinheiro(pagamentos))
    return 'Troco por Pix só existe se tiver parte em dinheiro.'
  return null
}

/** Cria a comanda em rota, gravando a taxa da área no lançamento (R3). */
export function criarComanda(
  entrada: EntradaComanda,
  area: Area,
  ctx: { id: string; noiteId: string; agora: string },
): Resultado<Comanda> {
  const erro = validarComanda(entrada, area.taxa)
  if (erro) return { ok: false, erro }
  return {
    ok: true,
    valor: {
      id: ctx.id,
      noiteId: ctx.noiteId,
      codigo: entrada.codigo,
      total: entrada.total,
      areaId: area.id,
      taxa: area.taxa,
      status: 'em_rota',
      troco: entrada.troco,
      pagamentos: entrada.pagamentos.map((p) => ({ ...p })),
      criadaEm: ctx.agora,
      atualizadaEm: ctx.agora,
      finalizadaEm: null,
    },
  }
}

/** Linha da divisão do pagamento; valor null = linha vazia, fica com o resto. */
export interface LinhaPagamento {
  forma: Forma
  valor: number | null
}

/** R4: monta as partes do pagamento. Uma linha vazia fica com o resto do total. */
export function montarPagamentos(total: number, linhas: LinhaPagamento[]): Resultado<Pagamento[]> {
  if (linhas.length === 0) return { ok: false, erro: 'Escolha a forma de pagamento.' }
  const vazias = linhas.filter((l) => l.valor === null).length
  if (vazias > 1) return { ok: false, erro: 'Deixe só uma forma sem valor.' }
  const soma = linhas.reduce((s, l) => s + (l.valor ?? 0), 0)
  const resto = total - soma
  if (vazias === 1 && resto <= 0)
    return { ok: false, erro: `As formas já somam ${formatarReais(soma)}. Não sobra resto.` }
  return { ok: true, valor: linhas.map((l) => ({ forma: l.forma, valor: l.valor ?? resto })) }
}

/** R1: comanda da noite com o mesmo código e status diferente de "voltou". */
export const comandaRepetida = (codigo: string, comandas: Comanda[], ignorarId?: string) =>
  comandas.find((c) => c.codigo === codigo && c.status !== 'voltou' && c.id !== ignorarId)

/** Em rota na ordem de lançamento; entregues e voltaram, a última entrega primeiro. */
export function separarPorStatus(comandas: Comanda[]) {
  const porCriacao = [...comandas].sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))
  const hora = (c: Comanda) => c.finalizadaEm ?? c.atualizadaEm
  const recentes = (s: Comanda['status']) =>
    porCriacao.filter((c) => c.status === s).sort((a, b) => hora(b).localeCompare(hora(a)))
  return {
    emRota: porCriacao.filter((c) => c.status === 'em_rota'),
    entregues: recentes('entregue'),
    voltaram: recentes('voltou'),
  }
}

/** "Dinheiro" ou "Pix antecipado R$ 20,00 + Dinheiro R$ 30,00". */
export function descreverPagamentos(pagamentos: Pagamento[]): string {
  if (pagamentos.length === 1) return NOMES_FORMA[pagamentos[0].forma]
  return pagamentos.map((p) => `${NOMES_FORMA[p.forma]} ${formatarReais(p.valor)}`).join(' + ')
}

// R6: ações sobre a comanda.

export const marcarEntregue = (c: Comanda, agora: string): Comanda => ({
  ...c,
  status: 'entregue',
  atualizadaEm: agora,
  finalizadaEm: agora,
})

export const marcarVoltou = (c: Comanda, agora: string): Comanda => ({
  ...c,
  status: 'voltou',
  atualizadaEm: agora,
  finalizadaEm: agora,
})

const pixAntecipado = (ps: Pagamento[]) => ps.reduce((s, p) => s + (p.forma === 'pix_antecipado' ? p.valor : 0), 0)

/** O "caiu" do Luan vale para o valor que ele conferiu: mudou o Pix antecipado, a marca sai (006, 010). */
const pixAindaConfirmado = (c: Comanda, novos: Pagamento[]) =>
  c.pixConfirmado === true && pixAntecipado(novos) === pixAntecipado(c.pagamentos)

/** "Trocou a forma": grava os novos pagamentos e marca entregue. */
export function trocarForma(
  c: Comanda,
  pagamento: { pagamentos: Pagamento[]; troco: number },
  agora: string,
): Resultado<Comanda> {
  const erro = validarComanda({ codigo: c.codigo, total: c.total, ...pagamento }, c.taxa)
  if (erro) return { ok: false, erro }
  return {
    ok: true,
    valor: {
      ...c,
      pagamentos: pagamento.pagamentos.map((p) => ({ ...p })),
      troco: pagamento.troco,
      pixConfirmado: pixAindaConfirmado(c, pagamento.pagamentos),
      status: 'entregue',
      atualizadaEm: agora,
      finalizadaEm: agora,
    },
  }
}

/**
 * R7: o pedido que voltou e sai outra vez vira comanda nova, em rota, com outra taxa. A nova nasce
 * sem papel conferido e sem o "caiu" do Pix (o 006 zera a marca na comanda nova do motoboy).
 */
export function saiuDeNovo(
  c: Comanda,
  area: Area | undefined,
  ctx: { id: string; agora: string },
): Resultado<Comanda> {
  if (c.status !== 'voltou') return { ok: false, erro: 'Só comanda que voltou pode sair de novo.' }
  const taxa = area?.taxa ?? c.taxa
  const erro = validarComanda(c, taxa)
  if (erro) return { ok: false, erro }
  return {
    ok: true,
    valor: {
      ...c,
      id: ctx.id,
      taxa,
      status: 'em_rota',
      pagamentos: c.pagamentos.map((p) => ({ forma: p.forma, valor: p.valor })),
      criadaEm: ctx.agora,
      atualizadaEm: ctx.agora,
      finalizadaEm: null,
      papelConferido: false,
      pixConfirmado: false,
      // A foto fica na comanda que voltou: o caminho dela leva o id daquela (supabase/004).
      fotoPath: null,
    },
  }
}

/** Edição. R3: mantém a taxa gravada; só pega a taxa da tabela se a área mudar. */
export function editarComanda(
  c: Comanda,
  entrada: EntradaComanda,
  area: Area,
  status: Status,
  agora: string,
): Resultado<Comanda> {
  const taxa = area.id === c.areaId ? c.taxa : area.taxa
  const erro = validarComanda(entrada, taxa)
  if (erro) return { ok: false, erro }
  // Hora da entrega: some se voltar para "em rota"; nasce agora se sair dele.
  const finalizadaEm = status === 'em_rota' ? null : (c.finalizadaEm ?? agora)
  // Parte igual à de antes (mesma forma e valor) continua conferida.
  const pagamentos = entrada.pagamentos.map((p, i) => {
    const antes = c.pagamentos[i]
    const igual = antes && antes.forma === p.forma && antes.valor === p.valor
    return igual && antes.conferido
      ? { forma: p.forma, valor: p.valor, conferido: true }
      : { forma: p.forma, valor: p.valor }
  })
  return {
    ok: true,
    valor: {
      ...c,
      codigo: entrada.codigo,
      total: entrada.total,
      pagamentos,
      troco: entrada.troco,
      pixConfirmado: pixAindaConfirmado(c, pagamentos),
      areaId: area.id,
      taxa,
      status,
      atualizadaEm: agora,
      finalizadaEm,
    },
  }
}

/** Marca ou desmarca o comprovante de uma parte (cartão ou Pix na máquina) como conferido. */
export function marcarConferido(c: Comanda, indice: number, conferido: boolean, agora: string): Comanda {
  return {
    ...c,
    pagamentos: c.pagamentos.map((p, i) => (i === indice ? { ...p, conferido } : p)),
    atualizadaEm: agora,
  }
}

/**
 * Comanda gravada antes de existir a hora da entrega (banco antigo ou backup antigo):
 * a última atualização é o melhor palpite para as entregues e as que voltaram.
 */
export const comHoraDeEntrega = (
  c: Omit<Comanda, 'finalizadaEm'> & { finalizadaEm?: string | null },
): Comanda => ({
  ...c,
  finalizadaEm: c.finalizadaEm !== undefined ? c.finalizadaEm : c.status === 'em_rota' ? null : c.atualizadaEm,
})

/** "Dinheiro" ou "Pix antecipado + Dinheiro", para a linha da lista. */
export const nomesFormas = (pagamentos: Pagamento[]) => pagamentos.map((p) => NOMES_FORMA[p.forma]).join(' + ')

/** Área do último pedido com este código, para vir marcada no lançamento. */
export function areaSugerida(codigo: string, comandas: Comanda[]): string | null {
  let ultima: Comanda | null = null
  for (const c of comandas)
    if (c.codigo === codigo && (ultima === null || c.criadaEm > ultima.criadaEm)) ultima = c
  return ultima?.areaId ?? null
}

/** Busca por código na noite: os dígitos digitados em qualquer parte do código. */
export function filtrarPorCodigo(comandas: Comanda[], busca: string): Comanda[] {
  const digitos = busca.replace(/\D/g, '')
  return digitos === '' ? comandas : comandas.filter((c) => c.codigo.includes(digitos))
}

/** R16: marca ou desmarca a comanda de papel como entregue ao Luan. */
export const marcarPapel = (c: Comanda, papelConferido: boolean, agora: string): Comanda => ({
  ...c,
  papelConferido,
  atualizadaEm: agora,
})

/** Pix antecipados confirmados agora (não estavam entre os já vistos), para avisar o motoboy. */
export const pixQueCairam = (vistos: Set<string>, comandas: Comanda[]) =>
  comandas.filter((c) => c.pixConfirmado && !vistos.has(c.id))

export function textoPixCaiu(comandas: Comanda[]): string {
  if (comandas.length === 1) return `Pix da ${comandas[0].codigo} caiu`
  return `Pix caiu: ${comandas.map((c) => c.codigo).join(', ')}`
}
