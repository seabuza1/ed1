import type { Comanda, Forma, Noite } from './tipos'

export interface Conferencia {
  contado: number
  dif: number // contado − devolver
  falta: number
  sobra: number
  pagar: number // o que o motoboy recebe depois de descontar a falta
  completa: number // o que ele põe do bolso se a falta passar do que recebe
}

export interface Acerto {
  dinheiro: number
  troco: number
  cartao: number
  pixMaquina: number
  pixAntecipado: number
  taxas: number
  caixaInicial: number
  diaria: number
  devolver: number
  maquininha: number
  receber: number
  conferencia: Conferencia | null
}

type DadosNoite = Pick<Noite, 'caixaInicial' | 'diaria' | 'dinheiroContado'>

const somaForma = (comandas: Comanda[], forma: Forma) =>
  comandas.reduce(
    (s, c) => s + c.pagamentos.reduce((t, p) => (p.forma === forma ? t + p.valor : t), 0),
    0,
  )

/** Conta do acerto (R6, R8–R12). Em rota conta como entregue. */
export function calcularAcerto(noite: DadosNoite, comandas: Comanda[]): Acerto {
  const entregues = comandas.filter((c) => c.status !== 'voltou')

  const dinheiro = somaForma(entregues, 'dinheiro')
  const troco = entregues
    .filter((c) => c.pagamentos.some((p) => p.forma === 'dinheiro'))
    .reduce((s, c) => s + c.troco, 0)
  const cartao = somaForma(entregues, 'cartao')
  const pixMaquina = somaForma(entregues, 'pix_maquina')
  const pixAntecipado = somaForma(entregues, 'pix_antecipado')
  const taxas = comandas.reduce((s, c) => s + c.taxa, 0)

  const devolver = noite.caixaInicial + dinheiro + troco
  const maquininha = cartao + pixMaquina
  const receber = noite.diaria + taxas

  let conferencia: Conferencia | null = null
  if (noite.dinheiroContado !== null) {
    const dif = noite.dinheiroContado - devolver
    const falta = Math.max(0, -dif)
    conferencia = {
      contado: noite.dinheiroContado,
      dif,
      falta,
      sobra: Math.max(0, dif),
      pagar: Math.max(0, receber - falta),
      completa: Math.max(0, falta - receber),
    }
  }

  return {
    dinheiro,
    troco,
    cartao,
    pixMaquina,
    pixAntecipado,
    taxas,
    caixaInicial: noite.caixaInicial,
    diaria: noite.diaria,
    devolver,
    maquininha,
    receber,
    conferencia,
  }
}
