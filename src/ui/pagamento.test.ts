import { expect, it } from 'vitest'
import { estadoDe, lerPagamento, restoPrevisto, type EstadoPagamento } from './pagamento'

const dividido = (linhas: [string, string][], troco = ''): EstadoPagamento => ({
  dividido: true,
  forma: null,
  linhas: linhas.map(([forma, valor]) => ({ forma: forma as never, valor })),
  troco,
})

it('lê uma forma só com troco', () => {
  const r = lerPagamento({ dividido: false, forma: 'dinheiro', linhas: [], troco: '3' }, 4700)
  expect(r).toEqual({ ok: true, valor: { pagamentos: [{ forma: 'dinheiro', valor: 4700 }], troco: 300 } })
})

it('ignora o troco sem dinheiro', () => {
  const r = lerPagamento({ dividido: false, forma: 'cartao', linhas: [], troco: '3' }, 4700)
  expect(r.ok && r.valor.troco).toBe(0)
})

it('linha vazia fica com o resto, e o resto aparece enquanto digita', () => {
  const e = dividido([['pix_antecipado', '20'], ['dinheiro', '']])
  expect(restoPrevisto(e, 5000)).toBe(3000)
  const r = lerPagamento(e, 5000)
  expect(r.ok && r.valor.pagamentos.map((p) => p.valor)).toEqual([2000, 3000])
})

it('valor inválido avisa a forma', () => {
  expect(lerPagamento(dividido([['cartao', 'x'], ['dinheiro', '']]), 5000)).toEqual({
    ok: false,
    erro: 'Valor inválido em Cartão.',
  })
})

it('reabre o editor a partir da comanda', () => {
  expect(estadoDe([{ forma: 'cartao', valor: 9000 }], 0)).toEqual({ dividido: false, forma: 'cartao', linhas: [], troco: '' })
  expect(estadoDe([{ forma: 'pix_antecipado', valor: 2000 }, { forma: 'dinheiro', valor: 3050 }], 300).linhas).toEqual([
    { forma: 'pix_antecipado', valor: '20' },
    { forma: 'dinheiro', valor: '30,50' },
  ])
})
