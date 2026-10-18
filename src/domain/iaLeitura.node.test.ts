import { describe, expect, it } from 'vitest'
import { EXEMPLOS } from '../../supabase/functions/_shared/exemplos/exemplos.ts'
import { corpoAnthropic, criarAnthropic, URL_ANTHROPIC } from '../../supabase/functions/_shared/ia/anthropic.ts'
import { corpoGemini, criarGoogle, textoGemini, tokensGemini, URL_GEMINI } from '../../supabase/functions/_shared/ia/google.ts'
import { configurar, lerDuasVezes } from '../../supabase/functions/_shared/ia/ler.ts'
import { ErroIA } from '../../supabase/functions/_shared/ia/tipos.ts'
import { montarPedido } from '../../supabase/functions/_shared/prompt.ts'
import { ESQUEMA_COMPLETA, ESQUEMA_CONFERENCIA } from '../../supabase/functions/_shared/schema.ts'
import { CARDAPIO } from './cardapio'

const [ex] = EXEMPLOS
const pedido = (tipo: 'completa' | 'conferencia') => montarPedido(tipo, { cardapio: CARDAPIO, exemplos: EXEMPLOS, imagem: 'FOTO' })

/** fetch falso: guarda os pedidos e responde, por modo, com o corpo dado. */
function falso(responder: (corpo: Record<string, unknown>) => { status?: number; json: unknown }) {
  const pedidos: { url: string; headers: Record<string, string>; corpo: Record<string, unknown> }[] = []
  const f = (async (url: string, init: RequestInit) => {
    const corpo = JSON.parse(String(init.body))
    pedidos.push({ url, headers: init.headers as Record<string, string>, corpo })
    const r = responder(corpo)
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 })
  }) as unknown as typeof fetch
  return { f, pedidos }
}

/** O modo do pedido pelo esquema que ele leva. */
const modoGemini = (c: Record<string, unknown>) =>
  JSON.stringify((c.response_format as { schema: unknown }).schema) === JSON.stringify(ESQUEMA_COMPLETA) ? 'completa' : 'conferencia'

const respostaGemini = (json: unknown) => ({
  status: 'completed',
  steps: [
    { type: 'thought', signature: 'x' },
    { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(json) }] },
  ],
  usage: { total_input_tokens: 3000, total_cached_tokens: 2000, total_output_tokens: 300, total_thought_tokens: 100 },
})

describe('Gemini (API Interactions)', () => {
  it('corpo: system, exemplos antes, a foto da vez no fim, JSON pelo esquema, sem guardar', () => {
    const c = corpoGemini(pedido('completa'), 'gemini-3.1-pro-preview')
    expect(c.model).toBe('gemini-3.1-pro-preview')
    expect(typeof c.system_instruction).toBe('string')
    expect(c.input.at(-1)).toEqual({ type: 'image', mime_type: 'image/jpeg', data: 'FOTO', resolution: 'high' })
    expect(c.input.at(-2)).toEqual({ type: 'text', text: 'Leia esta comanda e devolva a leitura completa.' })
    expect(c.input[1]).toMatchObject({ type: 'image', data: ex.imagem })
    expect(c.input[2]).toMatchObject({ type: 'text', text: expect.stringContaining(JSON.stringify(ex.leitura)) })
    expect(c.response_format).toEqual({ type: 'text', mime_type: 'application/json', schema: ESQUEMA_COMPLETA })
    expect(c.generation_config).toEqual({ thinking_level: 'low' })
    expect(c.store).toBe(false)
    expect(JSON.stringify(c)).not.toContain('temperature')
  })

  it('texto e tokens da resposta', () => {
    expect(textoGemini(respostaGemini({ a: 1 }).steps)).toBe('{"a":1}')
    expect(
      textoGemini([
        { type: 'user_input', content: [{ type: 'text', text: 'pergunta' }] },
        { type: 'model_output', content: [{ type: 'text', text: '{"a":' }] },
        { type: 'thought' },
        { type: 'model_output', content: [{ type: 'text', text: '1}' }] },
      ]),
    ).toBe('{"a":1}')
    expect(textoGemini(undefined)).toBe('')
    expect(tokensGemini(respostaGemini({}).usage)).toEqual({ entrada: 1000, cache: 2000, saida: 400 })
    expect(tokensGemini(undefined)).toEqual({ entrada: 0, cache: 0, saida: 0 })
  })

  it('chama com a chave no cabeçalho; erro HTTP e resposta incompleta viram ErroIA', async () => {
    const { f, pedidos } = falso(() => ({ json: respostaGemini(ex.leitura) }))
    const ia = criarGoogle({ chave: 'k', cardapio: CARDAPIO, exemplos: EXEMPLOS, fetch: f })
    const lida = await ia.ler('FOTO', 'completa', 'm')
    expect(lida.json).toEqual(ex.leitura)
    expect(lida.tokens).toEqual({ entrada: 1000, cache: 2000, saida: 400 })
    expect(pedidos[0].url).toBe(URL_GEMINI)
    expect(pedidos[0].headers).toMatchObject({ 'x-goog-api-key': 'k' })

    const ocupado = criarGoogle({ chave: 'k', cardapio: CARDAPIO, exemplos: [], fetch: falso(() => ({ status: 429, json: [{ error: {} }] })).f })
    await expect(ocupado.ler('FOTO', 'completa', 'm')).rejects.toMatchObject({ message: 'Gemini 429', status: 429 })
    const cortada = criarGoogle({ chave: 'k', cardapio: CARDAPIO, exemplos: [], fetch: falso(() => ({ json: { status: 'incomplete', steps: [] } })).f })
    await expect(cortada.ler('FOTO', 'completa', 'm')).rejects.toThrow('Gemini incomplete')
    const semJson = criarGoogle({
      chave: 'k',
      cardapio: CARDAPIO,
      exemplos: [],
      fetch: falso(() => ({ json: { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'oi' }] }] } })).f,
    })
    await expect(semJson.ler('FOTO', 'completa', 'm')).rejects.toBeInstanceOf(ErroIA)
  })
})

describe('Anthropic (Messages)', () => {
  it('corpo: system e último exemplo com cache, foto da vez no fim, saída estruturada', () => {
    const c = corpoAnthropic(pedido('conferencia'), 'claude-haiku-5-5')
    expect(c.system[0]).toMatchObject({ cache_control: { type: 'ephemeral' } })
    expect(c.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(c.messages[1].content[0]).toMatchObject({ text: JSON.stringify(ex.conferencia), cache_control: { type: 'ephemeral' } })
    expect(c.messages[2].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'FOTO' } })
    expect(c.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_CONFERENCIA } })
    expect(JSON.stringify(c)).not.toContain('tool_choice')
  })

  it('lê o texto e os tokens; recusa e resposta cortada viram ErroIA', async () => {
    const msg = (stop_reason: string) => ({
      stop_reason,
      content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(ex.conferencia) }],
      usage: { input_tokens: 50, cache_creation_input_tokens: 10, cache_read_input_tokens: 2000, output_tokens: 80 },
    })
    const { f, pedidos } = falso(() => ({ json: msg('end_turn') }))
    const lida = await criarAnthropic({ chave: 'k', cardapio: CARDAPIO, exemplos: [], fetch: f }).ler('FOTO', 'conferencia', 'm')
    expect(lida.json).toEqual(ex.conferencia)
    expect(lida.tokens).toEqual({ entrada: 60, cache: 2000, saida: 80 })
    expect(pedidos[0].url).toBe(URL_ANTHROPIC)
    expect(pedidos[0].headers).toMatchObject({ 'x-api-key': 'k', 'anthropic-version': '2023-06-01' })
    for (const [stop, erro] of [
      ['refusal', 'recusa'],
      ['max_tokens', 'resposta cortada'],
    ])
      await expect(
        criarAnthropic({ chave: 'k', cardapio: CARDAPIO, exemplos: [], fetch: falso(() => ({ json: msg(stop) })).f }).ler('FOTO', 'completa', 'm'),
      ).rejects.toThrow(erro)
  })
})

describe('provedor pelos secrets e leitura dupla (R25)', () => {
  const env = (vars: Record<string, string>) => (nome: string) => vars[nome]

  it('Gemini 3.1 Pro por padrão; a conferência pode usar outro modelo; sem chave diz qual falta', () => {
    expect(configurar(env({ GEMINI_API_KEY: 'g' }))).toEqual({
      provedor: 'google',
      chave: 'g',
      modelo: 'gemini-3.1-pro-preview',
      modeloConferencia: 'gemini-3.1-pro-preview',
    })
    expect(configurar(env({ IA_PROVEDOR: 'anthropic', IA_MODELO: 'claude-haiku-5-5', IA_MODELO_CONFERENCIA: 'claude-sonnet-5-5', ANTHROPIC_API_KEY: 'a' }))).toEqual({
      provedor: 'anthropic',
      chave: 'a',
      modelo: 'claude-haiku-5-5',
      modeloConferencia: 'claude-sonnet-5-5',
    })
    expect(configurar(env({}))).toEqual({ falta: 'GEMINI_API_KEY' })
    expect(configurar(env({ IA_PROVEDOR: 'anthropic', GEMINI_API_KEY: 'g' }))).toEqual({ falta: 'ANTHROPIC_API_KEY' })
    expect(configurar(env({ IA_PROVEDOR: 'constructor', GEMINI_API_KEY: 'g' }))).toHaveProperty('falta')
  })

  it('duas chamadas em paralelo, validadas, com os tokens somados', async () => {
    const { f, pedidos } = falso((c) => ({ json: respostaGemini(modoGemini(c) === 'completa' ? ex.leitura : ex.conferencia) }))
    const config = { provedor: 'google' as const, chave: 'g', modelo: 'pro', modeloConferencia: 'flash' }
    const r = await lerDuasVezes(config, 'FOTO', { cardapio: CARDAPIO, exemplos: EXEMPLOS, fetch: f })
    expect(r).toMatchObject({ leitura: ex.leitura, conferencia: ex.conferencia, provedor: 'google', modelo: 'pro + flash' })
    expect(r.tokens).toEqual({ entrada: 2000, cache: 4000, saida: 800 })
    expect(pedidos.map((p) => p.corpo.model).sort()).toEqual(['flash', 'pro'])
  })

  it('saída fora do esquema não volta para o app', async () => {
    const { f } = falso((c) => ({ json: respostaGemini(modoGemini(c) === 'completa' ? { telefone_final: '3557' } : ex.conferencia) }))
    const config = { provedor: 'google' as const, chave: 'g', modelo: 'm', modeloConferencia: 'm' }
    await expect(lerDuasVezes(config, 'FOTO', { cardapio: CARDAPIO, exemplos: [], fetch: f })).rejects.toThrow('fora do formato')
  })
})
