import { formatarReais } from './dinheiro'
import type { Area, Comanda, Pagamento } from './tipos'

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
