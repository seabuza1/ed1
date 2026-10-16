// Cardápio da Mel Pizzaria (supabase/functions/_shared/cardapio-mel.json): fonte única para a
// Edge Function, que manda para a IA, e para a conta da leitura aqui no app.
// No JSON os preços estão em reais; aqui saem em centavos.
import cardapioJson from '../../supabase/functions/_shared/cardapio-mel.json'

export type Tamanho = 'B' | 'P' | 'M' | 'G'
export type Faixa = 'tradicional' | 'especial' | 'premium' | 'doce' | 'doce_especial'

export interface Cardapio {
  glossario: Record<string, string>
  pizzas: {
    tamanhos: Record<Tamanho, string>
    faixas: Record<Faixa, Record<Tamanho, number>>
    sabores: { nome: string; faixa: Faixa; apelidos?: string[]; ingredientes: string }[]
  }
  bordas: { nome: string; preco: number }[]
  adicionais: { preco_cada: number; itens: string[]; outros: { nome: string; preco: number }[] }
  combos: { id: string; itens: string[]; preco: number }[]
  bebidas: { grupo: string; nome: string; apelidos?: string[]; preco: number }[]
  outros: { nome: string; preco: number }[]
  ambiguidades: { escrito: string; opcoes: string[]; muda_preco: boolean }[]
}

export const CARDAPIO = cardapioJson as Cardapio

/** Para comparar nomes: sem acento, sem maiúscula, sem pontuação e espaços repetidos. */
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const reais = (valor: number) => Math.round(valor * 100)

const mesmoNome = (escrito: string, nome: string, apelidos: string[] = []) =>
  [nome, ...apelidos].some((n) => normalizar(n) === normalizar(escrito))

export const acharSabor = (c: Cardapio, nome: string) => c.pizzas.sabores.find((s) => mesmoNome(nome, s.nome, s.apelidos))

/** R21: preço da pizza no tamanho e a faixa cobrada (a do sabor mais caro). */
export function precoPizza(
  c: Cardapio,
  sabores: string[],
  tamanho: Tamanho,
): { preco: number; faixa: Faixa } | null {
  let melhor: { preco: number; faixa: Faixa } | null = null
  for (const nome of sabores) {
    const sabor = acharSabor(c, nome)
    if (!sabor) return null
    const preco = reais(c.pizzas.faixas[sabor.faixa][tamanho])
    // No empate fica a faixa do primeiro sabor (a ordem em que a comanda escreve).
    if (!melhor || preco > melhor.preco) melhor = { preco, faixa: sabor.faixa }
  }
  return melhor
}

/** Preço unitário de bebida, borda, adicional, combo ou outro; null se não está no cardápio. */
export function precoAvulso(
  c: Cardapio,
  tipo: 'bebida' | 'borda' | 'adicional' | 'combo' | 'outro',
  item: string,
): number | null {
  if (tipo === 'bebida') {
    const b = c.bebidas.find((x) => mesmoNome(item, x.nome, x.apelidos))
    return b ? reais(b.preco) : null
  }
  if (tipo === 'borda') {
    const b = c.bordas.find((x) => mesmoNome(item, x.nome))
    return b ? reais(b.preco) : null
  }
  if (tipo === 'adicional') {
    if (c.adicionais.itens.some((x) => mesmoNome(item, x))) return reais(c.adicionais.preco_cada)
    const o = c.adicionais.outros.find((x) => mesmoNome(item, x.nome))
    return o ? reais(o.preco) : null
  }
  if (tipo === 'combo') {
    // "01", "1" ou "Combo 01"
    const numero = item.replace(/\D/g, '').padStart(2, '0')
    const combo = c.combos.find((x) => x.id === numero)
    return combo ? reais(combo.preco) : null
  }
  const o = c.outros.find((x) => mesmoNome(item, x.nome))
  return o ? reais(o.preco) : null
}
