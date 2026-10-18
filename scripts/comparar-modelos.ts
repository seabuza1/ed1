// Compara modelos com as fotos da noite de teste (docs/SPEC-leitura.md, "Comparar modelos").
// Usa os mesmos adaptadores, prompt e leitura.ts da Edge Function e do app.
//
//   npm run comparar -- <pasta> [--modelos google:gemini-3.1-pro-preview,anthropic:claude-haiku-5-5] [--promo 10]
//
// <pasta>: as fotos .jpg (as do Storage, já reduzidas pelo app) e o gabarito.csv, separado por ";":
//   foto;codigo;total;area;forma
//   3557.jpg;3557;113,00;Aragarças;cartao        (forma: dinheiro, cartao ou pix; misto: cartao+dinheiro)
// Opcional: areas.csv (nome;taxa, ex.: Pontal do Araguaia;10,00); sem ele, as áreas do 001.
// Chaves no .env, fora do repositório: GEMINI_API_KEY e ANTHROPIC_API_KEY. O app só leva as VITE_.
// Saída: <pasta>/comparacao.csv e o resumo por modelo. Meta: zero verdes erradas.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXEMPLOS } from '../supabase/functions/_shared/exemplos/exemplos.ts'
import { lerDuasVezes, PROVEDORES, type Provedor } from '../supabase/functions/_shared/ia/ler.ts'
import { LIMITE_FOTO } from '../supabase/functions/_shared/prompt.ts'
import { CARDAPIO, normalizar } from '../src/domain/cardapio'
import { formatarNumero, lerReais } from '../src/domain/dinheiro'
import { conferirLeitura, type LeituraCompleta, type LeituraConferencia, type ResultadoLeitura } from '../src/domain/leitura'
import { paraCsv } from '../src/domain/medicao'
import type { Area } from '../src/domain/tipos'

const MODELOS_PADRAO = ['google:gemini-3.1-pro-preview', 'google:gemini-3.8-flash', 'anthropic:claude-haiku-5-5']

/** US$ por milhão de tokens (entrada, entrada do cache, saída). Confira nas páginas de preço antes de decidir. */
const PRECOS: Record<string, { entrada: number; cache: number; saida: number }> = {
  'google:gemini-3.1-pro-preview': { entrada: 2, cache: 0.2, saida: 12 },
  'google:gemini-3.8-flash': { entrada: 0.75, cache: 0.075, saida: 3.75 }, // promocional até 31/12/2026
  'anthropic:claude-haiku-5-5': { entrada: 0.1, cache: 0.01, saida: 0.5 },
  'anthropic:claude-sonnet-5-5': { entrada: 2, cache: 0.1, saida: 10 },
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

/** Linhas de um CSV com ";" e cabeçalho, como objetos. */
function lerCsv(arquivo: string): Record<string, string>[] {
  const [cabecalho, ...linhas] = readFileSync(arquivo, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split(';').map((c) => c.trim()))
  return linhas.map((l) => Object.fromEntries(cabecalho.map((k, i) => [k.toLowerCase(), l[i] ?? ''])))
}

/** Formas sem repetir e em ordem ("cartao+dinheiro"); Pix na máquina e antecipado contam como pix. */
const formas = (fs: string[]) =>
  [...new Set(fs.map((f) => (f.startsWith('pix') ? 'pix' : f)))].sort().join('+')
const formasLidas = (r: ResultadoLeitura) => formas(r.pagamentos.map((p) => (p.pedePix ? 'pix' : (p.forma ?? '?'))))

const pasta = process.argv[2]
if (!pasta || !existsSync(join(pasta, 'gabarito.csv'))) {
  console.error('Uso: npm run comparar -- <pasta com as fotos e o gabarito.csv> [--modelos p:modelo,...] [--promo 10]')
  process.exit(1)
}
const modelos = (opcao('modelos') ?? MODELOS_PADRAO.join(',')).split(',').map((m) => m.trim())
const promo = opcao('promo') ? lerReais(opcao('promo')!) : null
const areas = existsSync(join(pasta, 'areas.csv'))
  ? lerCsv(join(pasta, 'areas.csv')).map((a, i) => ({ id: `area${i}`, nome: a.nome, taxa: lerReais(a.taxa) ?? 0, ativa: true }))
  : AREAS_001
const gabarito = new Map(lerCsv(join(pasta, 'gabarito.csv')).map((g) => [g.foto, g]))
const exemplos = new Set(EXEMPLOS.map((x) => `${x.nome}.jpg`))
const fotos = readdirSync(pasta)
  .filter((f) => /\.jpe?g$/i.test(f) && gabarito.has(f) && !exemplos.has(f))
  .sort()
console.log(`${fotos.length} fotos com gabarito (a foto do exemplo fica de fora).`)

const COLUNAS = ['modelo', 'foto', 'estado', 'certo', 'codigo_lido', 'codigo_certo', 'total_lido', 'total_certo', 'area_sugerida', 'origem', 'area_certa', 'forma_lida', 'forma_certa', 'motivos', 'ms', 'tokens_entrada', 'tokens_cache', 'tokens_saida', 'custo_usd', 'erro']
const linhas: string[][] = [COLUNAS]
const resumo: string[] = []

for (const id of modelos) {
  const [provedor, modelo] = id.split(':') as [Provedor, string]
  const p = PROVEDORES[provedor]
  const chave = p && process.env[p.chave]
  if (!p || !modelo || !chave) {
    console.warn(`${id}: pulado (${!p || !modelo ? 'use provedor:modelo' : `falta ${p.chave} no .env`}).`)
    continue
  }
  const preco = PRECOS[id]
  const conta = { verdesCertas: 0, verdesErradas: 0, amarelas: 0, vermelhas: 0, erros: 0, ms: 0, custo: 0, lidas: 0 }
  for (const foto of fotos) {
    const g = gabarito.get(foto)!
    const certo = { codigo: g.codigo, total: lerReais(g.total), area: normalizar(g.area), forma: formas(g.forma.split('+')) }
    const jpeg = readFileSync(join(pasta, foto))
    if (jpeg.length > LIMITE_FOTO) {
      linhas.push([id, foto, '', '', '', g.codigo, '', g.total, '', '', g.area, '', g.forma, '', '', '', '', '', '', 'foto acima de 2 MB'])
      conta.erros++
      continue
    }
    try {
      const r = await lerDuasVezes({ provedor, chave, modelo, modeloConferencia: modelo }, jpeg.toString('base64'), {
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
      const area = areas.find((a) => a.id === c.sugestao?.areaId)?.nome ?? ''
      const ok =
        c.codigo === certo.codigo && c.total === certo.total && normalizar(area) === certo.area && formasLidas(c) === certo.forma
      const custo = preco ? (r.tokens.entrada * preco.entrada + r.tokens.cache * preco.cache + r.tokens.saida * preco.saida) / 1e6 : null
      if (c.estado === 'verde') conta[ok ? 'verdesCertas' : 'verdesErradas']++
      else conta[c.estado === 'amarelo' ? 'amarelas' : 'vermelhas']++
      conta.ms += r.ms
      conta.custo += custo ?? 0
      conta.lidas++
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
        certo.forma,
        c.motivos.join(' | '),
        String(r.ms),
        String(r.tokens.entrada),
        String(r.tokens.cache),
        String(r.tokens.saida),
        custo === null ? '' : custo.toFixed(5),
        '',
      ])
    } catch (e) {
      conta.erros++
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
