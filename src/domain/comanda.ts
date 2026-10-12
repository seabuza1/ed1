import { formatarReais } from './dinheiro'
import type { Area, Comanda, Forma, Pagamento } from './tipos'

export const FORMAS: Forma[] = ['dinheiro', 'cartao', 'pix_maquina', 'pix_antecipado']

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

/** Em rota na ordem de lançamento; entregues e voltaram, a mais recente primeiro. */
export function separarPorStatus(comandas: Comanda[]) {
  const porCriacao = [...comandas].sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))
  const recentes = (s: Comanda['status']) =>
    porCriacao.filter((c) => c.status === s).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm))
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
