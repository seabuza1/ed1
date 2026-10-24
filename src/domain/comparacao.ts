// Comparar modelos (docs/SPEC-leitura.md, "Comparar modelos"): a leitura conferida contra o gabarito
// da noite de teste e o custo de cada chamada. Usado por scripts/comparar-modelos.ts.
import { normalizar } from './cardapio'
import { lerReais } from './dinheiro'
import type { ResultadoLeitura } from './leitura'
import type { Area } from './tipos'

/** Uma linha do gabarito.csv: o que foi lançado e conferido. Forma: dinheiro, cartao ou pix; misto: cartao+dinheiro. */
export interface Gabarito {
  codigo: string
  total: string
  area: string
  forma: string
}

/** Formas sem repetir e em ordem ("cartao+dinheiro"); Pix na máquina e antecipado contam como pix. */
export const juntarFormas = (fs: string[]) => [...new Set(fs.map((f) => (f.startsWith('pix') ? 'pix' : f)))].sort().join('+')

/** As formas que a leitura conferida dá; forma ilegível vira "?". */
export const formasLidas = (r: ResultadoLeitura) => juntarFormas(r.pagamentos.map((p) => (p.pedePix ? 'pix' : (p.forma ?? '?'))))

/** A área sugerida pelo nome (vazio sem sugestão). */
export const areaSugerida = (r: ResultadoLeitura, areas: Area[]) => areas.find((a) => a.id === r.sugestao?.areaId)?.nome ?? ''

/** Código, total, área sugerida e formas iguais ao gabarito. */
export function acertou(r: ResultadoLeitura, areas: Area[], g: Gabarito): boolean {
  return (
    r.codigo === g.codigo &&
    r.total === lerReais(g.total) &&
    normalizar(areaSugerida(r, areas)) === normalizar(g.area) &&
    formasLidas(r) === juntarFormas(g.forma.split('+'))
  )
}

/**
 * US$ por milhão de tokens. escritaCache: a entrada gravada no cache, quando o provedor cobra mais
 * por ela (na Anthropic, 1,25 × a entrada).
 */
export interface Preco {
  entrada: number
  cache: number
  saida: number
  escritaCache?: number
}

export interface TokensChamada {
  /** Entrada cobrada inteira, com a gravada no cache. */
  entrada: number
  cache: number
  saida: number
  /** Parte da entrada que foi gravada no cache. */
  escritaCache?: number
}

export function custoUsd(t: TokensChamada, p: Preco): number {
  const escrita = p.escritaCache === undefined ? 0 : (t.escritaCache ?? 0)
  return ((t.entrada - escrita) * p.entrada + escrita * (p.escritaCache ?? 0) + t.cache * p.cache + t.saida * p.saida) / 1e6
}

export interface ContaModelo {
  verdesCertas: number
  verdesErradas: number
  amarelas: number
  vermelhas: number
  erros: number
  lidas: number
  ms: number
  custo: number
}

export const contaVazia = (): ContaModelo => ({
  verdesCertas: 0,
  verdesErradas: 0,
  amarelas: 0,
  vermelhas: 0,
  erros: 0,
  lidas: 0,
  ms: 0,
  custo: 0,
})

/** Soma uma foto lida na conta do modelo. A meta é zero verdes erradas. */
export function somarLida(c: ContaModelo, estado: ResultadoLeitura['estado'], certo: boolean, ms: number, custo: number): ContaModelo {
  return {
    ...c,
    verdesCertas: c.verdesCertas + (estado === 'verde' && certo ? 1 : 0),
    verdesErradas: c.verdesErradas + (estado === 'verde' && !certo ? 1 : 0),
    amarelas: c.amarelas + (estado === 'amarelo' ? 1 : 0),
    vermelhas: c.vermelhas + (estado === 'vermelho' ? 1 : 0),
    lidas: c.lidas + 1,
    ms: c.ms + ms,
    custo: c.custo + custo,
  }
}
