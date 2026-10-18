import { describe, expect, it } from 'vitest'
import { resumirNoites } from './acerto'
import { lerBackup, montarBackup, nomeArquivoBackup, resumoBackup, type Dados } from './backup'
import { AJUSTES_PADRAO } from './padroes'
import type { Comanda, Noite } from './tipos'
import { r$ } from '../teste/r$'

const noite = (id: string, data: string, extra: Partial<Noite> = {}): Noite => ({
  id, data, caixaInicial: 8000, diaria: 3000, dinheiroContado: null, fechadaEm: '2026-10-12T23:50:00Z',
  luanPagou: null, luanDiferenca: null, minutosAcerto: null, obs: '', ...extra,
})
const comanda = (id: string, noiteId: string, extra: Partial<Comanda> = {}): Comanda => ({
  id, noiteId, codigo: '1234', total: 5000, areaId: 'a1', taxa: 1000, status: 'entregue', troco: 0,
  pagamentos: [{ forma: 'dinheiro', valor: 5000 }], criadaEm: 'x', atualizadaEm: 'x', finalizadaEm: 'x', ...extra,
})
const dados = (): Dados => ({
  noites: [noite('n1', '2026-10-11'), noite('n2', '2026-10-12', { fechadaEm: null })],
  comandas: [comanda('c1', 'n1'), comanda('c2', 'n2')],
  areas: [{ id: 'a1', nome: 'Pontal', taxa: 1000, ativa: true }],
  ajustes: AJUSTES_PADRAO,
})

describe('backup', () => {
  it('exporta e importa de volta igual', () => {
    const b = montarBackup(dados(), '2026-10-12T23:59:00Z')
    expect(lerBackup(JSON.stringify(b))).toEqual({ ok: true, valor: b })
    expect(resumoBackup(b)).toBe('2 noites, 2 comandas, 1 área')
  })

  it('aceita backup antigo, sem a hora da entrega', () => {
    const b = montarBackup(dados(), 'x')
    const antigo = JSON.parse(JSON.stringify(b))
    for (const c of antigo.comandas) delete c.finalizadaEm
    const r = lerBackup(JSON.stringify(antigo))
    expect(r.ok && r.valor.comandas.map((c) => c.finalizadaEm)).toEqual(['x', 'x']) // = atualizadaEm
  })

  it('nome do arquivo com data e hora', () => {
    expect(nomeArquivoBackup(new Date(2026, 9, 12, 23, 5))).toBe('acerto-backup-2026-10-12-2305.json')
  })

  it('recusa arquivo estranho ou quebrado', () => {
    const ok = montarBackup(dados(), 'x')
    const com = (mudar: (b: Record<string, unknown>) => void) => {
      const b = JSON.parse(JSON.stringify(ok))
      mudar(b)
      return lerBackup(JSON.stringify(b))
    }
    expect(lerBackup('{')).toEqual({ ok: false, erro: 'O arquivo não é um JSON válido.' })
    expect(lerBackup('{"app":"outro"}').ok).toBe(false)
    expect(com((b) => (b.versao = 2)).ok).toBe(false)
    expect(com((b) => ((b.comandas as Comanda[])[0].total = 50.5)).ok).toBe(false)
    expect(com((b) => ((b.comandas as Comanda[])[0].pagamentos[0].forma = 'cheque' as never)).ok).toBe(false)
    expect(com((b) => ((b.comandas as Comanda[])[0].noiteId = 'sumiu'))).toEqual({ ok: false, erro: 'Backup com comanda sem noite.' })
    expect(com((b) => ((b.noites as Noite[])[0].fechadaEm = null)).ok).toBe(false) // duas abertas
    expect(com((b) => delete b.ajustes).ok).toBe(false)
    expect(com((b) => ((b.comandas as Comanda[])[0].areaOrigem = 'chute' as never)).ok).toBe(false)
    expect(com((b) => ((b.noites as Noite[])[0].promoDesconto = -1)).ok).toBe(false)
  })

  it('leva a foto, a origem da área e a promoção da noite', () => {
    const d = dados()
    d.noites[0].promoDesconto = 1000
    d.comandas[0] = comanda('c1', 'n1', { fotoPath: 'n1/c1.jpg', areaOrigem: 'escrito' })
    const b = montarBackup(d, 'x')
    expect(lerBackup(JSON.stringify(b))).toEqual({ ok: true, valor: b })
  })
})

it('resumo das noites para o histórico', () => {
  const d = dados()
  d.noites[0].luanPagou = 4000 // receber: 30 + 10 = 40 → bateu
  d.noites[1].luanPagou = 3800 // diferença de 2
  const r = resumirNoites(d.noites, d.comandas)
  expect(r.map((x) => [x.noite.data, x.qtdComandas, x.devolver, x.receber, x.pago, x.selo, x.bateu])).toEqual([
    ['2026-10-12', 1, 13000, 4000, 3800, r$('Diferença de R$ 2,00'), false],
    ['2026-10-11', 1, 13000, 4000, 4000, 'Bateu com o Luan', true],
  ])
  expect(resumirNoites([noite('n3', '2026-10-13')], [])[0]).toMatchObject({ qtdComandas: 0, selo: null, bateu: null })
})
