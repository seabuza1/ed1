import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXEMPLOS } from '../../supabase/functions/_shared/exemplos/exemplos.ts'
import { LIMITE_FOTO, montarPedido, montarSistema, tamanhoBase64 } from '../../supabase/functions/_shared/prompt.ts'
import { ESQUEMA_COMPLETA, ESQUEMA_CONFERENCIA, lerSaida, valida } from '../../supabase/functions/_shared/schema.ts'
import { CARDAPIO } from './cardapio'
import { conferirLeitura, type LeituraCompleta, type LeituraConferencia } from './leitura'

describe('prompt da leitura', () => {
  const sistema = montarSistema(CARDAPIO)

  it('leva as regras, o glossário e todo o cardápio, sem preços nem ingredientes (R19)', () => {
    expect(sistema).toContain('Não calcule valores.')
    expect(sistema).toContain('"Arag." = Aragarças')
    for (const s of CARDAPIO.pizzas.sabores) expect(sistema).toContain(s.nome)
    for (const b of CARDAPIO.bebidas) expect(sistema).toContain(b.nome)
    for (const a of CARDAPIO.ambiguidades) expect(sistema).toContain(`"${a.escrito}"`)
    expect(sistema).not.toContain(CARDAPIO.pizzas.sabores[0].ingredientes)
    expect(sistema).not.toMatch(/R\$|\d+,\d\d/)
  })

  it('os exemplos seguem o formato pedido à IA e o do domínio', () => {
    for (const x of EXEMPLOS) {
      expect(valida(ESQUEMA_COMPLETA, x.leitura)).toBe(true)
      expect(valida(ESQUEMA_CONFERENCIA, x.conferencia)).toBe(true)
    }
    // Os tipos do domínio aceitam a saída como está.
    const leitura: LeituraCompleta = EXEMPLOS[0].leitura as LeituraCompleta
    const conferencia: LeituraConferencia = EXEMPLOS[0].conferencia as LeituraConferencia
    const areas = [{ id: 'a', nome: 'Aragarças', taxa: 500, ativa: true }]
    expect(conferirLeitura({ leitura, conferencia, areas, promoDesconto: null }).estado).toBe('verde')
  })

  it('exemplos.ts está em dia com as fotos e leituras (npm run exemplos)', () => {
    for (const x of EXEMPLOS) {
      const pasta = 'supabase/functions/_shared/exemplos'
      expect(x.imagem).toBe(readFileSync(`${pasta}/${x.nome}.jpg`).toString('base64'))
      const json = JSON.parse(readFileSync(`${pasta}/${x.nome}.json`, 'utf8'))
      expect([x.leitura, x.conferencia]).toEqual([json.leitura, json.conferencia])
    }
  })

  it('pedido igual para todo provedor: parte fixa primeiro, a foto da vez no fim', () => {
    const p = montarPedido('conferencia', { cardapio: CARDAPIO, exemplos: EXEMPLOS, imagem: 'FOTO' })
    expect(p.sistema).toBe(sistema)
    expect(p.exemplos).toEqual([{ imagem: EXEMPLOS[0].imagem, resposta: JSON.stringify(EXEMPLOS[0].conferencia) }])
    expect(p.imagem).toBe('FOTO')
    expect(p.esquema).toBe(ESQUEMA_CONFERENCIA)
  })

  it('tamanho do base64 e leitura da saída', () => {
    expect(tamanhoBase64(btoa('abcd'))).toBe(4)
    expect(tamanhoBase64(btoa('abcde'))).toBe(5)
    expect(tamanhoBase64('A'.repeat(Math.ceil((LIMITE_FOTO * 4) / 3) + 8)) > LIMITE_FOTO).toBe(true)
    expect(lerSaida('conferencia', JSON.stringify(EXEMPLOS[0].conferencia))).toEqual(EXEMPLOS[0].conferencia)
    expect(lerSaida('completa', JSON.stringify(EXEMPLOS[0].conferencia))).toBeNull()
    expect(lerSaida('completa', 'não é json')).toBeNull()
    expect(lerSaida('conferencia', EXEMPLOS[0].conferencia)).toEqual(EXEMPLOS[0].conferencia)
  })

  it('esquema: campo a mais, fora do enum, nulo onde não pode e tipo errado não passam', () => {
    const c = EXEMPLOS[0].conferencia as Record<string, unknown>
    expect(valida(ESQUEMA_CONFERENCIA, { ...c, extra: 1 })).toBe(false)
    expect(valida(ESQUEMA_CONFERENCIA, { ...c, promocao: null })).toBe(false)
    expect(valida(ESQUEMA_CONFERENCIA, { ...c, forma_escrita: null })).toBe(true)
    expect(valida(ESQUEMA_CONFERENCIA, { ...c, total_digitos: [1, 1, 3] })).toBe(false)
    const l = EXEMPLOS[0].leitura as { itens: Record<string, unknown>[] }
    expect(valida(ESQUEMA_COMPLETA, { ...l, itens: [{ ...l.itens[0], tamanho: 'GG' }] })).toBe(false)
    expect(valida(ESQUEMA_COMPLETA, { ...l, itens: [{ ...l.itens[0], quantidade: 1.5 }] })).toBe(false)
    expect(valida(ESQUEMA_COMPLETA, [])).toBe(false)
  })
})
