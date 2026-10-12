import { NOMES_FORMA, type Resultado } from './comanda'
import { formatarReais } from './dinheiro'
import type { Comanda, Forma, Noite } from './tipos'

export interface Conferencia {
  situacao: 'bateu' | 'falta' | 'sobra'
  contado: number
  dif: number // contado − devolver
  falta: number
  sobra: number
  pagar: number // o que o motoboy recebe depois de descontar a falta
  completa: number // o que ele põe do bolso se a falta passar do que recebe
}

export interface Acerto {
  dinheiro: number
  troco: number
  cartao: number
  pixMaquina: number
  pixAntecipado: number
  taxas: number
  caixaInicial: number
  diaria: number
  devolver: number
  maquininha: number
  receber: number
  qtdComandas: number // todas, inclusive as que voltaram: cada uma gera uma taxa
  qtdEmRota: number
  conferencia: Conferencia | null
}

type DadosNoite = Pick<Noite, 'caixaInicial' | 'diaria' | 'dinheiroContado'>

const somaForma = (comandas: Comanda[], forma: Forma) =>
  comandas.reduce(
    (s, c) => s + c.pagamentos.reduce((t, p) => (p.forma === forma ? t + p.valor : t), 0),
    0,
  )

/** Conta do acerto (R6, R8–R12). Em rota conta como entregue. */
export function calcularAcerto(noite: DadosNoite, comandas: Comanda[]): Acerto {
  const entregues = comandas.filter((c) => c.status !== 'voltou')

  const dinheiro = somaForma(entregues, 'dinheiro')
  const troco = entregues
    .filter((c) => c.pagamentos.some((p) => p.forma === 'dinheiro'))
    .reduce((s, c) => s + c.troco, 0)
  const cartao = somaForma(entregues, 'cartao')
  const pixMaquina = somaForma(entregues, 'pix_maquina')
  const pixAntecipado = somaForma(entregues, 'pix_antecipado')
  const taxas = comandas.reduce((s, c) => s + c.taxa, 0)

  const devolver = noite.caixaInicial + dinheiro + troco
  const maquininha = cartao + pixMaquina
  const receber = noite.diaria + taxas

  let conferencia: Conferencia | null = null
  if (noite.dinheiroContado !== null) {
    const dif = noite.dinheiroContado - devolver
    const falta = Math.max(0, -dif)
    conferencia = {
      situacao: dif === 0 ? 'bateu' : dif < 0 ? 'falta' : 'sobra',
      contado: noite.dinheiroContado,
      dif,
      falta,
      sobra: Math.max(0, dif),
      pagar: Math.max(0, receber - falta),
      completa: Math.max(0, falta - receber),
    }
  }

  return {
    dinheiro,
    troco,
    cartao,
    pixMaquina,
    pixAntecipado,
    taxas,
    caixaInicial: noite.caixaInicial,
    diaria: noite.diaria,
    devolver,
    maquininha,
    receber,
    qtdComandas: comandas.length,
    qtdEmRota: comandas.filter((c) => c.status === 'em_rota').length,
    conferencia,
  }
}

export interface LinhaConta {
  rotulo: string
  valor: number
  origem: string // de onde vem o número
}

const partes = (itens: [number, string][], sempre = 0) =>
  itens
    .filter(([v], i) => v !== 0 || i < sempre)
    .map(([v, txt]) => `${formatarReais(v)} ${txt}`)
    .join(' + ')

/** A conta explicada: "R$ 80,00 de caixa + R$ 160,00 em dinheiro + R$ 3,00 de troco por Pix". */
export function detalharAcerto(a: Acerto): LinhaConta[] {
  const linhas: LinhaConta[] = [
    {
      rotulo: 'Devolver',
      valor: a.devolver,
      origem: partes(
        [
          [a.caixaInicial, 'de caixa'],
          [a.dinheiro, 'em dinheiro'],
          [a.troco, 'de troco por Pix'],
        ],
        1,
      ),
    },
    {
      rotulo: 'Maquininha',
      valor: a.maquininha,
      origem:
        partes([
          [a.cartao, 'em cartão'],
          [a.pixMaquina, 'em Pix na máquina'],
        ]) || 'Nada na maquininha',
    },
    {
      rotulo: 'Receber',
      valor: a.receber,
      origem: `${formatarReais(a.diaria)} de diária + ${formatarReais(a.taxas)} de taxas (${a.qtdComandas} ${a.qtdComandas === 1 ? 'comanda' : 'comandas'})`,
    },
  ]
  if (a.pixAntecipado > 0)
    linhas.push({
      rotulo: 'Pix antecipado',
      valor: a.pixAntecipado,
      origem: 'Não passa pela sua mão; só a taxa conta',
    })
  return linhas
}

export interface ItemMaquininha {
  codigo: string
  forma: Forma
  nomeForma: string
  valor: number
}

/** O que o relatório da maquininha deve mostrar: cartão e Pix na máquina das entregues. */
export function itensMaquininha(comandas: Comanda[]): ItemMaquininha[] {
  return [...comandas]
    .filter((c) => c.status !== 'voltou')
    .sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))
    .flatMap((c) =>
      c.pagamentos
        .filter((p) => p.forma === 'cartao' || p.forma === 'pix_maquina')
        .map((p) => ({ codigo: c.codigo, forma: p.forma, nomeForma: NOMES_FORMA[p.forma], valor: p.valor })),
    )
}

// Conferência e acerto com o Luan. Só com a noite aberta; devolvem só os campos que mudam.

export function registrarContado(
  noite: Noite,
  contado: number | null,
): Resultado<Pick<Noite, 'dinheiroContado'>> {
  if (noite.fechadaEm !== null) return { ok: false, erro: 'Noite fechada. Reabra para editar.' }
  if (contado !== null && (!Number.isInteger(contado) || contado < 0))
    return { ok: false, erro: 'Valor contado inválido.' }
  return { ok: true, valor: { dinheiroContado: contado } }
}

export type TipoDiferenca = 'bateu' | 'falta' | 'sobra'

/** Falta ou sobra que o Luan achou → luanDiferenca (negativo = falta, positivo = sobra). */
export function diferencaLuan(tipo: TipoDiferenca | null, valor: number | null): number | null {
  if (tipo === null) return null
  if (tipo === 'bateu') return 0
  if (valor === null) return null
  return tipo === 'falta' ? -valor : valor
}

export function tipoDiferenca(luanDiferenca: number | null): TipoDiferenca | null {
  if (luanDiferenca === null) return null
  return luanDiferenca === 0 ? 'bateu' : luanDiferenca < 0 ? 'falta' : 'sobra'
}

type DadosLuan = Pick<Noite, 'luanPagou' | 'luanDiferenca' | 'minutosAcerto' | 'obs'>

export function registrarLuan(noite: Noite, dados: DadosLuan): Resultado<DadosLuan> {
  if (noite.fechadaEm !== null) return { ok: false, erro: 'Noite fechada. Reabra para editar.' }
  const inteiro = (n: number | null) => n === null || Number.isInteger(n)
  if (!inteiro(dados.luanPagou) || (dados.luanPagou ?? 0) < 0)
    return { ok: false, erro: 'Valor pago inválido.' }
  if (!inteiro(dados.luanDiferenca)) return { ok: false, erro: 'Falta ou sobra inválida.' }
  if (!inteiro(dados.minutosAcerto) || (dados.minutosAcerto ?? 0) < 0)
    return { ok: false, erro: 'Tempo inválido.' }
  return { ok: true, valor: { ...dados, obs: dados.obs.trim() === '' ? '' : dados.obs } }
}

export interface ComparacaoLuan {
  esperado: number // o que o app diz que ele recebe
  diferencaPago: number // luanPagou − esperado
  diferencaFaltaSobra: number | null // falta/sobra do Luan − a do app (com as duas informadas)
  bateu: boolean
}

/** Compara o acerto feito pelo Luan com o do app. null se o Luan ainda não pagou. */
export function compararComLuan(noite: Noite, a: Acerto): ComparacaoLuan | null {
  if (noite.luanPagou === null) return null
  const esperado = a.conferencia ? a.conferencia.pagar : a.receber
  const diferencaPago = noite.luanPagou - esperado
  const diferencaFaltaSobra =
    a.conferencia && noite.luanDiferenca !== null ? noite.luanDiferenca - a.conferencia.dif : null
  return {
    esperado,
    diferencaPago,
    diferencaFaltaSobra,
    bateu: diferencaPago === 0 && (diferencaFaltaSobra ?? 0) === 0,
  }
}

/** Selo do histórico: "Bateu com o Luan" ou "Diferença de R$ x". */
export function seloLuan(c: ComparacaoLuan): string {
  if (c.bateu) return 'Bateu com o Luan'
  const dif = c.diferencaPago !== 0 ? c.diferencaPago : (c.diferencaFaltaSobra ?? 0)
  return `Diferença de ${formatarReais(Math.abs(dif))}`
}

export interface ResumoNoite {
  noite: Noite
  qtdComandas: number
  devolver: number
  receber: number
  pago: number | null // o que o Luan pagou
  selo: string | null // "Bateu com o Luan" / "Diferença de R$ x"; null sem acerto do Luan
  bateu: boolean | null
}

/** Histórico: uma linha por noite, a mais recente primeiro. */
export function resumirNoites(noites: Noite[], comandas: Comanda[]): ResumoNoite[] {
  const porNoite = new Map<string, Comanda[]>()
  for (const c of comandas) porNoite.set(c.noiteId, [...(porNoite.get(c.noiteId) ?? []), c])
  return [...noites]
    .sort((a, b) => b.data.localeCompare(a.data))
    .map((noite) => {
      const doDia = porNoite.get(noite.id) ?? []
      const a = calcularAcerto(noite, doDia)
      const comp = compararComLuan(noite, a)
      return {
        noite,
        qtdComandas: doDia.length,
        devolver: a.devolver,
        receber: a.receber,
        pago: noite.luanPagou,
        selo: comp ? seloLuan(comp) : null,
        bateu: comp ? comp.bateu : null,
      }
    })
}
