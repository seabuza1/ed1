import { describe, expect, it } from 'vitest'
import { validarComanda, type DadosComanda } from './comanda'

const base: DadosComanda = {
  codigo: '1234',
  total: 6000,
  taxa: 1000,
  pagamentos: [{ forma: 'dinheiro', valor: 6000 }],
  troco: 0,
}

describe('validarComanda', () => {
  it('aceita uma comanda certa', () => {
    expect(validarComanda(base)).toBeNull()
  })

  it('T9 pagamento misto cuja soma difere do total é bloqueado', () => {
    const msg = validarComanda({
      ...base,
      pagamentos: [
        { forma: 'dinheiro', valor: 2000 },
        { forma: 'cartao', valor: 3000 },
      ],
    })
    expect(msg).toBe('As formas somam R$ 50,00, mas o total é R$ 60,00.')
  })

  it('R2 total menor que a taxa é bloqueado', () => {
    expect(validarComanda({ ...base, total: 900, pagamentos: [{ forma: 'dinheiro', valor: 900 }] })).toBe(
      'O total é menor que a taxa da área (R$ 10,00).',
    )
  })

  it('R5 troco por Pix só com parte em dinheiro', () => {
    expect(validarComanda({ ...base, troco: 300 })).toBeNull()
    expect(validarComanda({ ...base, troco: 300, pagamentos: [{ forma: 'cartao', valor: 6000 }] })).toBe(
      'Troco por Pix só existe com pagamento em dinheiro.',
    )
  })

  it('código com 4 dígitos', () => {
    expect(validarComanda({ ...base, codigo: '123' })).toBe('O código tem 4 dígitos.')
  })
})
