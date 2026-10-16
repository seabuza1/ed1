import type { Caixa, Comanda, Forma } from './tipos'

export type DadosCaixa = Pick<Caixa, 'caixaInicial' | 'diaria' | 'dinheiroContado'>

export interface PorArea {
  entregues: number
  voltaram: number
  taxas: number
}

/** Só existe depois de informado o dinheiro contado. */
export interface Conferencia {
  dif: number
  falta: number
  sobra: number
  pagar: number
  completa: number
  // R14 Liquidação
  doCaixaDele: number
  retiradoCaixaEmpresa: number
  vaiParaEmpresa: number
}

export interface Acerto {
  dinheiro: number
  troco: number
  cartao: number
  pixMaquina: number
  pixAntecipado: number
  taxas: number
  devolver: number
  maquininha: number
  receber: number
  conferencia: Conferencia | null
  porArea: Record<string, PorArea> // chave: areaId
  papelFaltando: Comanda[]
}

const soma = (valores: number[]) => valores.reduce((s, v) => s + v, 0)

const temDinheiro = (c: Comanda) => c.pagamentos.some((p) => p.forma === 'dinheiro')

const somaForma = (comandas: Comanda[], forma: Forma) =>
  soma(comandas.flatMap((c) => c.pagamentos.filter((p) => p.forma === forma).map((p) => p.valor)))

export function calcularAcerto(caixa: DadosCaixa, comandas: Comanda[]): Acerto {
  // em_rota conta como entregue (R6)
  const entregues = comandas.filter((c) => c.status !== 'voltou')

  const dinheiro = somaForma(entregues, 'dinheiro')
  const troco = soma(entregues.filter(temDinheiro).map((c) => c.troco))
  const cartao = somaForma(entregues, 'cartao')
  const pixMaquina = somaForma(entregues, 'pix_maquina')
  const pixAntecipado = somaForma(entregues, 'pix_antecipado')
  const taxas = soma(comandas.map((c) => c.taxa)) // inclusive as que voltaram

  const devolver = caixa.caixaInicial + dinheiro + troco
  const maquininha = cartao + pixMaquina
  const receber = caixa.diaria + taxas

  return {
    dinheiro,
    troco,
    cartao,
    pixMaquina,
    pixAntecipado,
    taxas,
    devolver,
    maquininha,
    receber,
    conferencia:
      caixa.dinheiroContado === null
        ? null
        : conferir(caixa.caixaInicial, devolver, receber, caixa.dinheiroContado),
    porArea: entregasPorArea(comandas),
    papelFaltando: papelFaltando(comandas),
  }
}

function conferir(caixaInicial: number, devolver: number, receber: number, contado: number): Conferencia {
  const dif = contado - devolver
  const falta = Math.max(0, -dif)
  const sobra = Math.max(0, dif)
  const pagar = Math.max(0, receber - falta)
  const completa = Math.max(0, falta - receber)

  // R14: o Luan paga primeiro com o caixa inicial dele; o resto sai do caixa da empresa.
  const doCaixaDele = Math.min(caixaInicial, pagar, contado)
  const retiradoCaixaEmpresa = pagar - doCaixaDele
  const vaiParaEmpresa = contado - doCaixaDele + completa

  return { dif, falta, sobra, pagar, completa, doCaixaDele, retiradoCaixaEmpresa, vaiParaEmpresa }
}

/** R17: por área, entregues, que voltaram e taxas (a taxa conta também nas que voltaram). */
export function entregasPorArea(comandas: Comanda[]): Record<string, PorArea> {
  const porArea: Record<string, PorArea> = {}
  for (const c of comandas) {
    const a = (porArea[c.areaId] ??= { entregues: 0, voltaram: 0, taxas: 0 })
    if (c.status === 'voltou') a.voltaram++
    else a.entregues++
    a.taxas += c.taxa
  }
  return porArea
}

/** R16: comandas cujo papel não foi entregue ao Luan. */
export function papelFaltando(comandas: Comanda[]): Comanda[] {
  return comandas.filter((c) => !c.papelConferido)
}
