import { describe, expect, it } from 'vitest'
import { calcularAcerto } from './acerto'
import { fimDaSemana, inicioDaSemana, nomeDoMes, somarDias } from './datas'
import { recebidoNaNoite, resumirPorPeriodo } from './periodo'
import type { AcertoConfirmado, Comanda, Noite } from './tipos'

const R = (reais: number) => reais * 100
const noite = (id: string, data: string, extra: Partial<Noite> = {}): Noite => ({
  id, data, caixaInicial: R(80), diaria: R(30), dinheiroContado: null, fechadaEm: 'x',
  luanPagou: null, luanDiferenca: null, minutosAcerto: null, obs: '', ...extra,
})
const comanda = (noiteId: string, areaId: string, taxa: number, status: Comanda['status'] = 'entregue') =>
  ({ noiteId, areaId, taxa: R(taxa), status, total: R(50), troco: 0, pagamentos: [{ forma: 'cartao', valor: R(50) }] }) as Comanda

describe('datas do período', () => {
  it('semana de segunda a domingo', () => {
    expect(inicioDaSemana('2026-10-16')).toBe('2026-10-12') // sexta → segunda
    expect(inicioDaSemana('2026-10-12')).toBe('2026-10-12')
    expect(inicioDaSemana('2026-10-18')).toBe('2026-10-12') // domingo
    expect(inicioDaSemana('2026-11-01')).toBe('2026-10-26')
    expect(fimDaSemana('2026-10-26')).toBe('2026-11-01')
  })
  it('somar dias vira o mês e volta', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('nome do mês', () => expect(nomeDoMes('2026-10')).toBe('Outubro de 2026'))
})

describe('histórico por período', () => {
  const noites = [
    noite('a', '2026-10-12'),
    noite('b', '2026-10-16', { dinheiroContado: R(80) }),
    noite('c', '2026-11-02', { luanPagou: R(50) }),
  ]
  const comandas = [
    comanda('a', 'barra', 12),
    comanda('a', 'barra', 12, 'voltou'),
    comanda('a', 'pontal', 10),
    comanda('b', 'aragarcas', 5),
    comanda('c', 'barra', 12),
  ]
  const acertos = [{ caixaId: 'a', pagoAoMotoboy: R(60) } as AcertoConfirmado]

  it('por semana', () => {
    const r = resumirPorPeriodo(noites, comandas, acertos, 'semana')
    expect(r.map((p) => [p.rotulo, p.noites, p.entregues, p.voltaram, p.diarias, p.taxas, p.recebido, p.semAcerto])).toEqual([
      ['02/11 a 08/11', 1, 1, 0, R(30), R(12), R(50), 0],
      // a: confirmado 60; b: conta do app (contado 80 bate, recebe 30 + 5)
      ['12/10 a 18/10', 2, 3, 1, R(60), R(39), R(60 + 35), 1],
    ])
    expect(r[1].porArea).toEqual({
      barra: { entregues: 1, voltaram: 1, taxas: R(24) },
      pontal: { entregues: 1, voltaram: 0, taxas: R(10) },
      aragarcas: { entregues: 1, voltaram: 0, taxas: R(5) },
    })
  })

  it('por mês', () => {
    const r = resumirPorPeriodo(noites, comandas, acertos, 'mes')
    expect(r.map((p) => [p.rotulo, p.noites, p.recebido])).toEqual([
      ['Novembro de 2026', 1, R(50)],
      ['Outubro de 2026', 2, R(95)],
    ])
  })

  it('o recebido da noite: acerto do Luan, senão a conta do app', () => {
    const n = noite('x', '2026-10-16')
    const conta = calcularAcerto(n, [comanda('x', 'barra', 12)])
    expect(recebidoNaNoite(n, conta, null)).toEqual({ valor: R(42), confirmado: false })
    expect(recebidoNaNoite(n, conta, { pagoAoMotoboy: R(40) } as AcertoConfirmado)).toEqual({ valor: R(40), confirmado: true })
  })
})
