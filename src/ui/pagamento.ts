// Estado do editor de pagamento (texto digitado) e a leitura dele para o domínio.
import { montarPagamentos, NOMES_FORMA, temDinheiro, type LinhaPagamento, type Resultado } from '../domain/comanda'
import { lerReais, paraCampo } from '../domain/dinheiro'
import type { Forma, Pagamento } from '../domain/tipos'

export interface EstadoPagamento {
  dividido: boolean
  forma: Forma | null // uma forma só
  linhas: { forma: Forma; valor: string }[] // pagou de mais de um jeito
  troco: string
}

export const pagamentoVazio = (): EstadoPagamento => ({ dividido: false, forma: null, linhas: [], troco: '' })

export function estadoDe(pagamentos: Pagamento[], troco: number): EstadoPagamento {
  const textoTroco = troco ? paraCampo(troco) : ''
  if (pagamentos.length === 1)
    return { dividido: false, forma: pagamentos[0].forma, linhas: [], troco: textoTroco }
  return {
    dividido: true,
    forma: null,
    linhas: pagamentos.map((p) => ({ forma: p.forma, valor: paraCampo(p.valor) })),
    troco: textoTroco,
  }
}

export const temDinheiroNoEstado = (e: EstadoPagamento) =>
  e.dividido ? e.linhas.some((l) => l.forma === 'dinheiro') : e.forma === 'dinheiro'

function linhasDo(e: EstadoPagamento): Resultado<LinhaPagamento[]> {
  if (!e.dividido)
    return e.forma
      ? { ok: true, valor: [{ forma: e.forma, valor: null }] }
      : { ok: false, erro: 'Escolha a forma de pagamento.' }
  const linhas: LinhaPagamento[] = []
  for (const l of e.linhas) {
    if (l.valor.trim() === '') {
      linhas.push({ forma: l.forma, valor: null })
      continue
    }
    const valor = lerReais(l.valor)
    if (valor === null) return { ok: false, erro: `Valor inválido em ${NOMES_FORMA[l.forma]}.` }
    linhas.push({ forma: l.forma, valor })
  }
  return { ok: true, valor: linhas }
}

export function lerPagamento(
  e: EstadoPagamento,
  total: number,
): Resultado<{ pagamentos: Pagamento[]; troco: number }> {
  const linhas = linhasDo(e)
  if (!linhas.ok) return linhas
  const pagamentos = montarPagamentos(total, linhas.valor)
  if (!pagamentos.ok) return pagamentos
  let troco = 0
  if (temDinheiro(pagamentos.valor) && e.troco.trim() !== '') {
    const t = lerReais(e.troco)
    if (t === null) return { ok: false, erro: 'Troco por Pix inválido.' }
    troco = t
  }
  return { ok: true, valor: { pagamentos: pagamentos.valor, troco } }
}

/** Quanto a linha vazia vai receber, para mostrar enquanto digita. */
export function restoPrevisto(e: EstadoPagamento, total: number | null): number | null {
  if (!e.dividido || total === null) return null
  const linhas = linhasDo(e)
  if (!linhas.ok) return null
  const i = linhas.valor.findIndex((l) => l.valor === null)
  const p = montarPagamentos(total, linhas.valor)
  return i >= 0 && p.ok ? p.valor[i].valor : null
}
