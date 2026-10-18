// Adaptador da Anthropic, Messages API. Saída estruturada (output_config.format) em vez de tool use
// forçado: o Sonnet 5.5 e o Opus 5.5 recusam tool_choice forçado, e o formato vale para todos.
import { montarPedido, type Pedido } from '../prompt.ts'
import { comoJson, ErroIA, type Adaptador, type OpcoesAdaptador } from './tipos.ts'

export const URL_ANTHROPIC = 'https://api.anthropic.com/v1/messages'

const foto = (data: string) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })
const CACHE = { cache_control: { type: 'ephemeral' } }

/** Ordem fixa para o cache: system (com cache), os exemplos (o último com cache) e a foto da vez. */
export function corpoAnthropic(p: Pedido, modelo: string) {
  const exemplos = p.exemplos.flatMap((x, i) => [
    { role: 'user', content: [foto(x.imagem), { type: 'text', text: p.instrucao }] },
    { role: 'assistant', content: [{ type: 'text', text: x.resposta, ...(i === p.exemplos.length - 1 ? CACHE : {}) }] },
  ])
  return {
    model: modelo,
    max_tokens: 8000,
    system: [{ type: 'text', text: p.sistema, ...CACHE }],
    messages: [...exemplos, { role: 'user', content: [foto(p.imagem), { type: 'text', text: p.instrucao }] }],
    // Esforço baixo: transcrever pede pouca deliberação.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: p.esquema } },
  }
}

export function criarAnthropic(o: OpcoesAdaptador): Adaptador {
  const buscar = o.fetch ?? fetch
  return {
    async ler(imagem, modo, modelo) {
      const inicio = Date.now()
      const r = await buscar(URL_ANTHROPIC, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': o.chave, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(corpoAnthropic(montarPedido(modo, { cardapio: o.cardapio, exemplos: o.exemplos, imagem }), modelo)),
        signal: o.sinal,
      })
      const msg = await r.json().catch(() => null)
      if (!r.ok) throw new ErroIA(`Anthropic ${r.status}`, r.status)
      if (msg?.stop_reason === 'refusal') throw new ErroIA('recusa')
      if (msg?.stop_reason === 'max_tokens') throw new ErroIA('resposta cortada')
      const blocos: { type?: string; text?: string }[] = msg?.content ?? []
      const u = msg?.usage ?? {}
      return {
        json: comoJson(blocos.flatMap((b) => (b.type === 'text' && b.text ? [b.text] : [])).join('')),
        // A escrita no cache entra como entrada (custa um pouco mais, na primeira chamada).
        tokens: {
          entrada: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
          cache: u.cache_read_input_tokens ?? 0,
          saida: u.output_tokens ?? 0,
        },
        ms: Date.now() - inicio,
      }
    },
  }
}
