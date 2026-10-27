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
  /** Refrigerante não tem preço por marca: marca + tamanho ("coca 2lts") cai no item do tamanho. */
  refrigerante: { marcas: string[]; tamanhos: Record<string, string[]> }
  /** Bairros escritos no lugar da cidade, pelo nome da área ("N. Horizonte" é a Barra). */
  bairros: Record<string, string[]>
  outros: { nome: string; preco: number }[]
  ambiguidades: { escrito: string; apelidos?: string[]; opcoes: string[]; muda_preco: boolean }[]
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

const LIGACOES = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'c', 'e', 'ao'])

/**
 * Para achar um nome do cardápio: além do `normalizar`, sem espaços, sem as palavras de ligação
 * ("brócolis c/ bacon" = "brocolis bacon") e com o tamanho numa grafia só ("2 lts" = "2L", "350 ml" = "350").
 */
export const chaveNome = (s: string) =>
  normalizar(s)
    .replace(/(\d) ?(?:litros?|lts?|ls|l)\b/g, '$1l')
    .replace(/(\d) ?ml\b/g, '$1')
    .split(' ')
    .filter((p) => !LIGACOES.has(p))
    .join('')

const mesmoNome = (escrito: string, nome: string, apelidos: string[] = []) => {
  const k = chaveNome(escrito)
  return [nome, ...apelidos].some((n) => chaveNome(n) === k)
}

export const acharSabor = (c: Cardapio, nome: string) => c.pizzas.sabores.find((s) => mesmoNome(nome, s.nome, s.apelidos))

/** Palavra que cabe em mais de um sabor ou item ("frango", "strogonoff", "heineken"). */
export const acharAmbiguidade = (c: Cardapio, escrito: string) =>
  c.ambiguidades.find((a) => mesmoNome(escrito, a.escrito, a.apelidos))

/** Bebida pelo nome ou apelido; refrigerante pela marca e o tamanho ("coca 2lts", "guaraná lata"). */
export function acharBebida(c: Cardapio, escrito: string) {
  const pelaLista = c.bebidas.find((b) => mesmoNome(escrito, b.nome, b.apelidos))
  if (pelaLista) return pelaLista
  const k = chaveNome(escrito)
  const marca = c.refrigerante.marcas
    .map(chaveNome)
    .sort((a, b) => b.length - a.length)
    .find((m) => k.startsWith(m) || k.endsWith(m))
  const tamanho = !marca ? k : k.startsWith(marca) ? k.slice(marca.length) : k.slice(0, -marca.length)
  const nome = Object.entries(c.refrigerante.tamanhos).find(([, grafias]) => grafias.some((g) => chaveNome(g) === tamanho))?.[0]
  return nome ? c.bebidas.find((b) => b.nome === nome) : undefined
}

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
    // No empate de preço com outra faixa, a cobrada não é a tradicional (a promoção é só da pizza
    // tradicional), seja qual for a ordem em que a comanda escreve os sabores.
    const troca =
      !melhor || preco > melhor.preco || (preco === melhor.preco && melhor.faixa === 'tradicional')
    if (troca) melhor = { preco, faixa: sabor.faixa }
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
    const b = acharBebida(c, item)
    return b ? reais(b.preco) : null
  }
  if (tipo === 'borda') {
    // "Borda de cheddar" ou só "cheddar".
    const b = c.bordas.find((x) => mesmoNome(item, x.nome) || mesmoNome(item, `borda ${x.nome}`))
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
