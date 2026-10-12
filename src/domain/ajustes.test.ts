import { expect, it } from 'vitest'
import { alternarArea, editarAjustes, editarArea, novaArea } from './ajustes'
import type { Area } from './tipos'

const areas: Area[] = [
  { id: 'a', nome: 'Aragarças', taxa: 500, ativa: true },
  { id: 'b', nome: 'Barra', taxa: 1200, ativa: true },
]

it('nova área ativa, com nome e taxa', () => {
  expect(novaArea({ nome: ' Jardim ', taxa: 800 }, areas, 'j')).toEqual({
    ok: true,
    valor: { id: 'j', nome: 'Jardim', taxa: 800, ativa: true },
  })
  expect(novaArea({ nome: '', taxa: 800 }, areas, 'j').ok).toBe(false)
  expect(novaArea({ nome: 'barra', taxa: 800 }, areas, 'j')).toEqual({ ok: false, erro: 'Já existe a área barra.' })
  expect(novaArea({ nome: 'Jardim', taxa: 0 }, areas, 'j').ok).toBe(false)
})

it('editar mantém o id e aceita o próprio nome', () => {
  const r = editarArea(areas[1], { nome: 'Barra', taxa: 1300 }, areas)
  expect(r).toEqual({ ok: true, valor: { id: 'b', nome: 'Barra', taxa: 1300, ativa: true } })
  expect(editarArea(areas[1], { nome: 'Aragarças', taxa: 1300 }, areas).ok).toBe(false)
})

it('desativa e ativa, deixando pelo menos uma ativa', () => {
  const r = alternarArea(areas[0], areas)
  expect(r.ok && r.valor.ativa).toBe(false)
  const soUma = [{ ...areas[0], ativa: false }, areas[1]]
  expect(alternarArea(soUma[1], soUma)).toEqual({ ok: false, erro: 'Deixe pelo menos uma área ativa.' })
  const reativa = alternarArea(soUma[0], soUma)
  expect(reativa.ok && reativa.valor.ativa).toBe(true)
})

it('valores padrão de caixa e diária', () => {
  expect(editarAjustes({ caixaPadrao: 10000, diariaPadrao: 3500 })).toEqual({
    ok: true,
    valor: { id: 'padrao', caixaPadrao: 10000, diariaPadrao: 3500 },
  })
  expect(editarAjustes({ caixaPadrao: -1, diariaPadrao: 3000 }).ok).toBe(false)
})
