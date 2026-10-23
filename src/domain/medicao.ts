// Medição da leitura por foto (R27 e "Pronto quando" da SPEC-leitura): as leituras da noite em
// CSV, uma linha por comanda lida, e o resumo que importa (quantas verdes estavam erradas).
import { formatarHora } from './datas'
import { formatarNumero } from './dinheiro'
import { formasDiscordam, pagamentoEscrito, valorLido, type RegistroLeitura } from './leitura'
import { formaCurta } from './painel'
import type { Area, Comanda, Pagamento } from './tipos'

/** Uma leitura com o que a nuvem sabe dela: a noite, o motoboy e a comanda como está agora. */
export interface LeituraMedida {
  registro: RegistroLeitura
  data: string
  motoboy: string
  /** null: a comanda foi apagada depois (ou a leitura nunca foi lançada). */
  atual: Comanda | null
}

const partes = (ps: Pagamento[]) => ps.map((p) => `${p.forma}:${p.valor}`).join('+')

/** A comanda mudou depois de lançada (código, total, área, partes do pagamento ou troco)? */
function mudouDepois(m: LeituraMedida): 'sim' | 'não' | 'apagada' {
  const l = m.registro.lancado
  if (!l) return 'não'
  const c = m.atual
  if (!c) return 'apagada'
  const igual =
    c.codigo === l.codigo &&
    c.total === l.total &&
    c.areaId === l.areaId &&
    partes(c.pagamentos) === partes(l.pagamentos) &&
    c.troco === l.troco
  return igual ? 'não' : 'sim'
}

/** R28: a leitura feita depois do lançamento à mão discorda dele (código, total, área ou forma)? */
function lidaDepoisDiscorda(r: RegistroLeitura): boolean {
  const l = r.lancado
  if (!r.resultado.posterior || !l) return false
  return (
    r.leitura.telefone_final !== l.codigo ||
    valorLido(r.leitura.total_escrito) !== l.total ||
    (r.resultado.areaSugerida !== null && r.resultado.areaSugerida !== l.areaId) ||
    formasDiscordam(r.leitura, l.pagamentos)
  )
}

/** Verde que precisou de correção, mudou depois ou discorda do lançado à mão: a meta é zero.
 * Apagar a comanda (voltou, lançada por engano) não diz que a leitura errou. */
export const verdeErrada = (m: LeituraMedida) =>
  m.registro.resultado.estado === 'verde' &&
  (m.registro.corrigido || mudouDepois(m) === 'sim' || lidaDepoisDiscorda(m.registro))

const COLUNAS = [
  'noite',
  'hora',
  'motoboy',
  'estado',
  'estado_final',
  'verde_errada',
  'corrigido',
  'forcado',
  'lida_depois',
  'mudou_depois',
  'codigo_lido',
  'codigo_lancado',
  'total_lido',
  'total_lancado',
  'esperado',
  'area_sugerida',
  'origem_area',
  'area_lancada',
  'pagamento_lido',
  'pagamento_lancado',
  'divergencias',
  'ilegiveis',
  'motivos',
  'segundos',
  'ms_ia',
  'provedor',
  'modelo',
  'tokens_entrada',
  'tokens_cache',
  'tokens_saida',
  'comanda_id',
]

export function linhasMedicao(leituras: LeituraMedida[], areas: Area[]): string[][] {
  const area = (id: string | null | undefined) => (id ? (areas.find((a) => a.id === id)?.nome ?? id) : '')
  const sim = (b: boolean) => (b ? 'sim' : 'não')
  const valor = (n: number | null | undefined) => (n === null || n === undefined ? '' : formatarNumero(n))
  return [
    COLUNAS,
    ...leituras.map((m) => {
      const r = m.registro
      const l = r.lancado
      return [
        m.data,
        formatarHora(r.criadaEm),
        m.motoboy,
        r.resultado.estado,
        l?.estado ?? '',
        sim(verdeErrada(m)),
        sim(r.corrigido),
        sim(r.forcado),
        sim(r.resultado.posterior),
        mudouDepois(m),
        r.leitura.telefone_final ?? '',
        l?.codigo ?? '',
        r.leitura.total_escrito ?? '',
        valor(l?.total),
        valor(r.resultado.esperado),
        area(r.resultado.areaSugerida),
        r.resultado.origem ?? '',
        area(l?.areaId),
        pagamentoEscrito(r.leitura),
        l ? formaCurta(l.pagamentos) : '',
        r.resultado.divergencias.join(' '),
        String(r.leitura.ilegiveis.length),
        r.resultado.motivos.join(' | '),
        l?.segundos === null || l?.segundos === undefined ? '' : String(l.segundos),
        String(r.ms),
        r.provedor ?? '',
        r.modelo,
        r.tokens ? String(r.tokens.entrada) : '',
        r.tokens ? String(r.tokens.cache) : '',
        r.tokens ? String(r.tokens.saida) : '',
        r.comandaId ?? '',
      ]
    }),
  ]
}

/** CSV para planilha em português: ";" entre colunas, aspas quando precisa, e texto que começa
 * com = + - @ (vindo da IA) não vira fórmula. */
export function paraCsv(linhas: string[][]): string {
  const celula = (v: string) => {
    const seguro = /^[=+\-@]/.test(v) ? `'${v}` : v
    return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro
  }
  return linhas.map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n'
}

/**
 * O inverso do paraCsv, para o gabarito e as áreas do comparar-modelos: ";" ou ",", aspas com ""
 * dentro, BOM do Excel ("CSV UTF-8") e o ' que protege fórmula. Linhas vazias saem.
 */
export function deCsv(texto: string): string[][] {
  const t = texto.replace(/^\uFEFF/, '')
  const separador = (t.split(/\r?\n/, 1)[0].match(/;/g)?.length ?? 0) > 0 ? ';' : ','
  const linhas: string[][] = []
  let linha: string[] = []
  let celula = ''
  let aspas = false
  const fecharCelula = () => {
    linha.push(/^'[=+\-@]/.test(celula) ? celula.slice(1) : celula.trim())
    celula = ''
  }
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') {
        celula += '"'
        i++
      } else if (ch === '"') aspas = false
      else celula += ch
    } else if (ch === '"') aspas = true
    else if (ch === separador) fecharCelula()
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      fecharCelula()
      if (linha.some((c) => c !== '')) linhas.push(linha)
      linha = []
    } else celula += ch
  }
  fecharCelula()
  if (linha.some((c) => c !== '')) linhas.push(linha)
  return linhas
}

export const nomeArquivoLeituras = (de: string, ate: string) =>
  de === ate ? `leituras-${de}.csv` : `leituras-${de}-a-${ate}.csv`

export interface ResumoMedicao {
  total: number
  verdes: number
  verdesErradas: number
  amarelas: number
  vermelhas: number
  forcadas: number
  /** Média da foto ao lançamento, em segundos; null sem nenhuma medida. */
  segundosMedio: number | null
}

export function resumirMedicao(leituras: LeituraMedida[]): ResumoMedicao {
  const conta = (f: (m: LeituraMedida) => boolean) => leituras.filter(f).length
  const tempos = leituras.flatMap((m) => (m.registro.lancado?.segundos != null ? [m.registro.lancado.segundos] : []))
  return {
    total: leituras.length,
    verdes: conta((m) => m.registro.resultado.estado === 'verde'),
    verdesErradas: conta(verdeErrada),
    amarelas: conta((m) => m.registro.resultado.estado === 'amarelo'),
    vermelhas: conta((m) => m.registro.resultado.estado === 'vermelho'),
    forcadas: conta((m) => m.registro.forcado),
    segundosMedio: tempos.length ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : null,
  }
}
