import { expect, it } from 'vitest'
import { formatarReais } from './dinheiro'

it('formata centavos como R$ 1.234,56', () => {
  expect(formatarReais(123456)).toBe('R$ 1.234,56')
  expect(formatarReais(0)).toBe('R$ 0,00')
  expect(formatarReais(5)).toBe('R$ 0,05')
  expect(formatarReais(123456789)).toBe('R$ 1.234.567,89')
  expect(formatarReais(-300)).toBe('-R$ 3,00')
})
