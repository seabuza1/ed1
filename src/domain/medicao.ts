// Medição da leitura por foto (R27 e "Pronto quando" da SPEC-leitura): as leituras da noite em
// CSV, uma linha por comanda lida, e o resumo que importa (quantas verdes estavam erradas).
import { formatarHora } from './datas'
import { formatarNumero } from './dinheiro'
import type { RegistroLeitura } from './leitura'
import { formaCurta } from './painel'
import type { Area, Comanda } from './tipos'

/** Uma leitura com o que a nuvem sabe dela: a noite, o motoboy e a comanda como está agora. */
export interface LeituraMedida {
  registro: RegistroLeitura
  data: string
  motoboy: string
  /** null: a comanda foi apagada depois (ou a leitura nunca foi lançada). */
  atual: Comanda | null
}

/** A comanda mudou depois de lançada (código, total, área ou pagamento)? */
function mudouDepois(m: LeituraMedida): 'sim' | 'não' | 'apagada' {
  const l = m.registro.lancado
  if (!l) return 'não'
  const c = m.atual
  if (!c) return 'apagada'
  const igual =
    c.codigo === l.codigo && c.total === l.total && c.areaId === l.areaId && formaCurta(c.pagamentos) === formaCurta(l.pagamentos)
  return igual ? 'não' : 'sim'
}

/** Verde que precisou de correção (ou mudou depois): a meta é zero. Apagar a comanda (voltou,
 * lançada por engano) não diz que a leitura errou. */
export const verdeErrada = (m: LeituraMedida) =>
  m.registro.resultado.estado === 'verde' && (m.registro.corrigido || mudouDepois(m) === 'sim')

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
  'modelo',
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
        r.leitura.pagamento.map((p) => p.forma_escrita).join(' + '),
        l ? formaCurta(l.pagamentos) : '',
        r.resultado.divergencias.join(' '),
        String(r.leitura.ilegiveis.length),
        r.resultado.motivos.join(' | '),
        l?.segundos === null || l?.segundos === undefined ? '' : String(l.segundos),
        String(r.ms),
        r.modelo,
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
