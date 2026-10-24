import { describe, expect, it } from 'vitest'
import { camposQueValem, mesmoValor } from './linhas'

describe('conflito na mesma coluna', () => {
  it('mesmo valor: jsonb em outra ordem e horário em outro formato', () => {
    expect(mesmoValor([{ forma: 'pix_antecipado', valor: 2000 }], [{ valor: 2000, forma: 'pix_antecipado' }])).toBe(true)
    expect(mesmoValor('2026-10-16T21:30:00.000Z', '2026-10-16T21:30:00+00:00')).toBe(true)
    expect(mesmoValor(null, undefined)).toBe(true)
    expect(mesmoValor([{ forma: 'dinheiro', valor: 1 }], [{ forma: 'dinheiro', valor: 2 }])).toBe(false)
    expect(mesmoValor('2026-10-16', '2026-10-17')).toBe(false)
  })

  it('a coluna mudada na nuvem depois da alteração daqui fica com a da nuvem; o resto sobe', () => {
    const campos = { dinheiro_contado: 24000, obs: 'x' }
    const base = { dinheiro_contado: null, obs: '' }
    const nuvem = { dinheiro_contado: 24300, obs: '', atualizado_em: '2026-10-16T21:20:00+00:00' }
    expect(camposQueValem(campos, base, nuvem, Date.parse('2026-10-16T21:10:00Z'))).toEqual({ obs: 'x' })
    expect(camposQueValem(campos, base, nuvem, Date.parse('2026-10-16T21:30:00Z'))).toEqual(campos)
    // A nuvem não mexeu na coluna: sobe mesmo com a linha mais nova lá.
    expect(camposQueValem(campos, base, { ...nuvem, dinheiro_contado: null }, 0)).toEqual(campos)
  })
})
