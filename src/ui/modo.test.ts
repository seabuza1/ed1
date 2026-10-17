import { expect, it } from 'vitest'
import { escolherModo } from './modo'

const base = { caminho: '/', papel: 'admin' as const, telaLarga: false, salvo: null }

it('motoboy fica no app; expedição, no painel', () => {
  expect(escolherModo({ ...base, papel: 'motoboy', caminho: '/painel' })).toBe('app')
  expect(escolherModo({ ...base, papel: 'expedicao' })).toBe('painel')
})

it('admin: /painel abre o painel; em "/" vale onde estava, senão o computador abre o painel', () => {
  expect(escolherModo({ ...base, caminho: '/painel', salvo: 'app' })).toBe('painel')
  expect(escolherModo({ ...base, salvo: 'app', telaLarga: true })).toBe('app')
  expect(escolherModo({ ...base, salvo: 'painel' })).toBe('painel')
  expect(escolherModo({ ...base, telaLarga: true })).toBe('painel')
  expect(escolherModo(base)).toBe('app')
})
