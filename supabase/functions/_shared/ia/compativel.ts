// Adaptador para APIs no formato do OpenAI (Chat Completions): o Qwen da Alibaba (Model Studio,
// Singapura) e qualquer servidor compatível (vLLM, LiteLLM...) pelo endereço dos secrets.
// JSON pelo modo json_object, com o esquema no prompt: com foto, o Qwen não aceita json_schema. A
// validação é a mesma dos outros provedores (lerSaida).
import { montarPedido, type Pedido } from '../prompt.ts'
import { chamar, comoJson, ErroIA, status400, type Adaptador, type OpcoesAdaptador, type Tokens } from './tipos.ts'

export const URL_QWEN = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'

const texto = (text: string) => ({ type: 'text', text })
const foto = (data: string) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${data}` } })

/**
 * Exemplos como conversa (foto e instrução, depois a resposta certa) e a foto da vez por último,
 * para o cache do prefixo. `extra` vai no corpo como veio (o Qwen: sem raciocínio, que com foto não
 * devolve JSON).
 */
export function corpoCompativel(p: Pedido, modelo: string, extra: Record<string, unknown> = {}) {
  return {
    model: modelo,
    messages: [
      { role: 'system', content: `${p.sistema}\n\n## Resposta\nSó o JSON, neste esquema:\n${JSON.stringify(p.esquema)}` },
      ...p.exemplos.flatMap((x) => [
        { role: 'user', content: [foto(x.imagem), texto(p.instrucao)] },
        { role: 'assistant', content: x.resposta },
      ]),
      { role: 'user', content: [foto(p.imagem), texto(p.instrucao)] },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 8000,
    ...extra,
  }
}

/** prompt_tokens inclui o cache; completion_tokens inclui o raciocínio. */
export function tokensCompativel(u: Record<string, unknown> = {}): Tokens {
  const n = (v: unknown) => (typeof v === 'number' ? v : 0)
  const cache = n((u.prompt_tokens_details as Record<string, unknown> | undefined)?.cached_tokens)
  return { entrada: Math.max(0, n(u.prompt_tokens) - cache), cache, saida: n(u.completion_tokens) }
}

/** O texto da mensagem (alguns servidores mandam em partes), sem a cerca ```json de alguns modelos. */
export function textoCompativel(c: unknown): string {
  const t = typeof c === 'string' ? c : Array.isArray(c) ? c.flatMap((p) => (typeof p?.text === 'string' ? [p.text] : [])).join('') : ''
  return t.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1')
}

/**
 * 400 de servidor compatível: chave inválida (401), conta sem saldo (402), entrada barrada pela
 * moderação (422, desta foto); o resto pelo texto, como nos outros provedores.
 */
export function statusCompativel400(mensagem: string): number {
  if (/invalid.?api.?key|incorrect api key/i.test(mensagem)) return 401
  if (/arrearage|insufficient.?(balance|quota)|billing/i.test(mensagem)) return 402
  if (/datainspection|inappropriate/i.test(mensagem)) return 422
  return status400(mensagem)
}

/** `url`: o endereço fixo do provedor; sem ele, o dos secrets (o.url). */
export function criarCompativel(nome: string, url?: string, extra: Record<string, unknown> = {}) {
  return (o: OpcoesAdaptador): Adaptador => {
    const buscar = o.fetch ?? fetch
    const endereco = `${(url ?? o.url ?? '').replace(/\/+$/, '')}/chat/completions`
    return {
      async ler(imagem, modo, modelo) {
        const inicio = Date.now()
        const r = await chamar(
          buscar,
          endereco,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${o.chave}` },
            body: JSON.stringify(corpoCompativel(montarPedido(modo, { cardapio: o.cardapio, exemplos: o.exemplos, imagem }), modelo, extra)),
            signal: o.sinal,
          },
          nome,
        )
        const corpo = await r.json().catch(() => null)
        const erro = JSON.stringify(corpo?.error ?? corpo ?? '')
        if (r.status === 400) throw new ErroIA(`${nome} 400`, statusCompativel400(erro))
        if (!r.ok) throw new ErroIA(`${nome} ${r.status}`, r.status)
        const escolha = corpo?.choices?.[0]
        if (escolha?.finish_reason === 'length') throw new ErroIA('resposta cortada')
        if (escolha?.finish_reason === 'content_filter' || escolha?.message?.refusal) throw new ErroIA('recusa')
        return { json: comoJson(textoCompativel(escolha?.message?.content)), tokens: tokensCompativel(corpo?.usage), ms: Date.now() - inicio }
      },
    }
  }
}
