// Adaptador do Gemini, API Interactions (https://ai.google.dev/api/interactions-api). Conta paga:
// o Google não usa os dados para treinar, e store: false não guarda a interação.
import { montarPedido, type Pedido } from '../prompt.ts'
import { chamar, comoJson, ErroIA, type Adaptador, type OpcoesAdaptador, type Tokens } from './tipos.ts'

export const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/interactions'

const texto = (text: string) => ({ type: 'text', text })
const foto = (data: string) => ({ type: 'image', mime_type: 'image/jpeg', data, resolution: 'high' })

/**
 * Corpo da interação. Exemplos e foto num só turno: a parte fixa (system e exemplos) vem primeiro e
 * sempre igual, para o cache implícito do Gemini (que só começa com um prefixo de uns 4.096 tokens);
 * a foto da vez vem por último.
 */
export function corpoGemini(p: Pedido, modelo: string) {
  return {
    model: modelo,
    system_instruction: p.sistema,
    input: [
      ...p.exemplos.flatMap((x, i) => [
        texto(`Exemplo ${i + 1}. ${p.instrucao}`),
        foto(x.imagem),
        texto(`Resposta certa do exemplo ${i + 1}: ${x.resposta}`),
      ]),
      texto(p.instrucao),
      foto(p.imagem),
    ],
    // Sem temperature: nos modelos Gemini 3 o Google recomenda manter o padrão.
    generation_config: { thinking_level: 'low' },
    response_format: { type: 'text', mime_type: 'application/json', schema: p.esquema },
    store: false,
  }
}

interface Passo {
  type?: string
  content?: { type?: string; text?: string }[]
}

/** O texto da resposta: os passos model_output do fim, sem o raciocínio ("thought"). */
export function textoGemini(passos: Passo[] = []): string {
  const partes: string[] = []
  for (const p of [...passos].reverse()) {
    if (p.type === 'thought') continue
    if (p.type !== 'model_output') break
    partes.unshift(...(p.content ?? []).flatMap((c) => (c.type === 'text' && c.text ? [c.text] : [])))
  }
  return partes.join('')
}

/** O total de entrada do Gemini inclui o cache; o raciocínio é cobrado como saída. */
export function tokensGemini(u: Record<string, number | undefined> = {}): Tokens {
  const cache = u.total_cached_tokens ?? 0
  return {
    entrada: Math.max(0, (u.total_input_tokens ?? 0) - cache),
    cache,
    saida: (u.total_output_tokens ?? 0) + (u.total_thought_tokens ?? 0),
  }
}

export function criarGoogle(o: OpcoesAdaptador): Adaptador {
  const buscar = o.fetch ?? fetch
  return {
    async ler(imagem, modo, modelo) {
      const inicio = Date.now()
      const r = await chamar(
        buscar,
        URL_GEMINI,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': o.chave },
          body: JSON.stringify(corpoGemini(montarPedido(modo, { cardapio: o.cardapio, exemplos: o.exemplos, imagem }), modelo)),
          signal: o.sinal,
        },
        'Gemini',
      )
      const corpo = await r.json().catch(() => null)
      // Chave inválida volta 400 com API_KEY_INVALID: é configuração, como um 401.
      if (r.status === 400 && JSON.stringify(corpo).includes('API_KEY_INVALID')) throw new ErroIA('Gemini chave inválida', 401)
      if (!r.ok) throw new ErroIA(`Gemini ${r.status}`, r.status)
      // 200 também volta "incomplete" (saída cortada) ou "failed" (com o código do erro, se veio).
      if (corpo?.status !== 'completed') {
        const codigo = Number(corpo?.errors?.[0]?.code)
        throw new ErroIA(`Gemini ${corpo?.status ?? 'sem status'}`, Number.isInteger(codigo) ? codigo : undefined)
      }
      return { json: comoJson(textoGemini(corpo.steps)), tokens: tokensGemini(corpo.usage), ms: Date.now() - inicio }
    },
  }
}
