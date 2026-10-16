import { describe, expect, it } from 'vitest'
import {
  areaSugerida,
  comandaRepetida,
  descreverPagamentos,
  filtrarPorCodigo,
  marcarPapel,
  montarPagamentos,
  nomesFormas,
  separarPorStatus,
} from './comanda'
import type { Comanda } from './tipos'
import { r$ } from '../teste/r$'

describe('montarPagamentos', () => {
  it('uma forma só: fica com o total', () => {
    expect(montarPagamentos(5000, [{ forma: 'cartao', valor: null }])).toEqual({
      ok: true,
      valor: [{ forma: 'cartao', valor: 5000 }],
    })
  })

  it('linha vazia fica com o resto', () => {
    const r = montarPagamentos(5000, [
      { forma: 'pix_antecipado', valor: 2000 },
      { forma: 'dinheiro', valor: null },
    ])
    expect(r.ok && r.valor).toEqual([
      { forma: 'pix_antecipado', valor: 2000 },
      { forma: 'dinheiro', valor: 3000 },
    ])
  })

  it('todas preenchidas passam como estão (a soma é conferida no lançamento)', () => {
    const r = montarPagamentos(5000, [
      { forma: 'cartao', valor: 2000 },
      { forma: 'dinheiro', valor: 2500 },
    ])
    expect(r.ok && r.valor.map((p) => p.valor)).toEqual([2000, 2500])
  })

  it('bloqueia duas linhas vazias, resto zero ou negativo e nenhuma forma', () => {
    expect(montarPagamentos(5000, [{ forma: 'cartao', valor: null }, { forma: 'dinheiro', valor: null }]).ok).toBe(false)
    expect(montarPagamentos(5000, [{ forma: 'cartao', valor: 5000 }, { forma: 'dinheiro', valor: null }])).toEqual({
      ok: false,
      erro: r$('As formas já somam R$ 50,00. Não sobra resto.'),
    })
    expect(montarPagamentos(5000, []).ok).toBe(false)
  })
})

const c = (codigo: string, status: Comanda['status'], criadaEm: string, atualizadaEm = criadaEm) =>
  ({ id: codigo + criadaEm, codigo, status, criadaEm, atualizadaEm }) as Comanda

describe('R1 código repetido', () => {
  const comandas = [c('3557', 'entregue', '1'), c('8094', 'voltou', '2')]
  it('avisa se já existe com status diferente de voltou', () => {
    expect(comandaRepetida('3557', comandas)?.codigo).toBe('3557')
    expect(comandaRepetida('8094', comandas)).toBeUndefined()
    expect(comandaRepetida('1111', comandas)).toBeUndefined()
  })
  it('ignora a própria comanda ao editar', () => {
    expect(comandaRepetida('3557', comandas, comandas[0].id)).toBeUndefined()
  })
})

it('separa por status', () => {
  const r = separarPorStatus([
    c('1', 'em_rota', '2026-10-12T20:02'),
    c('2', 'em_rota', '2026-10-12T20:01'),
    c('3', 'entregue', '2026-10-12T20:00', '2026-10-12T20:30'),
    c('4', 'entregue', '2026-10-12T20:03', '2026-10-12T20:40'),
    c('5', 'voltou', '2026-10-12T20:04'),
  ])
  expect(r.emRota.map((x) => x.codigo)).toEqual(['2', '1'])
  expect(r.entregues.map((x) => x.codigo)).toEqual(['4', '3'])
  expect(r.voltaram.map((x) => x.codigo)).toEqual(['5'])
})

it('descreve os pagamentos', () => {
  expect(descreverPagamentos([{ forma: 'pix_maquina', valor: 7200 }])).toBe('Pix na máquina')
  expect(
    descreverPagamentos([
      { forma: 'pix_antecipado', valor: 2000 },
      { forma: 'dinheiro', valor: 3000 },
    ]),
  ).toBe(r$('Pix antecipado R$ 20,00 + Dinheiro R$ 30,00'))
})

describe('lançar com menos toques', () => {
  const com = (codigo: string, areaId: string, criadaEm: string) => ({ codigo, areaId, criadaEm }) as Comanda

  it('área sugerida: a do último pedido com o código', () => {
    const historico = [com('3557', 'barra', '2026-10-01T20:00'), com('3557', 'pontal', '2026-10-12T21:00'), com('0017', 'aragarcas', '2026-10-13T20:00')]
    expect(areaSugerida('3557', historico)).toBe('pontal')
    expect(areaSugerida('0017', historico)).toBe('aragarcas')
    expect(areaSugerida('9999', historico)).toBeNull()
  })

  it('busca por código', () => {
    const lista = [com('3557', 'a', '1'), com('0017', 'a', '2'), com('8094', 'a', '3')]
    expect(filtrarPorCodigo(lista, '').map((c) => c.codigo)).toEqual(['3557', '0017', '8094'])
    expect(filtrarPorCodigo(lista, '0').map((c) => c.codigo)).toEqual(['0017', '8094'])
    expect(filtrarPorCodigo(lista, '55').map((c) => c.codigo)).toEqual(['3557'])
  })

  it('nomes das formas na linha', () => {
    expect(nomesFormas([{ forma: 'pix_antecipado', valor: 1 }, { forma: 'dinheiro', valor: 2 }])).toBe('Pix antecipado + Dinheiro')
  })

  it('R16 marca o papel conferido', () => {
    const c = com('2672', 'pontal', '1')
    expect(marcarPapel(c, true, 'agora')).toMatchObject({ papelConferido: true, atualizadaEm: 'agora' })
  })
})
