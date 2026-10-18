// Painel do Luan: a folha da noite (uma coluna por motoboy), a coluna PIX, o acerto que
// ele confirma e o resumo da noite.
import { calcularAcerto, type Acerto, type Conferencia, type PorArea } from './acerto'
import type { Resultado } from './comanda'
import { formatarReais } from './dinheiro'
import type { AcertoConfirmado, Comanda, Forma, Noite, Pagamento } from './tipos'

/** Um caixa (motoboy numa noite) visto pela expedição. */
export interface CaixaDoMotoboy {
  noite: Noite
  motoboyId: string
  nome: string
  ordem: number | null // ordem de chegada
  criadoEm: string
}

const FORMA_CURTA: Record<Forma, string> = {
  dinheiro: 'din',
  cartao: 'cartão',
  pix_maquina: 'pix máq',
  pix_antecipado: 'pix',
}

/** Como na folha de papel: "din", "pix+din". */
export const formaCurta = (pagamentos: Pagamento[]) => pagamentos.map((p) => FORMA_CURTA[p.forma]).join('+')

export interface ItemFolha {
  comanda: Comanda
  forma: string
  /** Troco por Pix ("→ 3,00"). */
  trocoPix: number
  /** "•": papel ainda não conferido, depois de aberto o acerto. */
  papelPendente: boolean
}

export interface ColunaFolha {
  caixa: CaixaDoMotoboy
  posicao: number // 1, 2, 3... na ordem de chegada
  itens: ItemFolha[]
  conta: Acerto
  confirmado: AcertoConfirmado | null
  /** Saídas da noite, inclusive as que voltaram (cada uma é uma taxa). */
  entregas: number
  /** O acerto começou: o motoboy fechou a noite ou o dinheiro foi contado. */
  acertoAberto: boolean
}

export function montarFolha(caixas: CaixaDoMotoboy[], comandas: Comanda[], acertos: AcertoConfirmado[]): ColunaFolha[] {
  const ordenados = [...caixas].sort(
    (a, b) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity) || a.criadoEm.localeCompare(b.criadoEm),
  )
  return ordenados.map((caixa, i) => {
    const doCaixa = comandas
      .filter((c) => c.noiteId === caixa.noite.id)
      .sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))
    const confirmado = acertos.find((a) => a.caixaId === caixa.noite.id) ?? null
    const acertoAberto = caixa.noite.fechadaEm !== null || caixa.noite.dinheiroContado !== null || confirmado !== null
    return {
      caixa,
      posicao: i + 1,
      itens: doCaixa.map((c) => ({
        comanda: c,
        forma: formaCurta(c.pagamentos),
        trocoPix: c.pagamentos.some((p) => p.forma === 'dinheiro') ? c.troco : 0,
        papelPendente: acertoAberto && !c.papelConferido,
      })),
      conta: calcularAcerto(caixa.noite, doCaixa),
      confirmado,
      entregas: doCaixa.length,
      acertoAberto,
    }
  })
}

export interface ItemPix {
  comanda: Comanda
  nome: string // motoboy
  valor: number // a parte em Pix antecipado
}

/** Coluna PIX: os Pix antecipados da noite (de quem não voltou), na ordem de lançamento. */
export function colunaPix(colunas: ColunaFolha[]): ItemPix[] {
  return colunas
    .flatMap((col) =>
      col.itens
        .filter((i) => i.comanda.status !== 'voltou' && i.comanda.pagamentos.some((p) => p.forma === 'pix_antecipado'))
        .map((i) => ({
          comanda: i.comanda,
          nome: col.caixa.nome,
          valor: i.comanda.pagamentos.filter((p) => p.forma === 'pix_antecipado').reduce((s, p) => s + p.valor, 0),
        })),
    )
    .sort((a, b) => a.comanda.criadaEm.localeCompare(b.comanda.criadaEm))
}

export type AcertoParaGravar = Omit<AcertoConfirmado, 'confirmadoPor' | 'confirmadoPorNome' | 'confirmadoEm' | 'obs'>

/** R15: o que fica gravado ao confirmar (os valores do momento). */
export function montarAcerto(noite: Noite, comandas: Comanda[]): Resultado<AcertoParaGravar> {
  const c = calcularAcerto(noite, comandas).conferencia
  if (!c) return { ok: false, erro: 'Informe o dinheiro contado.' }
  return {
    ok: true,
    valor: {
      caixaId: noite.id,
      dinheiroContado: c.contado,
      falta: c.falta,
      sobra: c.sobra,
      pagoAoMotoboy: c.pagar,
      pagoDoCaixaDele: c.doCaixaDele,
      retiradoCaixaEmpresa: c.retiradoCaixaEmpresa,
      vaiParaEmpresa: c.vaiParaEmpresa,
      completadoDoBolso: c.completa,
    },
  }
}

/** R14 em uma frase: "Pague R$ 75,00 do caixa dele e retire R$ 95,00 do caixa da empresa." */
export function textoLiquidacao(c: Pick<Conferencia, 'pagar' | 'completa' | 'doCaixaDele' | 'retiradoCaixaEmpresa'>): string {
  if (c.pagar === 0)
    return c.completa > 0 ? `Não pague nada: ele completa ${formatarReais(c.completa)} do bolso.` : 'Não há nada a pagar.'
  const partes: string[] = []
  if (c.doCaixaDele > 0) partes.push(`pague ${formatarReais(c.doCaixaDele)} do caixa dele`)
  if (c.retiradoCaixaEmpresa > 0) partes.push(`retire ${formatarReais(c.retiradoCaixaEmpresa)} do caixa da empresa`)
  const frase = partes.join(' e ')
  return `${frase[0].toUpperCase()}${frase.slice(1)}.`
}

export interface ResumoDaNoite {
  recebido: { dinheiro: number; cartao: number; pixMaquina: number; pixAntecipado: number; troco: number }
  pagoAosMotoboys: number
  retiradoCaixaEmpresa: number
  foiParaEmpresa: number
  faltas: number
  sobras: number
  confirmados: number
  /** Sem acerto confirmado; com o dinheiro contado, os valores já entram nas somas. */
  pendentes: number
  /** Sem dinheiro contado: ainda fora das somas do acerto. */
  semContado: number
  porArea: Record<string, PorArea>
}

/** Resumo da noite. Caixa confirmado vale pelo que foi gravado; os outros, pela conta de agora. */
export function resumirNoiteDaEquipe(colunas: ColunaFolha[]): ResumoDaNoite {
  const r: ResumoDaNoite = {
    recebido: { dinheiro: 0, cartao: 0, pixMaquina: 0, pixAntecipado: 0, troco: 0 },
    pagoAosMotoboys: 0,
    retiradoCaixaEmpresa: 0,
    foiParaEmpresa: 0,
    faltas: 0,
    sobras: 0,
    confirmados: 0,
    pendentes: 0,
    semContado: 0,
    porArea: {},
  }
  const porArea = r.porArea
  for (const col of colunas) {
    const a = col.conta
    r.recebido.dinheiro += a.dinheiro
    r.recebido.cartao += a.cartao
    r.recebido.pixMaquina += a.pixMaquina
    r.recebido.pixAntecipado += a.pixAntecipado
    r.recebido.troco += a.troco
    for (const [id, p] of Object.entries(a.porArea)) {
      const t = (porArea[id] ??= { entregues: 0, voltaram: 0, taxas: 0 })
      t.entregues += p.entregues
      t.voltaram += p.voltaram
      t.taxas += p.taxas
    }
    const v = col.confirmado
      ? {
          pagar: col.confirmado.pagoAoMotoboy,
          retirado: col.confirmado.retiradoCaixaEmpresa,
          empresa: col.confirmado.vaiParaEmpresa,
          falta: col.confirmado.falta,
          sobra: col.confirmado.sobra,
        }
      : a.conferencia && {
          pagar: a.conferencia.pagar,
          retirado: a.conferencia.retiradoCaixaEmpresa,
          empresa: a.conferencia.vaiParaEmpresa,
          falta: a.conferencia.falta,
          sobra: a.conferencia.sobra,
        }
    if (col.confirmado) r.confirmados++
    else r.pendentes++
    if (!v) {
      r.semContado++
      continue
    }
    r.pagoAosMotoboys += v.pagar
    r.retiradoCaixaEmpresa += v.retirado
    r.foiParaEmpresa += v.empresa
    r.faltas += v.falta
    r.sobras += v.sobra
  }
  return r
}

export interface NumerosDaNoite {
  motoboys: number
  emRota: number
  entregues: number
  voltaram: number
  /** Pix antecipados que o Luan ainda não marcou como "caiu". */
  pixAConferir: number
  acertosPendentes: number
  /** Soma do que os motoboys devolvem e recebem, pela conta de agora. */
  devolver: number
  receber: number
}

/** O topo do painel: a noite num relance. */
export function numerosDaNoite(colunas: ColunaFolha[]): NumerosDaNoite {
  const comandas = colunas.flatMap((c) => c.itens.map((i) => i.comanda))
  const conta = (s: Comanda['status']) => comandas.filter((c) => c.status === s).length
  return {
    motoboys: colunas.length,
    emRota: conta('em_rota'),
    entregues: conta('entregue'),
    voltaram: conta('voltou'),
    pixAConferir: colunaPix(colunas).filter((p) => !p.comanda.pixConfirmado).length,
    acertosPendentes: colunas.filter((c) => !c.confirmado).length,
    devolver: colunas.reduce((s, c) => s + c.conta.devolver, 0),
    receber: colunas.reduce((s, c) => s + c.conta.receber, 0),
  }
}
