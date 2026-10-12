import { describe, expect, it } from 'vitest'
import { calcularAcerto } from './acerto'
import { criarComanda, type EntradaComanda } from './comanda'
import type { Area, Comanda, Forma, Noite, Status } from './tipos'

const R = (reais: number) => reais * 100

const areasPadrao = (): Area[] => [
  { id: 'aragarcas', nome: 'Aragarças', taxa: R(5), ativa: true },
  { id: 'pontal', nome: 'Pontal', taxa: R(10), ativa: true },
  { id: 'barra', nome: 'Barra', taxa: R(12), ativa: true },
  { id: 'parque', nome: 'Parque de Exposições', taxa: R(15), ativa: true },
]

const noite = (dinheiroContado: number | null = null): Pick<
  Noite,
  'caixaInicial' | 'diaria' | 'dinheiroContado'
> => ({ caixaInicial: R(80), diaria: R(30), dinheiroContado })

let seq = 0
function lancar(
  areas: Area[],
  codigo: string,
  total: number,
  areaId: string,
  pagamentos: [Forma, number][],
  extra: { troco?: number; status?: Status } = {},
): Comanda {
  const area = areas.find((a) => a.id === areaId)!
  const entrada: EntradaComanda = {
    codigo,
    total: R(total),
    pagamentos: pagamentos.map(([forma, valor]) => ({ forma, valor: R(valor) })),
    troco: R(extra.troco ?? 0),
  }
  const r = criarComanda(entrada, area, { id: `c${++seq}`, noiteId: 'n1', agora: '2026-10-12T20:00:00Z' })
  if (!r.ok) throw new Error(r.erro)
  return { ...r.valor, status: extra.status ?? 'entregue' }
}

function noiteBase(areas = areasPadrao()): Comanda[] {
  return [
    lancar(areas, '3557', 113, 'barra', [['dinheiro', 113]]),
    lancar(areas, '0017', 60, 'aragarcas', [['pix_antecipado', 60]]),
    lancar(areas, '2672', 90, 'pontal', [['cartao', 90]]),
    lancar(areas, '0910', 72, 'barra', [['pix_maquina', 72]]),
    lancar(areas, '3595', 47, 'aragarcas', [['dinheiro', 47]], { troco: 3 }),
    lancar(areas, '8094', 65, 'barra', [['dinheiro', 65]], { status: 'voltou' }),
  ]
}

describe('calcularAcerto', () => {
  it('T1 base', () => {
    const a = calcularAcerto(noite(), noiteBase())
    expect(a.devolver).toBe(R(243))
    expect(a.maquininha).toBe(R(162))
    expect(a.receber).toBe(R(86))
    expect(a.pixAntecipado).toBe(R(60))
    expect(a.conferencia).toBeNull()
  })

  it('T2 contado 240: falta 3, pagar 83', () => {
    const c = calcularAcerto(noite(R(240)), noiteBase()).conferencia!
    expect(c.falta).toBe(R(3))
    expect(c.sobra).toBe(0)
    expect(c.pagar).toBe(R(83))
    expect(c.completa).toBe(0)
  })

  it('T3 contado 243: bate, pagar 86', () => {
    const c = calcularAcerto(noite(R(243)), noiteBase()).conferencia!
    expect(c.dif).toBe(0)
    expect(c.falta).toBe(0)
    expect(c.sobra).toBe(0)
    expect(c.pagar).toBe(R(86))
  })

  it('T4 contado 250: sobra 7, pagar 86', () => {
    const c = calcularAcerto(noite(R(250)), noiteBase()).conferencia!
    expect(c.sobra).toBe(R(7))
    expect(c.falta).toBe(0)
    expect(c.pagar).toBe(R(86))
  })

  it('T5 contado 140: falta 103, pagar 0, completa 17', () => {
    const c = calcularAcerto(noite(R(140)), noiteBase()).conferencia!
    expect(c.falta).toBe(R(103))
    expect(c.pagar).toBe(0)
    expect(c.completa).toBe(R(17))
  })

  it('T6 pagamento misto Pix antecipado + dinheiro', () => {
    const areas = areasPadrao()
    const comandas = [
      ...noiteBase(areas),
      lancar(areas, '1234', 50, 'pontal', [
        ['pix_antecipado', 20],
        ['dinheiro', 30],
      ]),
    ]
    const a = calcularAcerto(noite(), comandas)
    expect(a.devolver).toBe(R(273))
    expect(a.maquininha).toBe(R(162))
    expect(a.receber).toBe(R(96))
    expect(a.pixAntecipado).toBe(R(80))
  })

  it('T7 8094 saiu de novo: nova comanda, outra taxa', () => {
    const areas = areasPadrao()
    const comandas = [...noiteBase(areas), lancar(areas, '8094', 65, 'barra', [['dinheiro', 65]])]
    const a = calcularAcerto(noite(), comandas)
    expect(a.devolver).toBe(R(308))
    expect(a.receber).toBe(R(98))
  })

  it('T8 mudar a taxa de Barra não altera comandas lançadas', () => {
    const areas = areasPadrao()
    const comandas = noiteBase(areas)
    areas.find((a) => a.id === 'barra')!.taxa = R(13)
    expect(calcularAcerto(noite(), comandas).receber).toBe(R(86))
    // comanda nova já usa a taxa nova
    expect(lancar(areas, '5555', 40, 'barra', [['dinheiro', 40]]).taxa).toBe(R(13))
  })

  it('em rota conta como entregue', () => {
    const areas = areasPadrao()
    const comandas = [...noiteBase(areas), lancar(areas, '7777', 30, 'pontal', [['dinheiro', 30]], { status: 'em_rota' })]
    expect(calcularAcerto(noite(), comandas).devolver).toBe(R(273))
  })
})

describe('criarComanda', () => {
  const areas = areasPadrao()
  const pontal = areas[1]
  const ctx = { id: 'x', noiteId: 'n1', agora: '2026-10-12T20:00:00Z' }
  const entrada = (e: Partial<EntradaComanda>): EntradaComanda => ({
    codigo: '1234',
    total: R(50),
    pagamentos: [{ forma: 'dinheiro', valor: R(50) }],
    troco: 0,
    ...e,
  })

  it('T9 pagamento misto com soma diferente do total é bloqueado', () => {
    const r = criarComanda(
      entrada({
        pagamentos: [
          { forma: 'pix_antecipado', valor: R(20) },
          { forma: 'dinheiro', valor: R(25) },
        ],
      }),
      pontal,
      ctx,
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toBe('As formas somam R$ 45,00, mas o total é R$ 50,00.')
  })

  it('entra em rota com a taxa da área', () => {
    const r = criarComanda(entrada({}), pontal, ctx)
    expect(r.ok && r.valor.status).toBe('em_rota')
    expect(r.ok && r.valor.taxa).toBe(R(10))
  })

  it('R2 total menor que a taxa é bloqueado', () => {
    const r = criarComanda(entrada({ total: R(8), pagamentos: [{ forma: 'dinheiro', valor: R(8) }] }), pontal, ctx)
    expect(r).toEqual({ ok: false, erro: 'Total menor que a taxa da área (R$ 10,00).' })
  })

  it('R5 troco por Pix só com parte em dinheiro', () => {
    const r = criarComanda(entrada({ pagamentos: [{ forma: 'cartao', valor: R(50) }], troco: R(3) }), pontal, ctx)
    expect(r.ok).toBe(false)
  })

  it('R1 código com 4 dígitos', () => {
    expect(criarComanda(entrada({ codigo: '123' }), pontal, ctx).ok).toBe(false)
    expect(criarComanda(entrada({ codigo: '12a4' }), pontal, ctx).ok).toBe(false)
  })
})
