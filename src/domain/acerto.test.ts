import { describe, expect, it } from 'vitest'
import {
  calcularAcerto,
  compararComLuan,
  type Conferencia,
  detalharAcerto,
  diferencaLuan,
  entregasPorCidade,
  itensMaquininha,
  papeisParaConferir,
  registrarContado,
  resumoMaquininha,
  registrarLuan,
  seloLuan,
  tipoDiferenca,
} from './acerto'
import {
  comHoraDeEntrega,
  criarComanda,
  editarComanda,
  marcarConferido,
  marcarEntregue,
  marcarVoltou,
  saiuDeNovo,
  trocarForma,
  type EntradaComanda,
} from './comanda'
import type { Area, Comanda, Forma, Noite, Status } from './tipos'
import { r$ } from '../teste/r$'

const R = (reais: number) => reais * 100

const areasPadrao = (): Area[] => [
  { id: 'aragarcas', nome: 'Aragarças', taxa: R(5), ativa: true },
  { id: 'pontal', nome: 'Pontal', taxa: R(10), ativa: true },
  { id: 'barra', nome: 'Barra', taxa: R(12), ativa: true },
  { id: 'parque', nome: 'Parque de Exposições', taxa: R(15), ativa: true },
]

const noite = (
  dinheiroContado: number | null = null,
  caixaInicial = R(80),
): Pick<Noite, 'caixaInicial' | 'diaria' | 'dinheiroContado'> => ({ caixaInicial, diaria: R(30), dinheiroContado })

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

/** T10: caixa 75, tudo no cartão: 10 em Barra de 50, 2 em Aragarças de 40, 1 em Pontal de 30. */
function noiteT10(areas = areasPadrao()): Comanda[] {
  return [
    ...Array.from({ length: 10 }, (_, i) => lancar(areas, String(1000 + i), 50, 'barra', [['cartao', 50]])),
    lancar(areas, '2000', 40, 'aragarcas', [['cartao', 40]]),
    lancar(areas, '2001', 40, 'aragarcas', [['cartao', 40]]),
    lancar(areas, '3000', 30, 'pontal', [['cartao', 30]]),
  ]
}

const liquidacao = (c: Conferencia | null) => c && {
  falta: c.falta / 100,
  sobra: c.sobra / 100,
  pagar: c.pagar / 100,
  completa: c.completa / 100,
  doCaixaDele: c.doCaixaDele / 100,
  retiradoCaixaEmpresa: c.retiradoCaixaEmpresa / 100,
  vaiParaEmpresa: c.vaiParaEmpresa / 100,
}

describe('v1: liquidação (R14)', () => {
  it('T10 tudo no cartão: 75 do caixa dele e 95 do caixa da empresa', () => {
    const a = calcularAcerto(noite(R(75), R(75)), noiteT10())
    expect([a.devolver, a.maquininha, a.receber]).toEqual([R(75), R(610), R(170)])
    expect(liquidacao(a.conferencia)).toMatchObject({ pagar: 170, doCaixaDele: 75, retiradoCaixaEmpresa: 95, vaiParaEmpresa: 0 })
  })

  it('T11 contado 243', () => {
    expect(liquidacao(calcularAcerto(noite(R(243)), noiteBase()).conferencia)).toMatchObject({
      pagar: 86, doCaixaDele: 80, retiradoCaixaEmpresa: 6, vaiParaEmpresa: 163,
    })
  })

  it('T12 contado 240: falta 3', () => {
    expect(liquidacao(calcularAcerto(noite(R(240)), noiteBase()).conferencia)).toMatchObject({
      falta: 3, pagar: 83, doCaixaDele: 80, retiradoCaixaEmpresa: 3, vaiParaEmpresa: 160,
    })
  })

  it('T13 contado 140: falta 103, completa 17', () => {
    expect(liquidacao(calcularAcerto(noite(R(140)), noiteBase()).conferencia)).toMatchObject({
      falta: 103, pagar: 0, completa: 17, doCaixaDele: 0, retiradoCaixaEmpresa: 0, vaiParaEmpresa: 157,
    })
  })

  it('T14 contado 250: sobra 7', () => {
    expect(liquidacao(calcularAcerto(noite(R(250)), noiteBase()).conferencia)).toMatchObject({
      sobra: 7, pagar: 86, doCaixaDele: 80, retiradoCaixaEmpresa: 6, vaiParaEmpresa: 170,
    })
  })

  it('T15 receber menor que o caixa: o resto do caixa vai para a empresa', () => {
    const a = calcularAcerto(noite(R(120)), [lancar(areasPadrao(), '4321', 40, 'aragarcas', [['dinheiro', 40]])])
    expect(a.receber).toBe(R(35))
    expect(liquidacao(a.conferencia)).toMatchObject({ pagar: 35, doCaixaDele: 35, retiradoCaixaEmpresa: 0, vaiParaEmpresa: 85 })
  })

  it('contado menor que o caixa: o Luan só usa o que ele trouxe', () => {
    expect(liquidacao(calcularAcerto(noite(R(50), R(75)), noiteT10()).conferencia)).toMatchObject({
      falta: 25, pagar: 145, doCaixaDele: 50, retiradoCaixaEmpresa: 95, vaiParaEmpresa: 0,
    })
  })

  it('sem falta: vaiParaEmpresa − retirado = devolver − receber + sobra', () => {
    const casos = [
      calcularAcerto(noite(R(75), R(75)), noiteT10()),
      calcularAcerto(noite(R(243)), noiteBase()),
      calcularAcerto(noite(R(250)), noiteBase()),
      calcularAcerto(noite(R(120)), [lancar(areasPadrao(), '4321', 40, 'aragarcas', [['dinheiro', 40]])]),
    ]
    for (const a of casos) {
      const c = a.conferencia!
      expect(c.falta).toBe(0)
      expect(c.vaiParaEmpresa - c.retiradoCaixaEmpresa).toBe(a.devolver - a.receber + c.sobra)
    }
  })
})

describe('v1: entregas por cidade (R17) e papéis (R16)', () => {
  it('T16 porArea', () => {
    expect(calcularAcerto(noite(), noiteBase()).porArea).toEqual({
      barra: { entregues: 2, voltaram: 1, taxas: R(36) },
      aragarcas: { entregues: 2, voltaram: 0, taxas: R(10) },
      pontal: { entregues: 1, voltaram: 0, taxas: R(10) },
    })
  })

  it('T17 papel conferido em todas menos 2672', () => {
    const comandas = noiteBase().map((c) => ({ ...c, papelConferido: c.codigo !== '2672' }))
    const faltando = calcularAcerto(noite(), comandas).papelFaltando
    expect(faltando.map((c) => c.codigo)).toEqual(['2672'])
    // com os dados para refazer a comanda
    expect(faltando[0]).toMatchObject({ total: R(90), areaId: 'pontal', pagamentos: [{ forma: 'cartao', valor: R(90) }] })
  })

  it('entregas por cidade na ordem das áreas, com total', () => {
    const { linhas, total } = entregasPorCidade(calcularAcerto(noite(), noiteBase()).porArea, areasPadrao())
    expect(linhas.map((l) => [l.nome, l.entregues, l.voltaram, l.taxas])).toEqual([
      ['Aragarças', 2, 0, R(10)],
      ['Pontal', 1, 0, R(10)],
      ['Barra', 2, 1, R(36)],
    ])
    expect(total).toEqual({ entregues: 5, voltaram: 1, taxas: R(56) })
  })

  it('papéis: as que faltam no topo', () => {
    const comandas = noiteBase().map((c, i) => ({ ...c, criadaEm: `20:0${i}`, papelConferido: c.codigo !== '2672' && c.codigo !== '8094' }))
    const r = papeisParaConferir(comandas)
    expect(r.faltando).toBe(2)
    expect(r.lista.map((c) => c.codigo)).toEqual(['2672', '8094', '3557', '0017', '0910', '3595'])
  })

  it('comanda antiga, sem o campo, conta como papel faltando', () => {
    expect(calcularAcerto(noite(), noiteBase()).papelFaltando).toHaveLength(6)
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
    if (!r.ok) expect(r.erro).toBe(r$('As formas somam R$ 45,00, mas o total é R$ 50,00.'))
  })

  it('entra em rota com a taxa da área', () => {
    const r = criarComanda(entrada({}), pontal, ctx)
    expect(r.ok && r.valor.status).toBe('em_rota')
    expect(r.ok && r.valor.taxa).toBe(R(10))
  })

  it('R2 total menor que a taxa é bloqueado', () => {
    const r = criarComanda(entrada({ total: R(8), pagamentos: [{ forma: 'dinheiro', valor: R(8) }] }), pontal, ctx)
    expect(r).toEqual({ ok: false, erro: r$('Total menor que a taxa da área (R$ 10,00).') })
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

describe('ações sobre a comanda', () => {
  const agora = '2026-10-12T22:00:00Z'

  it('T7 pelo fluxo: voltou, saiu de novo e foi entregue', () => {
    const areas = areasPadrao()
    const base = noiteBase(areas)
    const voltou = base.find((c) => c.codigo === '8094')!
    const r = saiuDeNovo(voltou, areas.find((a) => a.id === voltou.areaId), { id: 'nova', agora })
    if (!r.ok) throw new Error(r.erro)
    expect(r.valor).toMatchObject({ id: 'nova', codigo: '8094', status: 'em_rota', taxa: R(12) })
    const a = calcularAcerto(noite(), [...base, marcarEntregue(r.valor, agora)])
    expect(a.devolver).toBe(R(308))
    expect(a.receber).toBe(R(98))
  })

  it('só sai de novo quem voltou', () => {
    const areas = areasPadrao()
    const entregue = noiteBase(areas)[0]
    expect(saiuDeNovo(entregue, areas[2], { id: 'x', agora }).ok).toBe(false)
  })

  it('voltou: a taxa conta, os valores não', () => {
    const areas = areasPadrao()
    const [primeira, ...resto] = noiteBase(areas)
    const a = calcularAcerto(noite(), [marcarVoltou(primeira, agora), ...resto])
    expect(a.devolver).toBe(R(243 - 113))
    expect(a.receber).toBe(R(86))
  })

  it('trocou a forma: novos pagamentos, entregue, com validação', () => {
    const areas = areasPadrao()
    const c = { ...noiteBase(areas)[0], status: 'em_rota' as const } // 3557, 113, dinheiro
    const r = trocarForma(c, { pagamentos: [{ forma: 'cartao', valor: R(113) }], troco: 0 }, agora)
    expect(r.ok && r.valor).toMatchObject({ status: 'entregue', pagamentos: [{ forma: 'cartao', valor: R(113) }] })
    expect(trocarForma(c, { pagamentos: [{ forma: 'cartao', valor: R(100) }], troco: 0 }, agora).ok).toBe(false)
  })

  it('editar mantém a taxa gravada; trocar de área pega a taxa da tabela (R3)', () => {
    const areas = areasPadrao()
    const c = noiteBase(areas)[0] // Barra, taxa 12
    areas[2].taxa = R(13)
    const entrada = { codigo: '3557', total: R(120), pagamentos: [{ forma: 'dinheiro' as const, valor: R(120) }], troco: 0 }
    const mesma = editarComanda(c, entrada, areas[2], 'entregue', agora)
    expect(mesma.ok && [mesma.valor.taxa, mesma.valor.total]).toEqual([R(12), R(120)])
    const outra = editarComanda(c, entrada, areas[3], 'voltou', agora)
    expect(outra.ok && [outra.valor.areaId, outra.valor.taxa, outra.valor.status]).toEqual(['parque', R(15), 'voltou'])
  })
})

describe('tela de acerto', () => {
  const noiteCompleta = (extra: Partial<Noite> = {}): Noite => ({
    id: 'n1', data: '2026-10-12', caixaInicial: R(80), diaria: R(30), dinheiroContado: null,
    fechadaEm: null, luanPagou: null, luanDiferenca: null, minutosAcerto: null, obs: '', ...extra,
  })

  it('situação da conferência', () => {
    const sit = (contado: number) => calcularAcerto(noite(R(contado)), noiteBase()).conferencia!.situacao
    expect([sit(240), sit(243), sit(250)]).toEqual(['falta', 'bateu', 'sobra'])
  })

  it('explica de onde vem cada número', () => {
    const a = calcularAcerto(noite(), noiteBase())
    expect(detalharAcerto(a).map((l) => [l.rotulo, l.valor, l.origem])).toEqual([
      ['Devolver', R(243), r$('R$ 80,00 de caixa + R$ 160,00 em dinheiro + R$ 3,00 de troco por Pix')],
      ['Maquininha', R(162), r$('R$ 90,00 em cartão + R$ 72,00 em Pix na máquina')],
      ['Receber', R(86), r$('R$ 30,00 de diária + R$ 56,00 de taxas (6 comandas)')],
      ['Pix antecipado', R(60), 'Não passa pela sua mão; só a taxa conta'],
    ])
  })

  it('noite vazia', () => {
    const l = detalharAcerto(calcularAcerto(noite(), []))
    expect(l.map((x) => x.origem)).toEqual([
      r$('R$ 80,00 de caixa'),
      'Nada na maquininha',
      r$('R$ 30,00 de diária + R$ 0,00 de taxas (0 comandas)'),
    ])
  })

  it('lista da maquininha: cartão e Pix na máquina das entregues', () => {
    const areas = areasPadrao()
    const comandas = [
      ...noiteBase(areas),
      lancar(areas, '1111', 40, 'pontal', [['cartao', 15], ['dinheiro', 25]]),
      lancar(areas, '2222', 30, 'pontal', [['cartao', 30]], { status: 'voltou' }),
    ]
    expect(itensMaquininha(comandas).map((i) => [i.codigo, i.nomeForma, i.valor])).toEqual([
      ['2672', 'Cartão', R(90)],
      ['0910', 'Pix na máquina', R(72)],
      ['1111', 'Cartão', R(15)],
    ])
  })

  it('falta ou sobra do Luan', () => {
    expect(diferencaLuan('falta', R(3))).toBe(-R(3))
    expect(diferencaLuan('sobra', R(7))).toBe(R(7))
    expect(diferencaLuan('bateu', null)).toBe(0)
    expect(diferencaLuan('falta', null)).toBeNull()
    expect(diferencaLuan(null, R(3))).toBeNull()
    expect([tipoDiferenca(-1), tipoDiferenca(0), tipoDiferenca(5), tipoDiferenca(null)]).toEqual(['falta', 'bateu', 'sobra', null])
  })

  it('compara com o Luan', () => {
    const comandas = noiteBase()
    const comparar = (n: Noite) => compararComLuan(n, calcularAcerto(n, comandas))
    expect(comparar(noiteCompleta())).toBeNull()

    const bateu = comparar(noiteCompleta({ dinheiroContado: R(240), luanPagou: R(83), luanDiferenca: -R(3) }))!
    expect(bateu).toMatchObject({ esperado: R(83), diferencaPago: 0, diferencaFaltaSobra: 0, bateu: true })
    expect(seloLuan(bateu)).toBe('Bateu com o Luan')

    const pagouMenos = comparar(noiteCompleta({ luanPagou: R(84) }))! // sem contado: espera receber 86
    expect(pagouMenos).toMatchObject({ esperado: R(86), diferencaPago: -R(2), diferencaFaltaSobra: null, bateu: false })
    expect(seloLuan(pagouMenos)).toBe(r$('Diferença de R$ 2,00'))

    const faltaDiferente = comparar(noiteCompleta({ dinheiroContado: R(243), luanPagou: R(86), luanDiferenca: -R(5) }))!
    expect(faltaDiferente.bateu).toBe(false)
    expect(seloLuan(faltaDiferente)).toBe(r$('Diferença de R$ 5,00'))
  })

  it('conferência e Luan só com a noite aberta', () => {
    expect(registrarContado(noiteCompleta(), R(240))).toEqual({ ok: true, valor: { dinheiroContado: R(240) } })
    expect(registrarContado(noiteCompleta({ fechadaEm: 'x' }), R(240)).ok).toBe(false)
    const dados = { luanPagou: R(83), luanDiferenca: -R(3), minutosAcerto: 12, obs: '  ' }
    expect(registrarLuan(noiteCompleta(), dados)).toEqual({ ok: true, valor: { ...dados, obs: '' } })
    expect(registrarLuan(noiteCompleta(), { ...dados, minutosAcerto: 1.5 }).ok).toBe(false)
    expect(registrarLuan(noiteCompleta({ fechadaEm: 'x' }), dados).ok).toBe(false)
  })
})

describe('hora da entrega e comprovantes da maquininha', () => {
  const ctx = (id: string, agora: string) => ({ id, noiteId: 'n1', agora })
  const areas = areasPadrao()
  const nova = (codigo: string, total: number, pag: [Forma, number][], criada: string) => {
    const r = criarComanda(
      { codigo, total: R(total), pagamentos: pag.map(([forma, valor]) => ({ forma, valor: R(valor) })), troco: 0 },
      areas[1],
      ctx(codigo, criada),
    )
    if (!r.ok) throw new Error(r.erro)
    return r.valor
  }

  it('grava a hora ao marcar entregue, trocar a forma ou voltar', () => {
    const c = nova('1111', 50, [['cartao', 50]], '20:00')
    expect(c.finalizadaEm).toBeNull()
    expect(marcarEntregue(c, '21:41').finalizadaEm).toBe('21:41')
    expect(marcarVoltou(c, '21:50').finalizadaEm).toBe('21:50')
    const t = trocarForma(c, { pagamentos: [{ forma: 'pix_maquina', valor: R(50) }], troco: 0 }, '21:55')
    expect(t.ok && t.valor.finalizadaEm).toBe('21:55')
    const s = saiuDeNovo({ ...marcarVoltou(c, '21:50'), pagamentos: [{ forma: 'cartao', valor: R(50), conferido: true }] }, areas[1], ctx('x', '22:00'))
    expect(s.ok && [s.valor.finalizadaEm, s.valor.pagamentos[0].conferido]).toEqual([null, undefined])
  })

  it('editar: a hora some ao voltar para em rota e é mantida se já entregue', () => {
    const c = marcarEntregue(nova('1111', 50, [['cartao', 50]], '20:00'), '21:41')
    const entrada = { codigo: '1111', total: R(50), pagamentos: [{ forma: 'cartao' as const, valor: R(50) }], troco: 0 }
    const mantem = editarComanda(c, entrada, areas[1], 'entregue', '23:00')
    expect(mantem.ok && mantem.valor.finalizadaEm).toBe('21:41')
    const emRota = editarComanda(c, entrada, areas[1], 'em_rota', '23:00')
    expect(emRota.ok && emRota.valor.finalizadaEm).toBeNull()
    const deRota = editarComanda(nova('2222', 50, [['cartao', 50]], '20:00'), entrada, areas[1], 'entregue', '23:00')
    expect(deRota.ok && deRota.valor.finalizadaEm).toBe('23:00')
  })

  it('conferido: marca, desmarca e só continua se a parte não mudou na edição', () => {
    const c = marcarEntregue(nova('1111', 50, [['cartao', 20], ['pix_maquina', 30]], '20:00'), '21:41')
    const marcada = marcarConferido(marcarConferido(c, 0, true, '23:00'), 1, true, '23:00')
    expect(marcada.pagamentos.map((p) => p.conferido)).toEqual([true, true])
    expect(marcarConferido(marcada, 0, false, '23:01').pagamentos[0].conferido).toBe(false)
    const editada = editarComanda(
      marcada,
      { codigo: '1111', total: R(50), pagamentos: [{ forma: 'cartao', valor: R(20) }, { forma: 'pix_maquina', valor: R(30) }], troco: 0 },
      areas[1],
      'entregue',
      '23:02',
    )
    expect(editada.ok && editada.valor.pagamentos.map((p) => p.conferido)).toEqual([true, true])
    const mudou = editarComanda(
      marcada,
      { codigo: '1111', total: R(50), pagamentos: [{ forma: 'cartao', valor: R(25) }, { forma: 'pix_maquina', valor: R(25) }], troco: 0 },
      areas[1],
      'entregue',
      '23:02',
    )
    expect(mudou.ok && mudou.valor.pagamentos.map((p) => p.conferido)).toEqual([undefined, undefined])
  })

  it('lista em ordem de horário, separada por forma, com totais e o que falta conferir', () => {
    const a = marcarEntregue(nova('0910', 72, [['pix_maquina', 72]], '20:00'), '2026-10-12T21:55')
    const b = marcarConferido(marcarEntregue(nova('2672', 90, [['cartao', 90]], '20:01'), '2026-10-12T21:41'), 0, true, 'x')
    const c = marcarEntregue(nova('1111', 40, [['cartao', 15], ['dinheiro', 25]], '20:02'), '2026-10-12T21:30')
    const emRota = nova('2222', 30, [['cartao', 30]], '2026-10-12T20:03')
    const voltou = marcarVoltou(nova('3333', 30, [['cartao', 30]], '20:04'), '2026-10-12T21:00')

    const itens = itensMaquininha([a, b, c, emRota, voltou])
    expect(itens.map((i) => [i.codigo, i.hora])).toEqual([
      ['1111', '2026-10-12T21:30'],
      ['2672', '2026-10-12T21:41'],
      ['0910', '2026-10-12T21:55'],
      ['2222', null],
    ])

    const r = resumoMaquininha([a, b, c, emRota, voltou])
    expect(r.grupos.map((g) => [g.nome, g.itens.map((i) => i.codigo), g.total, g.conferidos])).toEqual([
      ['Cartão', ['1111', '2672', '2222'], R(15 + 90 + 30), 1],
      ['Pix na máquina', ['0910'], R(72), 0],
    ])
    expect(r.faltamConferir).toBe(3)
    expect(resumoMaquininha([]).grupos).toEqual([])
  })

  it('comanda antiga sem hora: usa a última atualização (em rota fica sem hora)', () => {
    const { finalizadaEm: _, ...antiga } = marcarEntregue(nova('1111', 50, [['cartao', 50]], '20:00'), '21:41')
    expect(comHoraDeEntrega(antiga).finalizadaEm).toBe('21:41')
    const { finalizadaEm: __, ...antigaEmRota } = nova('2222', 50, [['cartao', 50]], '20:00')
    expect(comHoraDeEntrega(antigaEmRota).finalizadaEm).toBeNull()
  })
})
