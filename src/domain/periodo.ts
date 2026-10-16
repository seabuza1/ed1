// Histórico por período (semana e mês): noites trabalhadas, entregas por cidade,
// diárias, taxas e total recebido.
import { calcularAcerto, type Acerto, type PorArea } from './acerto'
import { fimDaSemana, formatarData, inicioDaSemana, nomeDoMes } from './datas'
import type { AcertoConfirmado, Comanda, Noite } from './tipos'

export type Periodo = 'semana' | 'mes'

/** O que ele recebeu na noite: o acerto do Luan quando há; senão, a conta do app (estimado). */
export function recebidoNaNoite(noite: Noite, conta: Acerto, acerto: AcertoConfirmado | null) {
  if (acerto) return { valor: acerto.pagoAoMotoboy, confirmado: true }
  if (noite.luanPagou !== null) return { valor: noite.luanPagou, confirmado: true } // versão local
  return { valor: conta.conferencia ? conta.conferencia.pagar : conta.receber, confirmado: false }
}

export interface ResumoPeriodo {
  chave: string
  rotulo: string
  noites: number
  entregues: number
  voltaram: number
  porArea: Record<string, PorArea>
  diarias: number
  taxas: number
  recebido: number
  /** Noites ainda sem acerto do Luan: o recebido delas é a conta do app. */
  semAcerto: number
}

function chaveDe(data: string, periodo: Periodo) {
  if (periodo === 'mes') return { chave: data.slice(0, 7), rotulo: nomeDoMes(data.slice(0, 7)) }
  const inicio = inicioDaSemana(data)
  return {
    chave: inicio,
    rotulo: `${formatarData(inicio).slice(0, 5)} a ${formatarData(fimDaSemana(inicio)).slice(0, 5)}`,
  }
}

/** Um resumo por semana (de segunda a domingo) ou por mês, o mais recente primeiro. */
export function resumirPorPeriodo(
  noites: Noite[],
  comandas: Comanda[],
  acertos: AcertoConfirmado[],
  periodo: Periodo,
): ResumoPeriodo[] {
  const porNoite = new Map<string, Comanda[]>()
  for (const c of comandas) porNoite.set(c.noiteId, [...(porNoite.get(c.noiteId) ?? []), c])
  const confirmados = new Map(acertos.map((a) => [a.caixaId, a]))
  const resumos = new Map<string, ResumoPeriodo>()

  for (const noite of noites) {
    const { chave, rotulo } = chaveDe(noite.data, periodo)
    const r = resumos.get(chave) ?? {
      chave,
      rotulo,
      noites: 0,
      entregues: 0,
      voltaram: 0,
      porArea: {},
      diarias: 0,
      taxas: 0,
      recebido: 0,
      semAcerto: 0,
    }
    resumos.set(chave, r)
    const conta = calcularAcerto(noite, porNoite.get(noite.id) ?? [])
    r.noites++
    r.diarias += noite.diaria
    r.taxas += conta.taxas
    for (const [areaId, p] of Object.entries(conta.porArea)) {
      const t = (r.porArea[areaId] ??= { entregues: 0, voltaram: 0, taxas: 0 })
      t.entregues += p.entregues
      t.voltaram += p.voltaram
      t.taxas += p.taxas
      r.entregues += p.entregues
      r.voltaram += p.voltaram
    }
    const recebido = recebidoNaNoite(noite, conta, confirmados.get(noite.id) ?? null)
    r.recebido += recebido.valor
    if (!recebido.confirmado) r.semAcerto++
  }
  return [...resumos.values()].sort((a, b) => b.chave.localeCompare(a.chave))
}
