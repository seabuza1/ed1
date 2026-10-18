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

/** O texto da resposta como JSON; sem JSON, a IA não leu. */
export function comoJson(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    throw new ErroIA('formato inesperado')
  }
}
