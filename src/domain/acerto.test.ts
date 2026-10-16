import { describe, expect, it } from 'vitest'
import { calcularAcerto, type Conferencia, type DadosCaixa } from './acerto'
import type { Area, Comanda, Forma, Pagamento } from './tipos'

const R = (reais: number) => reais * 100

function tabela(): Record<string, Area> {
  return {
    aragarcas: { id: 'aragarcas', nome: 'Aragarças', taxa: R(5), ativa: true },
    pontal: { id: 'pontal', nome: 'Pontal', taxa: R(10), ativa: true },
    barra: { id: 'barra', nome: 'Barra', taxa: R(12), ativa: true },
    parque: { id: 'parque', nome: 'Parque de Exposições', taxa: R(15), ativa: true },
  }
}

let seq = 0
/** A taxa é copiada da área no lançamento (R3). */
function comanda(
  codigo: string,
  total: number,
  area: Area,
  pagamento: Forma | Pagamento[],
  extra: Partial<Comanda> = {},
): Comanda {
  const pagamentos = typeof pagamento === 'string' ? [{ forma: pagamento, valor: R(total) }] : pagamento
  return {
    id: `c${++seq}`,
    caixaId: 'cx',
    codigo,
    total: R(total),
    areaId: area.id,
    taxa: area.taxa,
    status: 'entregue',
    pagamentos,
    troco: 0,
    papelConferido: false,
    pixConfirmado: false,
    criadoEm: '2026-10-16T20:00:00Z',
    atualizadoEm: '2026-10-16T20:00:00Z',
    ...extra,
  }
}

function noiteBase(areas = tabela()): Comanda[] {
  return [
    comanda('3557', 113, areas.barra, 'dinheiro'),
    comanda('0017', 60, areas.aragarcas, 'pix_antecipado'),
    comanda('2672', 90, areas.pontal, 'cartao'),
    comanda('0910', 72, areas.barra, 'pix_maquina'),
    comanda('3595', 47, areas.aragarcas, 'dinheiro', { troco: R(3) }),
    comanda('8094', 65, areas.barra, 'dinheiro', { status: 'voltou' }),
  ]
}

/** T10: 10 em Barra de 50, 2 em Aragarças de 40, 1 em Pontal de 30, tudo no cartão. */
function noiteT10(areas = tabela()): Comanda[] {
  return [
    ...Array.from({ length: 10 }, (_, i) => comanda(String(1000 + i), 50, areas.barra, 'cartao')),
    comanda('2000', 40, areas.aragarcas, 'cartao'),
    comanda('2001', 40, areas.aragarcas, 'cartao'),
    comanda('3000', 30, areas.pontal, 'cartao'),
  ]
}

const caixa = (dinheiroContado: number | null = null, caixaInicial = 80): DadosCaixa => ({
  caixaInicial: R(caixaInicial),
  diaria: R(30),
  dinheiroContado: dinheiroContado === null ? null : R(dinheiroContado),
})

const emReais = (c: Conferencia | null) =>
  c && Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / 100]))

describe('MVP (T1 a T9 em acerto)', () => {
  it('T1 base', () => {
    const a = calcularAcerto(caixa(), noiteBase())
    expect(a.devolver).toBe(R(243))
    expect(a.maquininha).toBe(R(162))
    expect(a.receber).toBe(R(86))
    expect(a.pixAntecipado).toBe(R(60))
    expect(a.conferencia).toBeNull()
  })

  it('T2 contado 240: falta 3, pagar 83', () => {
    const c = calcularAcerto(caixa(240), noiteBase()).conferencia
    expect(emReais(c)).toMatchObject({ falta: 3, sobra: 0, pagar: 83, completa: 0 })
  })

  it('T3 contado 243: bate, pagar 86', () => {
    const c = calcularAcerto(caixa(243), noiteBase()).conferencia
    expect(emReais(c)).toMatchObject({ dif: 0, falta: 0, sobra: 0, pagar: 86, completa: 0 })
  })

  it('T4 contado 250: sobra 7, pagar 86', () => {
    const c = calcularAcerto(caixa(250), noiteBase()).conferencia
    expect(emReais(c)).toMatchObject({ falta: 0, sobra: 7, pagar: 86 })
  })

  it('T5 contado 140: falta 103, pagar 0, completa 17', () => {
    const c = calcularAcerto(caixa(140), noiteBase()).conferencia
    expect(emReais(c)).toMatchObject({ falta: 103, pagar: 0, completa: 17 })
  })

  it('T6 pagamento misto com Pix antecipado e dinheiro', () => {
    const areas = tabela()
    const comandas = [
      ...noiteBase(areas),
      comanda('1234', 50, areas.pontal, [
        { forma: 'pix_antecipado', valor: R(20) },
        { forma: 'dinheiro', valor: R(30) },
      ]),
    ]
    const a = calcularAcerto(caixa(), comandas)
    expect(a.devolver).toBe(R(273))
    expect(a.maquininha).toBe(R(162))
    expect(a.receber).toBe(R(96))
    expect(a.pixAntecipado).toBe(R(80))
  })

  it('T7 8094 saiu de novo: nova comanda e outra taxa', () => {
    const areas = tabela()
    const comandas = [...noiteBase(areas), comanda('8094', 65, areas.barra, 'dinheiro')]
    const a = calcularAcerto(caixa(), comandas)
    expect(a.devolver).toBe(R(308))
    expect(a.receber).toBe(R(98))
  })

  it('T8 mudar a taxa de Barra não altera comandas já lançadas', () => {
    const areas = tabela()
    const comandas = noiteBase(areas)
    areas.barra.taxa = R(13)
    expect(calcularAcerto(caixa(), comandas).receber).toBe(R(86))
  })
})

describe('v1 liquidação (T10 a T15)', () => {
  it('T10 tudo no cartão: o Luan tira 95 do caixa da empresa', () => {
    const comandas = noiteT10()
    const a = calcularAcerto(caixa(75, 75), comandas)
    expect(a.devolver).toBe(R(75))
    expect(a.maquininha).toBe(R(610))
    expect(a.receber).toBe(R(170))
    expect(emReais(a.conferencia)).toMatchObject({
      pagar: 170,
      doCaixaDele: 75,
      retiradoCaixaEmpresa: 95,
      vaiParaEmpresa: 0,
    })
  })

  it('T11 contado 243', () => {
    const c = calcularAcerto(caixa(243), noiteBase()).conferencia
    expect(emReais(c)).toMatchObject({ pagar: 86, doCaixaDele: 80, retiradoCaixaEmpresa: 6, vaiParaEmpresa: 163 })
  })

  it('T12 contado 240: falta 3', () => {
    const c = calcularAcerto(caixa(240), noiteBase()).conferencia
    expect(emReais(c)).toMatchObject({
      falta: 3,
      pagar: 83,
      doCaixaDele: 80,
      retiradoCaixaEmpresa: 3,
      vaiParaEmpresa: 160,
    })
  })

  it('T13 contado 140: falta 103, completa 17', () => {
    const c = calcularAcerto(caixa(140), noiteBase()).conferencia
    expect(emReais(c)).toMatchObject({
      falta: 103,
      pagar: 0,
      completa: 17,
      doCaixaDele: 0,
      retiradoCaixaEmpresa: 0,
      vaiParaEmpresa: 157,
    })
  })

  it('T14 contado 250: sobra 7', () => {
    const c = calcularAcerto(caixa(250), noiteBase()).conferencia
    expect(emReais(c)).toMatchObject({
      sobra: 7,
      pagar: 86,
      doCaixaDele: 80,
      retiradoCaixaEmpresa: 6,
      vaiParaEmpresa: 170,
    })
  })

  it('T15 receber menor que o caixa: o resto do caixa vai para a empresa', () => {
    const a = calcularAcerto(caixa(120), [comanda('4321', 40, tabela().aragarcas, 'dinheiro')])
    expect(a.receber).toBe(R(35))
    expect(emReais(a.conferencia)).toMatchObject({
      pagar: 35,
      doCaixaDele: 35,
      retiradoCaixaEmpresa: 0,
      vaiParaEmpresa: 85,
    })
  })

  it('contado menor que o caixa: o Luan só usa o que ele trouxe', () => {
    const comandas = noiteT10()
    const c = calcularAcerto(caixa(50, 75), comandas).conferencia
    expect(emReais(c)).toMatchObject({
      falta: 25,
      pagar: 145,
      doCaixaDele: 50,
      retiradoCaixaEmpresa: 95,
      vaiParaEmpresa: 0,
    })
  })

  it('conferência sem falta: vaiParaEmpresa − retirado = devolver − receber + sobra', () => {
    const areas = tabela()
    const casos: [DadosCaixa, Comanda[]][] = [
      [caixa(75, 75), [comanda('1000', 50, areas.barra, 'cartao')]],
      [caixa(243), noiteBase()],
      [caixa(250), noiteBase()],
      [caixa(120), [comanda('4321', 40, areas.aragarcas, 'dinheiro')]],
    ]
    for (const [cx, comandas] of casos) {
      const a = calcularAcerto(cx, comandas)
      const c = a.conferencia!
      expect(c.falta).toBe(0)
      expect(c.vaiParaEmpresa - c.retiradoCaixaEmpresa).toBe(a.devolver - a.receber + c.sobra)
    }
  })
})

describe('v1 entregas por cidade e papéis (T16, T17)', () => {
  it('T16 porArea', () => {
    expect(calcularAcerto(caixa(), noiteBase()).porArea).toEqual({
      barra: { entregues: 2, voltaram: 1, taxas: R(36) },
      aragarcas: { entregues: 2, voltaram: 0, taxas: R(10) },
      pontal: { entregues: 1, voltaram: 0, taxas: R(10) },
    })
  })

  it('T17 papel conferido em todas menos 2672', () => {
    const comandas = noiteBase().map((c) => ({ ...c, papelConferido: c.codigo !== '2672' }))
    const faltando = calcularAcerto(caixa(), comandas).papelFaltando
    expect(faltando.map((c) => c.codigo)).toEqual(['2672'])
    expect(faltando[0]).toMatchObject({ total: R(90), areaId: 'pontal', pagamentos: [{ forma: 'cartao' }] })
  })
})
