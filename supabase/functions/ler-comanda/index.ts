// Edge Function ler-comanda (docs/SPEC-leitura.md): recebe a foto da comanda e devolve duas
// leituras da IA configurada, a completa e a de conferência (R25). Só transcreve; a conta é do app (R19).
// POST { imagem } (JPEG em base64) → { leitura, conferencia, provedor, modelo, ms, tokens } ou { erro }.
// Secrets: IA_PROVEDOR (google, o padrão, ou anthropic), IA_MODELO, IA_MODELO_CONFERENCIA,
// GEMINI_API_KEY e ANTHROPIC_API_KEY. Nenhuma chave vai para o front nem para os logs.
import cardapio from '../_shared/cardapio-mel.json' with { type: 'json' }
import { EXEMPLOS } from '../_shared/exemplos/exemplos.ts'
import { configurar, lerDuasVezes } from '../_shared/ia/ler.ts'
import { ErroIA } from '../_shared/ia/tipos.ts'
import { LIMITE_FOTO, tamanhoBase64 } from '../_shared/prompt.ts'

// As duas chamadas juntas; sem novas tentativas: passou do tempo, o motoboy lança à mão.
const TEMPO_LIMITE = 30_000
// A foto de 2 MB em base64 (4/3) com folga para o JSON.
const LIMITE_CORPO = Math.ceil((LIMITE_FOTO * 4) / 3) + 64 * 1024

const CORS = {
  'Access-Control-Allow-Origin': '*',
  // A lista de @supabase/supabase-js/cors.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
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

/** Função do banco com o login de quem pediu (as regras de acesso valem); null sem as variáveis. */
function rpc(req: Request, nome: string, corpo: unknown, sinal: AbortSignal): Promise<Response> | null {
  const url = Deno.env.get('SUPABASE_URL')
  const chave = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !chave) return null
  return fetch(`${url}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: chave, Authorization: req.headers.get('Authorization')!, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: sinal,
  })
}

/**
 * Antes de cada foto (011): perfil ativo (conta desativada pelo admin não gasta a IA) e uma das 60
 * leituras por hora da conta, que segura o gasto de uma conta que não é da pizzaria. A chave anon
 * nem executa a função (o usuário logado é conferido antes). Sem as variáveis do Supabase, passa.
 * Devolve 'ok' (com a vaga reservada), 'inativo', 'limite' ou o motivo da falha (para o log).
 */
async function acesso(req: Request, sinal: AbortSignal): Promise<{ estado: string; vaga?: string }> {
  const r = await rpc(req, 'reservar_leitura', {}, sinal)
  if (!r) return { estado: 'ok' }
  if (r.status === 401) return { estado: 'inativo' }
  const v = r.ok ? await r.json() : null
  // Outra resposta (banco fora, 011 sem rodar): o motivo vai para o log, e não é culpa do motoboy.
  if (v?.estado === 'ok' || v?.estado === 'limite' || v?.estado === 'inativo') return { estado: v.estado, vaga: v.vaga }
  return { estado: `reservar_leitura ${r.status}` }
}

/** O provedor não cobrou (fora do ar, ocupado ou mal configurado): a vaga volta para a conta. */
async function devolver(req: Request, vaga: string | undefined) {
  if (!vaga) return
  const r = await rpc(req, 'devolver_leitura', { p_vaga: vaga }, AbortSignal.timeout(5000))?.catch(() => null)
  if (r && !r.ok) console.error(`ler-comanda: devolver_leitura ${r.status}`)
}

async function atender(req: Request, sinal: AbortSignal, inicio: number): Promise<Response> {
  const config = configurar((nome) => Deno.env.get(nome))
  if ('falta' in config) {
    console.error(`ler-comanda: falta o secret ${config.falta}`)
    return resposta({ erro: 'Leitura ainda não configurada. Lance à mão.' }, 503)
  }

  // Antes de ler o corpo: sem usuário logado (a chave anon é pública) ou corpo grande demais, nem lê.
  if (!usuarioLogado(req)) return resposta({ erro: 'Entre no app para ler a comanda.' }, 401)
  if (Number(req.headers.get('Content-Length') ?? 0) > LIMITE_CORPO) return resposta({ erro: 'Foto acima de 2 MB.' }, 413)

  let imagem = ''
  try {
    const corpo = await req.json()
    imagem = typeof corpo?.imagem === 'string' ? corpo.imagem.replace(/^data:image\/jpeg;base64,/, '') : ''
  } catch {
    // corpo inválido: cai no erro abaixo
  }
  if (!imagem) return resposta({ erro: 'Foto não recebida.' }, 400)
  if (tamanhoBase64(imagem) > LIMITE_FOTO) return resposta({ erro: 'Foto acima de 2 MB.' }, 413)

  const pode = await acesso(req, sinal).catch(() => ({
    estado: sinal.aborted ? 'reservar_leitura tempo esgotado' : 'reservar_leitura rede',
    vaga: undefined,
  }))
  if (pode.estado === 'inativo') return resposta({ erro: 'Entre no app para ler a comanda.' }, 401)
  if (pode.estado === 'limite') return resposta({ erro: 'Muitas leituras nesta hora.' }, 429)
  if (pode.estado !== 'ok') {
    console.error(`ler-comanda: ${pode.estado} (${Date.now() - inicio} ms)`)
    return resposta({ erro: 'A IA não respondeu agora.' }, 503)
  }

  try {
    return resposta(await lerDuasVezes(config, imagem, { cardapio, exemplos: EXEMPLOS, sinal }))
  } catch (e) {
    // No log só o tipo do erro: nada da chave, da foto ou da resposta.
    const motivo = sinal.aborted ? 'tempo esgotado' : e instanceof ErroIA ? e.message : 'erro inesperado'
    console.error(`ler-comanda: ${config.provedor} ${motivo} (${Date.now() - inicio} ms)`)
    const status = e instanceof ErroIA && !sinal.aborted ? (e.status ?? 0) : 0
    const configuracao = status === 400 || status === 401 || status === 402 || status === 403 || status === 404
    const foraDoAr = status === 408 || status === 429 || status >= 500
    // Nos dois casos o provedor não leu nem cobrou: a vaga das 60 por hora volta.
    if (configuracao || foraDoAr) await devolver(req, pode.vaga)
    // Pedido recusado sem ser pela foto (parâmetro que o modelo não aceita), chave recusada, sem
    // crédito ou modelo que não existe (desligado): 503, a foto espera a correção.
    if (configuracao) return resposta({ erro: 'Leitura ainda não configurada. Lance à mão.' }, 503)
    // Provedor ocupado ou fora do ar: 503, o app lê a foto mais tarde.
    if (foraDoAr) return resposta({ erro: 'A IA não respondeu agora.' }, 503)
    const texto = motivo === 'tempo esgotado' ? 'A leitura demorou demais. Lance à mão.' : 'Não deu para ler a foto. Lance à mão.'
    // 200 com { erro }: a chamada chegou e a IA não leu (o app conta como tentativa, não como falta de internet).
    return resposta({ erro: texto })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405)
  // O relógio conta da chegada do pedido. Se o app desiste (Digitar, outra foto), a função para também.
  const ctrl = new AbortController()
  const parar = () => ctrl.abort()
  const relogio = setTimeout(parar, TEMPO_LIMITE)
  req.signal.addEventListener('abort', parar)
  try {
    return await atender(req, ctrl.signal, Date.now())
  } finally {
    clearTimeout(relogio)
    req.signal.removeEventListener('abort', parar)
  }
})
