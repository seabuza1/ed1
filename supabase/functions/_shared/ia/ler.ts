// Leitura dupla (R25) com o provedor dos secrets: usada pela Edge Function e por
// scripts/comparar-modelos.ts. Trocar de modelo ou provedor é só mudar os secrets.
import { lerSaida } from '../schema.ts'
import { criarAnthropic } from './anthropic.ts'
import { criarCompativel, URL_QWEN } from './compativel.ts'
import { criarGoogle } from './google.ts'
import { ErroIA, type Adaptador, type OpcoesAdaptador, type Tokens } from './tipos.ts'

export type Provedor = 'google' | 'anthropic' | 'qwen' | 'compativel'

interface DefProvedor {
  criar: (o: OpcoesAdaptador) => Adaptador
  /** O secret com a chave. */
  chave: string
  /** Modelo padrão; vazio, IA_MODELO é obrigatório. */
  modelo: string
  prefixo: string
  /** O secret com o endereço da API, quando não é fixo. */
  url?: string
  /** O secret com parâmetros a mais no corpo (JSON). */
  extra?: string
}

export const PROVEDORES: Record<Provedor, DefProvedor> = {
  google: { criar: criarGoogle, chave: 'GEMINI_API_KEY', modelo: 'gemini-3.1-pro-preview', prefixo: 'gemini-' },
  anthropic: { criar: criarAnthropic, chave: 'ANTHROPIC_API_KEY', modelo: 'claude-sonnet-5-5', prefixo: 'claude-' },
  // Sem raciocínio: com foto, o Qwen só devolve JSON assim.
  qwen: { criar: criarCompativel('Qwen', URL_QWEN, { enable_thinking: false }), chave: 'DASHSCOPE_API_KEY', modelo: 'qwen3-vl-plus', prefixo: 'qwen' },
  compativel: { criar: criarCompativel('Compatível'), chave: 'COMPATIVEL_API_KEY', modelo: '', prefixo: '', url: 'COMPATIVEL_URL', extra: 'COMPATIVEL_EXTRA' },
}

export interface Config {
  provedor: Provedor
  chave: string
  modelo: string
  modeloConferencia: string
  /** Só do provedor compatível. */
  url?: string
  extra?: Record<string, unknown>
}

/** Um objeto JSON; outra coisa (ou JSON inválido) é null. */
function objetoJson(texto: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(texto)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

/** Os secrets viram a configuração; sem o provedor ou a chave, diz o que falta (o nome, nunca o valor). */
export function configurar(env: (nome: string) => string | undefined): Config | { falta: string } {
  const provedor = env('IA_PROVEDOR') || 'google'
  if (!Object.hasOwn(PROVEDORES, provedor)) return { falta: `IA_PROVEDOR válido (${Object.keys(PROVEDORES).join(', ')})` }
  const p = PROVEDORES[provedor as Provedor]
  const chave = env(p.chave)
  if (!chave) return { falta: p.chave }
  // A chave não sai sem criptografia.
  const url = p.url && env(p.url)
  if (p.url && !url?.startsWith('https://')) return { falta: `${p.url} (https://...)` }
  // Ex.: {"reasoning":{"max_tokens":1500}}, para o modelo não raciocinar até estourar a saída.
  const textoExtra = p.extra && env(p.extra)
  const extra = textoExtra ? objetoJson(textoExtra) : null
  if (textoExtra && !extra) return { falta: `${p.extra} (um objeto JSON)` }
  const modelo = env('IA_MODELO') || p.modelo
  if (!modelo) return { falta: 'IA_MODELO' }
  const modeloConferencia = env('IA_MODELO_CONFERENCIA') || modelo
  // As duas chamadas vão para o mesmo provedor: um modelo de outro só daria erro em toda foto.
  if (![modelo, modeloConferencia].every((m) => m.startsWith(p.prefixo)))
    return { falta: `IA_MODELO e IA_MODELO_CONFERENCIA do provedor ${provedor} (${p.prefixo}...)` }
  return { provedor: provedor as Provedor, chave, modelo, modeloConferencia, ...(url ? { url } : {}), ...(extra ? { extra } : {}) }
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

const somar = (a: Tokens, b: Tokens): Tokens => ({
  entrada: a.entrada + b.entrada,
  cache: a.cache + b.cache,
  saida: a.saida + b.saida,
  ...(a.escritaCache !== undefined || b.escritaCache !== undefined
    ? { escritaCache: (a.escritaCache ?? 0) + (b.escritaCache ?? 0) }
    : {}),
})

/**
 * As duas leituras em paralelo, validadas pelo esquema antes de voltar. Se uma falha, a outra é
 * cancelada (não segue sendo cobrada para nada).
 */
export async function lerDuasVezes(c: Config, imagem: string, o: Omit<OpcoesAdaptador, 'chave'>): Promise<RespostaIA> {
  const ctrl = new AbortController()
  // Já cancelado (o app desistiu durante a checagem do limite): nenhuma das duas é cobrada.
  if (o.sinal?.aborted) ctrl.abort()
  else o.sinal?.addEventListener('abort', () => ctrl.abort())
  const ia = PROVEDORES[c.provedor].criar({ ...o, sinal: ctrl.signal, chave: c.chave, url: c.url, extra: c.extra })
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
