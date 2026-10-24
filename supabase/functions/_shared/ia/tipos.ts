// Interface comum dos provedores de IA (docs/SPEC-leitura.md, "Provedor configurável"). Só fetch,
// sem SDK: roda na Edge Function (Deno) e em scripts/comparar-modelos.ts (Node).
import type { CardapioPrompt, Exemplo } from '../prompt.ts'
import type { TipoLeitura } from '../schema.ts'

export interface Tokens {
  /** Entrada cobrada inteira (sem o que veio do cache). */
  entrada: number
  /** Entrada lida do cache. */
  cache: number
  /** Saída, com o raciocínio do modelo. */
  saida: number
  /** Parte da entrada gravada no cache (a Anthropic cobra 1,25 ×); só para o custo do comparador. */
  escritaCache?: number
}

/** Uma chamada: o JSON como veio (a validação é depois), os tokens e o tempo. */
export interface Lida {
  json: unknown
  tokens: Tokens
  ms: number
}

export interface Adaptador {
  ler(imagemBase64: string, modo: TipoLeitura, modelo: string): Promise<Lida>
}

export interface OpcoesAdaptador {
  chave: string
  cardapio: CardapioPrompt
  exemplos: Exemplo[]
  /** Endereço da API, quando vem dos secrets (provedor compatível). */
  url?: string
  /** Parâmetros a mais no corpo, dos secrets (provedor compatível): o limite de raciocínio, por exemplo. */
  extra?: Record<string, unknown>
  /** Cancela a chamada (tempo limite). */
  sinal?: AbortSignal
  /** Para os testes. */
  fetch?: typeof fetch
}

/** A IA não leu. A mensagem não leva nada da chave, da foto ou da resposta (vai para o log). */
export class ErroIA extends Error {
  /** Status HTTP, quando veio da API. */
  status?: number
  constructor(mensagem: string, status?: number) {
    super(mensagem)
    this.status = status
  }
}

/**
 * fetch ao provedor. Falha de rede (sem ter sido cancelada) vira 503: fora do ar, a foto é lida
 * depois.
 */
export async function chamar(buscar: typeof fetch, url: string, init: RequestInit, nome: string): Promise<Response> {
  try {
    return await buscar(url, init)
  } catch (e) {
    if (init.signal?.aborted) throw e
    throw new ErroIA(`${nome} rede`, 503)
  }
}

/**
 * 400 do provedor: se o problema é a foto, a IA não leu esta (422, conta como tentativa); senão é o
 * pedido (modelo que não aceita um parâmetro, schema): configuração, como um 404.
 */
export const status400 = (mensagem: string) => (/image|imagem/i.test(mensagem) ? 422 : 400)

/** O texto da resposta como JSON; sem JSON, a IA não leu. */
export function comoJson(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    throw new ErroIA('formato inesperado')
  }
}
