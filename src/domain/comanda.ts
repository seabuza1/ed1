import { formatarReais } from './dinheiro'
import type { Comanda } from './tipos'

export type DadosComanda = Pick<Comanda, 'codigo' | 'total' | 'taxa' | 'pagamentos' | 'troco'>

/** Regras do lançamento (R1, R2, R4, R5). Devolve a mensagem do primeiro erro ou null. */
export function validarComanda(c: DadosComanda): string | null {
  if (!/^\d{4}$/.test(c.codigo)) return 'O código tem 4 dígitos.'
  if (!Number.isInteger(c.total) || c.total <= 0) return 'Informe o total.'
  if (c.total < c.taxa) return `O total é menor que a taxa da área (${formatarReais(c.taxa)}).`
  if (c.pagamentos.length === 0) return 'Escolha a forma de pagamento.'
  if (c.pagamentos.some((p) => !Number.isInteger(p.valor) || p.valor <= 0)) {
    return 'Cada forma precisa de um valor.'
  }
  const soma = c.pagamentos.reduce((s, p) => s + p.valor, 0)
  if (soma !== c.total) {
    return `As formas somam ${formatarReais(soma)}, mas o total é ${formatarReais(c.total)}.`
  }
  if (!Number.isInteger(c.troco) || c.troco < 0) return 'Troco inválido.'
  if (c.troco > 0 && !c.pagamentos.some((p) => p.forma === 'dinheiro')) {
    return 'Troco por Pix só existe com pagamento em dinheiro.'
  }
  return null
}
