// Leitura dupla (R25) com o provedor dos secrets: usada pela Edge Function e por
// scripts/comparar-modelos.ts. Trocar de modelo ou provedor é só mudar os secrets.
import { lerSaida } from '../schema.ts'
import { criarAnthropic } from './anthropic.ts'
import { criarGoogle } from './google.ts'
import { ErroIA, type OpcoesAdaptador, type Tokens } from './tipos.ts'

export const PROVEDORES = {
  google: { criar: criarGoogle, chave: 'GEMINI_API_KEY', modelo: 'gemini-3.1-pro-preview', prefixo: 'gemini-' },
  anthropic: { criar: criarAnthropic, chave: 'ANTHROPIC_API_KEY', modelo: 'claude-sonnet-5-5', prefixo: 'claude-' },
}
export type Provedor = keyof typeof PROVEDORES

export interface Config {
  provedor: Provedor
  chave: string
  modelo: string
  modeloConferencia: string
}

/** Os secrets viram a configuração; sem o provedor ou a chave, diz o que falta (o nome, nunca o valor). */
export function configurar(env: (nome: string) => string | undefined): Config | { falta: string } {
  const provedor = env('IA_PROVEDOR') || 'google'
  if (!Object.hasOwn(PROVEDORES, provedor)) return { falta: `IA_PROVEDOR válido (google ou anthropic)` }
  const p = PROVEDORES[provedor as Provedor]
  const chave = env(p.chave)
  if (!chave) return { falta: p.chave }
  const modelo = env('IA_MODELO') || p.modelo
  const modeloConferencia = env('IA_MODELO_CONFERENCIA') || modelo
  // As duas chamadas vão para o mesmo provedor: um modelo de outro só daria erro em toda foto.
  if (![modelo, modeloConferencia].every((m) => m.startsWith(p.prefixo)))
    return { falta: `IA_MODELO e IA_MODELO_CONFERENCIA do provedor ${provedor} (${p.prefixo}...)` }
  return { provedor: provedor as Provedor, chave, modelo, modeloConferencia }
}

export interface RespostaIA {
  leitura: Record<string, unknown>
  conferencia: Record<string, unknown>
  provedor: Provedor
  /** "modelo + modelo da conferência" quando são diferentes. */
  modelo: string
  ms: number
  /** Somando as duas chamadas. */
  tokens: Tokens
}

const somar = (a: Tokens, b: Tokens): Tokens => ({ entrada: a.entrada + b.entrada, cache: a.cache + b.cache, saida: a.saida + b.saida })

/**
 * As duas leituras em paralelo, validadas pelo esquema antes de voltar. Se uma falha, a outra é
 * cancelada (não segue sendo cobrada para nada).
 */
export async function lerDuasVezes(c: Config, imagem: string, o: Omit<OpcoesAdaptador, 'chave'>): Promise<RespostaIA> {
  const ctrl = new AbortController()
  o.sinal?.addEventListener('abort', () => ctrl.abort())
  const ia = PROVEDORES[c.provedor].criar({ ...o, sinal: ctrl.signal, chave: c.chave })
  const ler = (modo: 'completa' | 'conferencia', modelo: string) =>
    ia.ler(imagem, modo, modelo).catch((e) => {
      ctrl.abort()
      throw e
    })
  const inicio = Date.now()
  const [a, b] = await Promise.all([ler('completa', c.modelo), ler('conferencia', c.modeloConferencia)])
  const leitura = lerSaida('completa', a.json)
  const conferencia = lerSaida('conferencia', b.json)
  if (!leitura || !conferencia) throw new ErroIA('fora do formato')
  return {
    leitura,
    conferencia,
    provedor: c.provedor,
    modelo: c.modeloConferencia === c.modelo ? c.modelo : `${c.modelo} + ${c.modeloConferencia}`,
    ms: Date.now() - inicio,
    tokens: somar(a.tokens, b.tokens),
  }
}
