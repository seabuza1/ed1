import { describe, expect, it } from 'vitest'
import exemplo3557 from '../../supabase/functions/_shared/exemplos/3557.json'
import { acertou, contaVazia, custoUsd, juntarFormas, somarLida } from './comparacao'
import { conferirLeitura, type LeituraCompleta, type LeituraConferencia } from './leitura'
import type { Area } from './tipos'

const AREAS: Area[] = [
  { id: 'a', nome: 'Aragarças', taxa: 500, ativa: true },
  { id: 'b', nome: 'Barra do Garças', taxa: 1200, ativa: true },
]
const lida = exemplo3557 as unknown as { leitura: LeituraCompleta; conferencia: LeituraConferencia }

describe('comparar modelos', () => {
  it('acerto: código, total, área e forma iguais ao gabarito', () => {
    const r = conferirLeitura({ ...lida, areas: AREAS, promoDesconto: null })
    const g = { codigo: '3557', total: '113,00', area: 'aragarcas', forma: 'cartao' }
    expect(acertou(r, AREAS, g)).toBe(true)
    expect(acertou(r, AREAS, { ...g, total: '118,00' })).toBe(false)
    expect(acertou(r, AREAS, { ...g, forma: 'dinheiro' })).toBe(false)
  })

  it('formas: os dois Pix contam como pix, sem repetir e em ordem', () => {
    expect(juntarFormas(['pix_maquina', 'dinheiro', 'pix_antecipado'])).toBe('dinheiro+pix')
  })

  it('custo: o cache sai mais barato e a escrita no cache da Anthropic, mais cara', () => {
    const gemini = { entrada: 2, cache: 0.2, saida: 12 }
    expect(custoUsd({ entrada: 1_000_000, cache: 1_000_000, saida: 100_000 }, gemini)).toBeCloseTo(2 + 0.2 + 1.2)
    const haiku = { entrada: 1, cache: 0.1, saida: 5, escritaCache: 1.25 }
    expect(custoUsd({ entrada: 1_000_000, cache: 0, saida: 0, escritaCache: 400_000 }, haiku)).toBeCloseTo(0.6 + 0.5)
  })

  it('conta por modelo: verdes certas e erradas, amarelas, vermelhas, tempo e custo', () => {
    let c = contaVazia()
    c = somarLida(c, 'verde', true, 1000, 0.01)
    c = somarLida(c, 'verde', false, 2000, 0.01)
    c = somarLida(c, 'vermelho', false, 3000, 0.01)
    expect(c).toMatchObject({ verdesCertas: 1, verdesErradas: 1, vermelhas: 1, lidas: 3, ms: 6000 })
    expect(c.custo).toBeCloseTo(0.03)
  })
})
