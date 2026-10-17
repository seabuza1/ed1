import { describe, expect, it } from 'vitest'
import { calcularAcerto, entregasPorCidade } from './acerto'
import {
  colunaPix,
  formaCurta,
  montarAcerto,
  montarFolha,
  numerosDaNoite,
  resumirNoiteDaEquipe,
  textoLiquidacao,
  type CaixaDoMotoboy,
} from './painel'
import type { AcertoConfirmado, Area, Comanda, Forma, Noite, Status } from './tipos'
import { r$ } from '../teste/r$'

const R = (reais: number) => reais * 100
const areas: Area[] = [
  { id: 'aragarcas', nome: 'Aragarças', taxa: R(5), ativa: true },
  { id: 'pontal', nome: 'Pontal', taxa: R(10), ativa: true },
  { id: 'barra', nome: 'Barra', taxa: R(12), ativa: true },
]
const taxa = (areaId: string) => areas.find((a) => a.id === areaId)!.taxa

let seq = 0
const comanda = (
  noiteId: string,
  codigo: string,
  total: number,
  areaId: string,
  pag: [Forma, number][],
  extra: Partial<Comanda> & { status?: Status } = {},
): Comanda => ({
  id: `c${++seq}`,
  noiteId,
  codigo,
  total: R(total),
  areaId,
  taxa: taxa(areaId),
  status: 'entregue',
  troco: 0,
  pagamentos: pag.map(([forma, v]) => ({ forma, valor: R(v) })),
  criadaEm: `2026-10-16T20:${String(seq).padStart(2, '0')}:00Z`,
  atualizadaEm: '2026-10-16T20:00:00Z',
  finalizadaEm: null,
  ...extra,
})

const noite = (id: string, extra: Partial<Noite> = {}): Noite => ({
  id,
  data: '2026-10-16',
  caixaInicial: R(80),
  diaria: R(30),
  dinheiroContado: null,
  fechadaEm: null,
  luanPagou: null,
  luanDiferenca: null,
  minutosAcerto: null,
  obs: '',
  ...extra,
})

const caixa = (n: Noite, nome: string, ordem: number | null, criadoEm = '2026-10-16T18:00:00Z'): CaixaDoMotoboy => ({
  noite: n,
  motoboyId: nome,
  nome,
  ordem,
  criadoEm,
})

/** A noite base do MVP com o Felipe; o João com duas comandas. */
function noiteDaFolha(felipe = noite('f'), joao = noite('j')) {
  const comandas = [
    comanda('f', '3557', 113, 'barra', [['dinheiro', 113]]),
    comanda('f', '0017', 60, 'aragarcas', [['pix_antecipado', 60]]),
    comanda('f', '2672', 90, 'pontal', [['cartao', 90]]),
    comanda('f', '0910', 72, 'barra', [['pix_maquina', 72]]),
    comanda('f', '3595', 47, 'aragarcas', [['dinheiro', 47]], { troco: R(3) }),
    comanda('f', '8094', 65, 'barra', [['dinheiro', 65]], { status: 'voltou' }),
    comanda('j', '8498', 70, 'pontal', [['pix_antecipado', 20], ['dinheiro', 50]]),
    comanda('j', '1693', 40, 'aragarcas', [['cartao', 40]], { status: 'em_rota' }),
  ]
  // João chegou depois, mas sem ordem (aberto sem internet): vai para o fim.
  return { caixas: [caixa(joao, 'João', null, '2026-10-16T17:00:00Z'), caixa(felipe, 'Felipe', 1)], comandas }
}

describe('folha da noite', () => {
  it('uma coluna por motoboy, na ordem de chegada, com forma, troco e rodapé', () => {
    const { caixas, comandas } = noiteDaFolha()
    const folha = montarFolha(caixas, comandas, [])
    expect(folha.map((c) => [c.posicao, c.caixa.nome])).toEqual([
      [1, 'Felipe'],
      [2, 'João'],
    ])
    const [felipe, joao] = folha
    expect(felipe.itens.map((i) => `${i.comanda.codigo} ${i.forma}${i.trocoPix ? ` →${i.trocoPix}` : ''}`)).toEqual([
      '3557 din',
      '0017 pix',
      '2672 cartão',
      '0910 pix máq',
      '3595 din →300',
      '8094 din',
    ])
    expect([felipe.entregas, felipe.conta.devolver, felipe.conta.receber]).toEqual([6, R(243), R(86)])
    expect(joao.itens.map((i) => i.forma)).toEqual(['pix+din', 'cartão'])
    expect([joao.entregas, joao.conta.devolver, joao.conta.receber]).toEqual([2, R(130), R(45)])
    expect(felipe.itens.some((i) => i.papelPendente)).toBe(false) // acerto ainda não aberto
  })

  it('"•" de papel faltando só depois de aberto o acerto', () => {
    const { caixas, comandas } = noiteDaFolha(noite('f', { dinheiroContado: R(243) }))
    const conferidas = comandas.map((c) => ({ ...c, papelConferido: c.codigo !== '2672' }))
    const [felipe, joao] = montarFolha(caixas, conferidas, [])
    expect(felipe.acertoAberto).toBe(true)
    expect(felipe.itens.filter((i) => i.papelPendente).map((i) => i.comanda.codigo)).toEqual(['2672'])
    expect(joao.acertoAberto).toBe(false)
  })

  it('coluna PIX: os Pix antecipados da noite, de todos os motoboys', () => {
    const { caixas, comandas } = noiteDaFolha()
    const pix = colunaPix(montarFolha(caixas, comandas, []))
    expect(pix.map((p) => [p.comanda.codigo, p.nome, p.valor])).toEqual([
      ['0017', 'Felipe', R(60)],
      ['8498', 'João', R(20)],
    ])
  })

  it('números da noite: status, Pix a conferir, acertos pendentes e somas', () => {
    const { caixas, comandas } = noiteDaFolha()
    const caiu = comandas.map((c) => (c.codigo === '0017' ? { ...c, pixConfirmado: true } : c))
    const n = numerosDaNoite(montarFolha(caixas, caiu, [{ caixaId: 'j' } as AcertoConfirmado]))
    expect(n).toEqual({
      motoboys: 2,
      emRota: 1,
      entregues: 6,
      voltaram: 1,
      pixAConferir: 1,
      acertosPendentes: 1,
      devolver: R(243 + 130),
      receber: R(86 + 45),
    })
  })

  it('formas curtas', () => expect(formaCurta([{ forma: 'pix_antecipado', valor: 1 }, { forma: 'dinheiro', valor: 1 }])).toBe('pix+din'))
})

describe('acerto pelo Luan', () => {
  it('grava os valores do momento (T11)', () => {
    const { comandas } = noiteDaFolha()
    const r = montarAcerto(noite('f', { dinheiroContado: R(243) }), comandas.filter((c) => c.noiteId === 'f'))
    expect(r).toEqual({
      ok: true,
      valor: {
        caixaId: 'f',
        dinheiroContado: R(243),
        falta: 0,
        sobra: 0,
        pagoAoMotoboy: R(86),
        pagoDoCaixaDele: R(80),
        retiradoCaixaEmpresa: R(6),
        vaiParaEmpresa: R(163),
        completadoDoBolso: 0,
      },
    })
    expect(montarAcerto(noite('f'), [])).toEqual({ ok: false, erro: 'Informe o dinheiro contado.' })
  })

  it('a frase da liquidação', () => {
    const conf = (contado: number, caixaInicial = R(80), comandas = noiteDaFolha().comandas.filter((c) => c.noiteId === 'f')) =>
      calcularAcerto(noite('f', { caixaInicial, dinheiroContado: contado }), comandas).conferencia!
    // T10: tudo no cartão, caixa 75
    const t10 = [
      ...Array.from({ length: 10 }, (_, i) => comanda('f', String(1000 + i), 50, 'barra', [['cartao', 50]])),
      comanda('f', '2000', 40, 'aragarcas', [['cartao', 40]]),
      comanda('f', '2001', 40, 'aragarcas', [['cartao', 40]]),
      comanda('f', '3000', 30, 'pontal', [['cartao', 30]]),
    ]
    expect(textoLiquidacao(conf(R(75), R(75), t10))).toBe(r$('Pague R$ 75,00 do caixa dele e retire R$ 95,00 do caixa da empresa.'))
    expect(textoLiquidacao(conf(R(243)))).toBe(r$('Pague R$ 80,00 do caixa dele e retire R$ 6,00 do caixa da empresa.'))
    expect(textoLiquidacao(conf(R(120), R(80), [comanda('f', '4321', 40, 'aragarcas', [['dinheiro', 40]])]))).toBe(
      r$('Pague R$ 35,00 do caixa dele.'),
    )
    expect(textoLiquidacao(conf(R(140)))).toBe(r$('Não pague nada: ele completa R$ 17,00 do bolso.'))
  })
})

describe('resumo da noite', () => {
  it('soma por forma, o pago, o retirado, o da empresa, faltas, sobras e cidades', () => {
    const { caixas, comandas } = noiteDaFolha(noite('f', { dinheiroContado: R(240) }), noite('j'))
    const confirmadoJoao = {
      caixaId: 'j',
      pagoAoMotoboy: R(45),
      retiradoCaixaEmpresa: 0,
      vaiParaEmpresa: R(85),
      falta: 0,
      sobra: R(2),
    } as AcertoConfirmado
    const r = resumirNoiteDaEquipe(montarFolha(caixas, comandas, [confirmadoJoao]))
    expect(r.recebido).toEqual({ dinheiro: R(160 + 50), cartao: R(90 + 40), pixMaquina: R(72), pixAntecipado: R(60 + 20), troco: R(3) })
    // Felipe pela conta de agora (T12), João pelo que foi confirmado.
    expect([r.pagoAosMotoboys, r.retiradoCaixaEmpresa, r.foiParaEmpresa, r.faltas, r.sobras]).toEqual([
      R(83 + 45),
      R(3),
      R(160 + 85),
      R(3),
      R(2),
    ])
    expect([r.confirmados, r.pendentes, r.semContado]).toEqual([1, 1, 0])
    expect(entregasPorCidade(r.porArea, areas).linhas.map((l) => [l.nome, l.entregues, l.voltaram, l.taxas])).toEqual([
      ['Aragarças', 3, 0, R(15)],
      ['Pontal', 2, 0, R(20)],
      ['Barra', 2, 1, R(36)],
    ])
  })

  it('sem dinheiro contado o caixa fica fora das somas do acerto', () => {
    const { caixas, comandas } = noiteDaFolha()
    const r = resumirNoiteDaEquipe(montarFolha(caixas, comandas, []))
    expect([r.pagoAosMotoboys, r.semContado, r.pendentes]).toEqual([0, 2, 2])
  })
})
