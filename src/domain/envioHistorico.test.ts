import { describe, expect, it } from 'vitest'
import type { Dados } from './backup'
import { mapearAreas, obsComLuan, planejarEnvioHistorico } from './envioHistorico'
import type { Area, Comanda, Noite } from './tipos'
import { r$ } from '../teste/r$'

const area = (id: string, nome: string, taxa: number): Area => ({ id, nome, taxa, ativa: true })
const locais = [area('l1', 'Aragarças', 500), area('l2', 'Pontal', 1000), area('l3', 'Barra', 1200), area('l4', 'Parque de Exposições', 1500)]
const nuvem = [
  area('n1', 'Aragarças', 500),
  area('n2', 'Pontal do Araguaia', 1000),
  area('n3', 'Barra do Garças', 1200),
  area('n4', 'Parque de Exposições', 1500),
]

const noite = (id: string, data: string, extra: Partial<Noite> = {}): Noite => ({
  id, data, caixaInicial: 8000, diaria: 3000, dinheiroContado: null, fechadaEm: '2026-10-13T03:00:00Z',
  luanPagou: null, luanDiferenca: null, minutosAcerto: null, obs: '', ...extra,
})
const comanda = (id: string, noiteId: string, areaId: string) =>
  ({ id, noiteId, areaId, codigo: '1234', total: 5000, taxa: 1000 }) as Comanda

describe('enviar o histórico local para a nuvem', () => {
  it('acha o par de cada área: mesmo nome, começo do nome ou mesma taxa', () => {
    const { mapa, semPar } = mapearAreas([...locais, area('l5', 'Distrito', 2500), area('l6', 'Zona rural', 1200)], [
      ...nuvem,
      area('n5', 'Distrito X', 9999),
    ])
    expect(Object.fromEntries(mapa)).toEqual({ l1: 'n1', l2: 'n2', l3: 'n3', l4: 'n4', l5: 'n5', l6: 'n3' })
    expect(semPar).toEqual([])
    expect(mapearAreas([area('x', 'Lugar novo', 777)], nuvem).semPar.map((a) => a.nome)).toEqual(['Lugar novo'])
  })

  it('a comparação com o Luan vai para obs', () => {
    expect(obsComLuan(noite('n', '2026-10-12', { obs: 'Chuva', luanPagou: 8300, luanDiferenca: -300, minutosAcerto: 12 }))).toBe(
      r$('Chuva\nAcerto com o Luan (versão local): Luan pagou R$ 83,00 · faltou R$ 3,00 · acerto em 12 min'),
    )
    expect(obsComLuan(noite('n', '2026-10-12', { luanDiferenca: 0 }))).toBe('Acerto com o Luan (versão local): bateu')
    expect(obsComLuan(noite('n', '2026-10-12'))).toBe('')
  })

  it('planeja: troca as áreas, pula data que já existe e fecha a antiga se já tem noite aberta', () => {
    const legado: Dados = {
      noites: [noite('a', '2026-10-12', { luanPagou: 8600 }), noite('b', '2026-10-13'), noite('c', '2026-10-14', { fechadaEm: null })],
      comandas: [comanda('c1', 'a', 'l3'), comanda('c2', 'b', 'l2'), comanda('c3', 'c', 'l1')],
      areas: locais,
      ajustes: { id: 'padrao', caixaPadrao: 8000, diariaPadrao: 3000 },
    }
    const r = planejarEnvioHistorico(legado, { areas: nuvem, noites: [noite('x', '2026-10-13', { fechadaEm: null })] }, 'agora')
    if (!r.ok) throw new Error(r.erro)
    expect(r.valor.noites.map((n) => [n.id, n.fechadaEm, n.luanPagou])).toEqual([
      ['a', '2026-10-13T03:00:00Z', null],
      ['c', 'agora', null],
    ])
    expect(r.valor.noites[0].obs).toBe(r$('Acerto com o Luan (versão local): Luan pagou R$ 86,00'))
    expect(r.valor.comandas.map((c) => [c.id, c.areaId])).toEqual([
      ['c1', 'n3'],
      ['c3', 'n1'],
    ])
    expect(r.valor.puladas).toEqual(['2026-10-13'])
  })

  it('bloqueia se uma área não tem par', () => {
    const legado: Dados = {
      noites: [noite('a', '2026-10-12')],
      comandas: [comanda('c1', 'a', 'z')],
      areas: [area('z', 'Lugar novo', 777)],
      ajustes: { id: 'padrao', caixaPadrao: 8000, diariaPadrao: 3000 },
    }
    expect(planejarEnvioHistorico(legado, { areas: nuvem, noites: [] }, 'agora')).toEqual({
      ok: false,
      erro: 'Sem área igual na nuvem: Lugar novo. Peça para a expedição criar.',
    })
  })
})
