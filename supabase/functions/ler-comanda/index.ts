// Edge Function ler-comanda (docs/SPEC-leitura.md): recebe a foto da comanda e devolve duas
// leituras da IA, a completa e a de conferência (R25). Só transcreve; a conta é do app (R19).
// POST { imagem } (JPEG em base64) → { leitura, conferencia, modelo, ms } ou { erro }.
// Secrets: ANTHROPIC_API_KEY (nunca vai para o front nem para os logs) e ANTHROPIC_MODEL.
import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0'
import cardapio from '../_shared/cardapio-mel.json' with { type: 'json' }
import { EXEMPLOS } from '../_shared/exemplos/exemplos.ts'
import { LIMITE_FOTO, lerSaida, montarPedido, tamanhoBase64, type TipoLeitura } from '../_shared/prompt.ts'

const MODELO_PADRAO = 'claude-sonnet-5-5'
const TEMPO_LIMITE = 20_000
// Modelos que aceitam o fallback do servidor na forma "default".
const COM_FALLBACK = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1'])

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** A plataforma já confere a assinatura do JWT (verify_jwt); aqui só exige que seja de um usuário logado. */
function usuarioLogado(req: Request): boolean {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(parte.padEnd(Math.ceil(parte.length / 4) * 4, '=')))
    return claims.role === 'authenticated' && typeof claims.sub === 'string'
  } catch {
    return false
  }
}

class ErroLeitura extends Error {}

async function ler(cliente: Anthropic, modelo: string, tipo: TipoLeitura, imagem: string) {
  const pedido = montarPedido(tipo, { cardapio, exemplos: EXEMPLOS, imagem, modelo })
  const msg = await cliente.beta.messages.create({
    ...pedido,
    ...(COM_FALLBACK.has(modelo) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  })
  if (msg.stop_reason === 'refusal') throw new ErroLeitura('recusa')
  if (msg.stop_reason === 'max_tokens') throw new ErroLeitura('resposta cortada')
  const texto = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  const saida = lerSaida(tipo, texto)
  if (!saida) throw new ErroLeitura('formato inesperado')
  return saida
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405)
  if (!usuarioLogado(req)) return resposta({ erro: 'Entre no app para ler a comanda.' }, 401)

  const chave = Deno.env.get('ANTHROPIC_API_KEY')
  if (!chave) return resposta({ erro: 'Leitura ainda não configurada. Lance à mão.' }, 503)

  let imagem = ''
  try {
    const corpo = await req.json()
    imagem = typeof corpo?.imagem === 'string' ? corpo.imagem.replace(/^data:image\/jpeg;base64,/, '') : ''
  } catch {
    // corpo inválido: cai no erro abaixo
  }
  if (!imagem) return resposta({ erro: 'Foto não recebida.' }, 400)
  if (tamanhoBase64(imagem) > LIMITE_FOTO) return resposta({ erro: 'Foto acima de 2 MB.' }, 413)

  const modelo = Deno.env.get('ANTHROPIC_MODEL') || MODELO_PADRAO
  // Sem novas tentativas: passou do tempo, o motoboy lança à mão.
  const cliente = new Anthropic({ apiKey: chave, timeout: TEMPO_LIMITE, maxRetries: 0 })
  const inicio = Date.now()
  try {
    const [leitura, conferencia] = await Promise.all([
      ler(cliente, modelo, 'completa', imagem),
      ler(cliente, modelo, 'conferencia', imagem),
    ])
    return resposta({ leitura, conferencia, modelo, ms: Date.now() - inicio })
  } catch (e) {
    // No log só o tipo do erro: nada da chave, da foto ou da resposta.
    const motivo =
      e instanceof ErroLeitura
        ? e.message
        : e instanceof Anthropic.APIConnectionTimeoutError
          ? 'tempo esgotado'
          : e instanceof Anthropic.APIError
            ? `API ${e.status ?? ''}`.trim()
            : 'erro inesperado'
    console.error(`ler-comanda: ${motivo} (${Date.now() - inicio} ms)`)
    const texto = motivo === 'tempo esgotado' ? 'A leitura demorou demais. Lance à mão.' : 'Não deu para ler a foto. Lance à mão.'
    // 200 com { erro }: a chamada chegou e a IA não leu (o app conta como tentativa, não como falta de internet).
    return resposta({ erro: texto })
  }
})
