// Compara modelos com as fotos da noite de teste (docs/SPEC-leitura.md, "Comparar modelos").
// Usa os mesmos adaptadores, prompt e leitura.ts da Edge Function e do app.
//
//   npm run comparar -- <pasta> [--modelos google:gemini-3.1-pro-preview,qwen:qwen3-vl-plus] [--promo 10]
//
// <pasta>: as fotos .jpg (as do Storage, já reduzidas pelo app) e o gabarito.csv, separado por ";":
//   foto;codigo;total;area;forma
//   3557.jpg;3557;113,00;Aragarças;cartao        (forma: dinheiro, cartao ou pix; misto: cartao+dinheiro)
// Opcional: areas.csv (nome;taxa, ex.: Pontal do Araguaia;10,00); sem ele, as áreas do 001.
// Chaves no .env, fora do repositório: GEMINI_API_KEY, ANTHROPIC_API_KEY, DASHSCOPE_API_KEY (Qwen) e, para
// um servidor no formato do OpenAI, COMPATIVEL_URL (https://.../v1) e COMPATIVEL_API_KEY, com os modelos
// como compativel:<modelo>. O app só leva as VITE_.
// Saída: <pasta>/comparacao.csv e o resumo por modelo. Meta: zero verdes erradas.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXEMPLOS } from '../supabase/functions/_shared/exemplos/exemplos.ts'
import { configurar, lerDuasVezes } from '../supabase/functions/_shared/ia/ler.ts'
import { LIMITE_FOTO } from '../supabase/functions/_shared/prompt.ts'
import { CARDAPIO } from '../src/domain/cardapio'
import { acertou, areaSugerida, contaVazia, custoUsd, formasLidas, juntarFormas, somarLida, type Preco } from '../src/domain/comparacao'
import { formatarNumero, lerReais } from '../src/domain/dinheiro'
import { conferirLeitura, type LeituraCompleta, type LeituraConferencia } from '../src/domain/leitura'
import { deCsv, paraCsv } from '../src/domain/medicao'
import type { Area } from '../src/domain/tipos'

const MODELOS_PADRAO = ['google:gemini-3.1-pro-preview', 'google:gemini-3.8-flash', 'anthropic:claude-haiku-5-5', 'qwen:qwen3-vl-plus']

/**
 * US$ por milhão de tokens (entrada, entrada do cache, saída e, na Anthropic, a escrita no cache, a
 * 1,25 × a entrada). Confira nas páginas de preço antes de decidir.
 */
const PRECOS: Record<string, Preco> = {
  'google:gemini-3.1-pro-preview': { entrada: 2, cache: 0.2, saida: 12 },
  'google:gemini-3.8-flash': { entrada: 0.75, cache: 0.075, saida: 3.75 }, // promocional até 31/12/2026
  'anthropic:claude-haiku-5-5': { entrada: 0.1, cache: 0.01, saida: 0.5, escritaCache: 0.125 },
  'anthropic:claude-sonnet-5-5': { entrada: 2, cache: 0.1, saida: 10, escritaCache: 2.5 },
  'qwen:qwen3-vl-plus': { entrada: 0.2, cache: 0.04, saida: 1.6 }, // Singapura, até 32 mil tokens de entrada
}

const AREAS_001: Area[] = [
  { id: 'aragarcas', nome: 'Aragarças', taxa: 500, ativa: true },
  { id: 'pontal', nome: 'Pontal do Araguaia', taxa: 1000, ativa: true },
  { id: 'barra', nome: 'Barra do Garças', taxa: 1200, ativa: true },
  { id: 'parque', nome: 'Parque de Exposições', taxa: 1500, ativa: true },
]

function opcao(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

/** Linhas de um CSV com cabeçalho, como objetos; avisa se faltar coluna. */
function lerCsv<C extends string>(arquivo: string, colunas: readonly C[]): Record<C, string>[] {
  const [cabecalho = [], ...linhas] = deCsv(readFileSync(arquivo, 'utf8'))
  const chaves = cabecalho.map((k) => k.toLowerCase())
  const faltam = colunas.filter((c) => !chaves.includes(c))
  if (faltam.length) {
    console.error(`${arquivo}: falta a coluna ${faltam.join(', ')} no cabeçalho.`)
    process.exit(1)
  }
  return linhas.map((l) => Object.fromEntries(chaves.map((k, i) => [k, l[i] ?? ''])) as Record<C, string>)
}


const COLUNAS_GABARITO = ['foto', 'codigo', 'total', 'area', 'forma'] as const

const pasta = process.argv[2]
if (!pasta || !existsSync(join(pasta, 'gabarito.csv'))) {
  console.error('Uso: npm run comparar -- <pasta com as fotos e o gabarito.csv> [--modelos p:modelo,...] [--promo 10]')
  process.exit(1)
}
const modelos = (opcao('modelos') ?? MODELOS_PADRAO.join(',')).split(',').map((m) => m.trim())
const promo = opcao('promo') ? lerReais(opcao('promo')!) : null
const areas = existsSync(join(pasta, 'areas.csv'))
  ? lerCsv(join(pasta, 'areas.csv'), ['nome', 'taxa']).map((a, i) => ({ id: `area${i}`, nome: a.nome, taxa: lerReais(a.taxa) ?? 0, ativa: true }))
  : AREAS_001
const gabarito = new Map(lerCsv(join(pasta, 'gabarito.csv'), COLUNAS_GABARITO).map((g) => [g.foto, g]))
const exemplos = new Set(EXEMPLOS.map((x) => `${x.nome}.jpg`))
const fotos = readdirSync(pasta)
  .filter((f) => /\.jpe?g$/i.test(f) && gabarito.has(f) && !exemplos.has(f))
  .sort()
console.log(`${fotos.length} fotos com gabarito (a foto do exemplo fica de fora).`)

const COLUNAS = ['modelo', 'foto', 'estado', 'certo', 'codigo_lido', 'codigo_certo', 'total_lido', 'total_certo', 'area_sugerida', 'origem', 'area_certa', 'forma_lida', 'forma_certa', 'motivos', 'ms', 'tokens_entrada', 'tokens_cache', 'tokens_saida', 'custo_usd', 'erro']
const linhas: string[][] = [COLUNAS]
const resumo: string[] = []

for (const id of modelos) {
  // O nome do modelo pode ter ":" (qwen2.5vl:7b num servidor compatível).
  const provedor = id.slice(0, id.indexOf(':'))
  const modelo = id.slice(id.indexOf(':') + 1)
  const config = configurar((n) => (n === 'IA_PROVEDOR' ? provedor : /^IA_MODELO/.test(n) ? modelo : process.env[n]))
  if (!provedor || !modelo || 'falta' in config) {
    console.warn(`${id}: pulado (${'falta' in config && provedor && modelo ? `falta ${config.falta} no .env` : 'use provedor:modelo'}).`)
    continue
  }
  const preco = PRECOS[id]
  let conta = contaVazia()
  for (const foto of fotos) {
    const g = gabarito.get(foto)!
    const jpeg = readFileSync(join(pasta, foto))
    if (jpeg.length > LIMITE_FOTO) {
      linhas.push([id, foto, '', '', '', g.codigo, '', g.total, '', '', g.area, '', g.forma, '', '', '', '', '', '', 'foto acima de 2 MB'])
      conta = { ...conta, erros: conta.erros + 1 }
      continue
    }
    try {
      const r = await lerDuasVezes(config, jpeg.toString('base64'), {
        cardapio: CARDAPIO,
        exemplos: EXEMPLOS,
        sinal: AbortSignal.timeout(30_000),
      })
      const c = conferirLeitura({
        leitura: r.leitura as unknown as LeituraCompleta,
        conferencia: r.conferencia as unknown as LeituraConferencia,
        areas,
        promoDesconto: promo,
      })
      const area = areaSugerida(c, areas)
      const ok = acertou(c, areas, g)
      const custo = preco ? custoUsd(r.tokens, preco) : null
      conta = somarLida(conta, c.estado, ok, r.ms, custo ?? 0)
      linhas.push([
        id,
        foto,
        c.estado,
        ok ? 'sim' : 'não',
        c.codigo ?? '',
        g.codigo,
        c.total === null ? '' : formatarNumero(c.total),
        g.total,
        area,
        c.sugestao?.origem ?? '',
        g.area,
        formasLidas(c),
        juntarFormas(g.forma.split('+')),
        c.motivos.join(' | '),
        String(r.ms),
        String(r.tokens.entrada),
        String(r.tokens.cache),
        String(r.tokens.saida),
        custo === null ? '' : custo.toFixed(5),
        '',
      ])
    } catch (e) {
      conta = { ...conta, erros: conta.erros + 1 }
      linhas.push([id, foto, '', '', '', g.codigo, '', g.total, '', '', g.area, '', g.forma, '', '', '', '', '', '', e instanceof Error ? e.message : String(e)])
    }
    process.stdout.write('.')
  }
  const media = (v: number) => (conta.lidas ? v / conta.lidas : 0)
  resumo.push(
    `${id}: verdes certas ${conta.verdesCertas}, VERDES ERRADAS ${conta.verdesErradas}, amarelas ${conta.amarelas}, ` +
      `vermelhas ${conta.vermelhas}, erros ${conta.erros}; ${(media(conta.ms) / 1000).toFixed(1)} s por foto; ` +
      (preco ? `US$ ${media(conta.custo).toFixed(4)} por foto` : 'sem preço na tabela'),
  )
  console.log()
}

writeFileSync(join(pasta, 'comparacao.csv'), paraCsv(linhas))
console.log(`\n${resumo.join('\n')}\n\nDetalhe em ${join(pasta, 'comparacao.csv')}. Escolha o mais barato com zero verdes erradas e poucas vermelhas.`)
