import type { Resultado } from './comanda'
import { formatarData } from './datas'
import type { Comanda, Noite } from './tipos'

export const noiteAberta = (noites: Noite[]): Noite | undefined =>
  noites.find((n) => n.fechadaEm === null)

/** Mais recente primeiro. */
export const ordenarNoites = (noites: Noite[]): Noite[] =>
  [...noites].sort((a, b) => b.data.localeCompare(a.data))

export interface EntradaNoite {
  data: string
  caixaInicial: number
  diaria: number
}

const ehCentavos = (n: number) => Number.isInteger(n) && n >= 0

/** R23: a promoção da noite vai de R$ 3 a R$ 23 por pizza tradicional. */
export const PROMO_MIN = 300
export const PROMO_MAX = 2300

/** Promoção da noite, por pizza tradicional; null = ainda não definida (a leitura sugere). */
export function editarPromocao(noite: Noite, centavos: number | null): Resultado<Noite> {
  if (noite.fechadaEm !== null) return { ok: false, erro: 'Noite fechada. Reabra para editar.' }
  if (centavos !== null && (!ehCentavos(centavos) || centavos < PROMO_MIN || centavos > PROMO_MAX))
    return { ok: false, erro: 'A promoção vai de R$ 3,00 a R$ 23,00 por pizza.' }
  return { ok: true, valor: { ...noite, promoDesconto: centavos } }
}

function validarValores(e: Omit<EntradaNoite, 'data'>): string | null {
  if (!ehCentavos(e.caixaInicial)) return 'Caixa inválido.'
  if (!ehCentavos(e.diaria)) return 'Diária inválida.'
  return null
}

/** Uma noite aberta por vez e uma noite por data. */
export function abrirNoite(entrada: EntradaNoite, noites: Noite[], id: string): Resultado<Noite> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.data)) return { ok: false, erro: 'Informe a data.' }
  const aberta = noiteAberta(noites)
  if (aberta)
    return { ok: false, erro: `A noite de ${formatarData(aberta.data)} ainda está aberta.` }
  if (noites.some((n) => n.data === entrada.data))
    return { ok: false, erro: `Já existe a noite de ${formatarData(entrada.data)}. Reabra ela.` }
  const erro = validarValores(entrada)
  if (erro) return { ok: false, erro }
  return {
    ok: true,
    valor: {
      id,
      data: entrada.data,
      caixaInicial: entrada.caixaInicial,
      diaria: entrada.diaria,
      dinheiroContado: null,
      fechadaEm: null,
      luanPagou: null,
      luanDiferenca: null,
      minutosAcerto: null,
      obs: '',
    },
  }
}

/** R8/R9: caixa e diária editáveis enquanto a noite está aberta. */
export function editarValoresNoite(
  noite: Noite,
  valores: Omit<EntradaNoite, 'data'>,
): Resultado<Noite> {
  if (noite.fechadaEm !== null) return { ok: false, erro: 'Noite fechada. Reabra para editar.' }
  const erro = validarValores(valores)
  if (erro) return { ok: false, erro }
  return { ok: true, valor: { ...noite, ...valores } }
}

/** R6: comanda em rota no fechamento conta como entregue, mas avisa antes. */
export function avisoAoFechar(comandas: Comanda[]): string | null {
  const n = comandas.filter((c) => c.status === 'em_rota').length
  if (n === 0) return null
  return n === 1
    ? '1 comanda ainda em rota. Ela vai contar como entregue.'
    : `${n} comandas ainda em rota. Elas vão contar como entregues.`
}

export const fecharNoite = (noite: Noite, agora: string): Noite => ({ ...noite, fechadaEm: agora })

export function reabrirNoite(noite: Noite, noites: Noite[]): Resultado<Noite> {
  const aberta = noiteAberta(noites)
  if (aberta && aberta.id !== noite.id)
    return { ok: false, erro: `Feche a noite de ${formatarData(aberta.data)} antes.` }
  return { ok: true, valor: { ...noite, fechadaEm: null } }
}
