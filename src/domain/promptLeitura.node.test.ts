import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXEMPLOS } from '../../supabase/functions/_shared/exemplos/exemplos.ts'
import {
  ESQUEMA_COMPLETA,
  ESQUEMA_CONFERENCIA,
  LIMITE_FOTO,
  lerSaida,
  montarPedido,
  montarSistema,
  tamanhoBase64,
} from '../../supabase/functions/_shared/prompt.ts'
import { CARDAPIO } from './cardapio'
import { conferirLeitura, type LeituraCompleta, type LeituraConferencia } from './leitura'

/** Confere um valor contra o subconjunto de JSON Schema que o prompt usa. */
function confere(schema: Record<string, unknown>, v: unknown, caminho = '$'): string[] {
  if (schema.anyOf) {
    const opcoes = schema.anyOf as Record<string, unknown>[]
    return opcoes.some((o) => confere(o, v).length === 0) ? [] : [`${caminho}: nenhuma opção do anyOf`]
  }
  if (schema.enum && !(schema.enum as unknown[]).includes(v)) return [`${caminho}: fora do enum`]
  switch (schema.type) {
    case 'null':
      return v === null ? [] : [`${caminho}: não é null`]
    case 'string':
      return typeof v === 'string' ? [] : [`${caminho}: não é texto`]
    case 'boolean':
      return typeof v === 'boolean' ? [] : [`${caminho}: não é booleano`]
    case 'integer':
      return Number.isInteger(v) ? [] : [`${caminho}: não é inteiro`]
    case 'array':
      return Array.isArray(v)
        ? v.flatMap((x, i) => confere(schema.items as Record<string, unknown>, x, `${caminho}[${i}]`))
        : [`${caminho}: não é lista`]
    case 'object': {
      if (!v || typeof v !== 'object') return [`${caminho}: não é objeto`]
      const props = schema.properties as Record<string, Record<string, unknown>>
      const obj = v as Record<string, unknown>
      const faltam = (schema.required as string[]).filter((k) => !(k in obj)).map((k) => `${caminho}.${k}: falta`)
      const sobram = Object.keys(obj)
        .filter((k) => !(k in props))
        .map((k) => `${caminho}.${k}: sobra`)
      return [...faltam, ...sobram, ...Object.keys(props).flatMap((k) => (k in obj ? confere(props[k], obj[k], `${caminho}.${k}`) : []))]
    }
  }
  return [`${caminho}: tipo ${String(schema.type)} não previsto`]
}

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
      expect(confere(ESQUEMA_COMPLETA, x.leitura)).toEqual([])
      expect(confere(ESQUEMA_CONFERENCIA, x.conferencia)).toEqual([])
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

  it('pedido: sistema e exemplos com cache, a foto da vez no fim, saída estruturada', () => {
    const p = montarPedido('conferencia', { cardapio: CARDAPIO, exemplos: EXEMPLOS, imagem: 'FOTO', modelo: 'm' })
    expect(p.system[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(p.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(p.messages[1].content[0]).toMatchObject({
      text: JSON.stringify(EXEMPLOS[0].conferencia),
      cache_control: { type: 'ephemeral' },
    })
    const ultima = p.messages[2].content[0]
    expect(ultima.type === 'image' && ultima.source.data).toBe('FOTO')
    expect(p.output_config.format.schema).toBe(ESQUEMA_CONFERENCIA)
  })

  it('tamanho do base64 e leitura da saída', () => {
    expect(tamanhoBase64(btoa('abcd'))).toBe(4)
    expect(tamanhoBase64(btoa('abcde'))).toBe(5)
    expect(tamanhoBase64('A'.repeat(Math.ceil((LIMITE_FOTO * 4) / 3) + 8)) > LIMITE_FOTO).toBe(true)
    expect(lerSaida('conferencia', JSON.stringify(EXEMPLOS[0].conferencia))).toEqual(EXEMPLOS[0].conferencia)
    expect(lerSaida('completa', JSON.stringify(EXEMPLOS[0].conferencia))).toBeNull()
    expect(lerSaida('completa', 'não é json')).toBeNull()
  })
})
