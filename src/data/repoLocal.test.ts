import 'fake-indexeddb/auto'
import { expect, it, vi } from 'vitest'
import { abrirNoite } from '../domain/noite'
import type { Comanda } from '../domain/tipos'
import { novoId } from './id'
import { criarRepoLocal } from './repoLocal'

let n = 0
const novoRepo = () => criarRepoLocal(`teste-${++n}`)

it('primeira abertura cria as áreas e os valores padrão', async () => {
  const repo = novoRepo()
  const areas = await repo.listarAreas()
  expect(areas.map((a) => [a.nome, a.taxa, a.ativa])).toEqual([
    ['Aragarças', 500, true],
    ['Pontal', 1000, true],
    ['Barra', 1200, true],
    ['Parque de Exposições', 1500, true],
  ])
  expect(await repo.obterAjustes()).toMatchObject({ caixaPadrao: 8000, diariaPadrao: 3000 })
})

it('grava e lê noites e comandas, e avisa a cada gravação', async () => {
  const repo = novoRepo()
  const ouvinte = vi.fn()
  const parar = repo.aoMudar(ouvinte)

  const r = abrirNoite({ data: '2026-10-12', caixaInicial: 8000, diaria: 3000 }, [], novoId())
  if (!r.ok) throw new Error(r.erro)
  await repo.salvarNoite(r.valor)
  expect(await repo.listarNoites()).toEqual([r.valor])
  await repo.atualizarNoite(r.valor.id, { dinheiroContado: 24000 })
  await repo.atualizarNoite(r.valor.id, { luanPagou: 8300 })
  expect(await repo.listarNoites()).toEqual([{ ...r.valor, dinheiroContado: 24000, luanPagou: 8300 }])

  const comanda = (codigo: string, criadaEm: string, noiteId = r.valor.id): Comanda => ({
    id: novoId(), noiteId, codigo, total: 5000, areaId: 'a', taxa: 1000, status: 'em_rota',
    troco: 0, pagamentos: [{ forma: 'dinheiro', valor: 5000 }], criadaEm, atualizadaEm: criadaEm,
  })
  const b = comanda('2222', '2026-10-12T21:00:00Z')
  const a = comanda('1111', '2026-10-12T20:00:00Z')
  await repo.salvarComanda(b)
  await repo.salvarComanda(a)
  await repo.salvarComanda(comanda('9999', '2026-10-12T20:30:00Z', 'outra'))
  expect((await repo.listarComandas(r.valor.id)).map((c) => c.codigo)).toEqual(['1111', '2222'])

  await repo.excluirComanda(a.id)
  expect((await repo.listarComandas(r.valor.id)).map((c) => c.codigo)).toEqual(['2222'])

  expect(ouvinte).toHaveBeenCalledTimes(7)
  parar()
  await repo.salvarAjustes({ id: 'padrao', caixaPadrao: 10000, diariaPadrao: 3000 })
  expect(ouvinte).toHaveBeenCalledTimes(7)
  expect((await repo.obterAjustes()).caixaPadrao).toBe(10000)
})

it('id é um UUID', () => {
  expect(novoId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

it('backup: lê tudo e substitui tudo', async () => {
  const origem = novoRepo()
  const r = abrirNoite({ data: '2026-10-12', caixaInicial: 8000, diaria: 3000 }, [], novoId())
  if (!r.ok) throw new Error(r.erro)
  await origem.salvarNoite(r.valor)
  const dados = await origem.lerTudo()
  expect(dados.noites).toHaveLength(1)
  expect(dados.areas).toHaveLength(4)

  const destino = novoRepo()
  await destino.salvarNoite({ ...r.valor, id: 'outra', data: '2026-01-01' })
  await destino.substituirTudo(dados)
  expect(await destino.listarNoites()).toEqual(dados.noites)
  expect((await destino.listarAreas()).map((a) => a.id).sort()).toEqual(dados.areas.map((a) => a.id).sort())
  expect(await destino.listarTodasComandas()).toEqual([])
})
