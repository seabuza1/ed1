// Leitura da comanda por foto (docs/SPEC-leitura.md). A IA só transcreve (R19); aqui é feita a
// conta pelo cardápio, a área sugerida e o estado verde, amarelo ou vermelho. Correções do
// motoboy entram em `correcoes` e a conta é refeita do zero.
import { CARDAPIO, normalizar, precoAvulso, precoPizza, type Cardapio, type Faixa, type Tamanho } from './cardapio'
import { comandaRepetida, montarPagamentos, NOMES_STATUS } from './comanda'
import { formatarReais, lerReais } from './dinheiro'
import type { Area, Comanda, Forma, Pagamento } from './tipos'

// ---------- O que a IA devolve (tool use, mesmo formato do input_schema) ----------

export type TipoItem = 'pizza' | 'bebida' | 'borda' | 'adicional' | 'combo' | 'outro'

export interface ItemLido {
  lido: string
  tipo: TipoItem
  quantidade: number
  tamanho: Tamanho | null
  sabores: string[]
  item: string | null
  casou_pelo_cardapio: boolean
  opcoes: string[]
}

export interface PagamentoLido {
  forma_escrita: string
  forma: 'dinheiro' | 'cartao' | 'pix' | null
  valor_escrito: string | null
}

export interface LeituraCompleta {
  telefone_final: string | null
  promocao: boolean
  local_escrito: string | null
  itens: ItemLido[]
  pagamento: PagamentoLido[]
  total_escrito: string | null
  transcricao: string[]
  ilegiveis: string[]
}

/** Segunda leitura, só dos campos críticos (R25). */
export interface LeituraConferencia {
  telefone_digitos: string[]
  total_digitos: string[]
  forma_escrita: string | null
  local_escrito: string | null
  promocao: boolean
}

// ---------- Conversões ----------

/** L12: valor como escrito → centavos ("113", "113,00", "R$ 113,50", "1.130,00"); null se não dá. */
export const valorLido = (texto: string | null | undefined): number | null =>
  texto === null || texto === undefined ? null : lerReais(texto)

type FormaEscrita = 'dinheiro' | 'cartao' | 'pix'

/** Formas citadas num texto ("Cartão", "pix e dinheiro"). */
function formasDoTexto(texto: string | null): FormaEscrita[] {
  const t = ` ${normalizar(texto ?? '')} `
  const formas: FormaEscrita[] = []
  if (/ pix /.test(t)) formas.push('pix')
  if (/ cart/.test(t)) formas.push('cartao')
  if (/ din/.test(t)) formas.push('dinheiro')
  return formas
}

// ---------- Itens (R20, R21) ----------

export interface ItemConferido {
  item: ItemLido
  /** Preço do item (já vezes a quantidade), em centavos; null = sem preço. */
  preco: number | null
  /** Pizza: faixa cobrada, a do sabor mais caro. */
  faixa: Faixa | null
  /** Palavra ambígua (R20): cada opção com o preço que daria. */
  opcoes: { sabor: string; preco: number | null }[]
  problema: string | null
}

const semPreco = (item: ItemLido, problema: string, opcoes: ItemConferido['opcoes'] = []): ItemConferido => ({
  item,
  preco: null,
  faixa: null,
  opcoes,
  problema,
})

function conferirItem(c: Cardapio, lido: ItemLido, escolha: string | undefined): ItemConferido {
  const qtd = Number.isInteger(lido.quantidade) && lido.quantidade > 0 ? lido.quantidade : 1
  // O motoboy escolheu entre as opções: vira um item casado.
  const item: ItemLido =
    escolha === undefined
      ? lido
      : lido.tipo === 'pizza'
        ? { ...lido, sabores: [...lido.sabores, escolha], opcoes: [], casou_pelo_cardapio: true }
        : { ...lido, item: escolha, opcoes: [], casou_pelo_cardapio: true }

  if (item.tipo === 'pizza') {
    if (!item.tamanho) return semPreco(item, 'Tamanho da pizza não lido.')
    const tamanho = item.tamanho
    if (item.opcoes.length) {
      const opcoes = item.opcoes.map((sabor) => ({ sabor, r: precoPizza(c, [...item.sabores, sabor], tamanho) }))
      const precos = new Set(opcoes.map((o) => o.r?.preco ?? null))
      // Opções com o mesmo preço (ex.: Calabresa e Calabresa Picante) não mudam a conta.
      if (precos.size === 1 && opcoes[0].r)
        return { item, preco: opcoes[0].r.preco * qtd, faixa: opcoes[0].r.faixa, opcoes: [], problema: null }
      return semPreco(
        item,
        `"${item.lido}" pode ser mais de um sabor. Escolha qual.`,
        opcoes.map((o) => ({ sabor: o.sabor, preco: o.r ? o.r.preco * qtd : null })),
      )
    }
    const r = item.casou_pelo_cardapio && item.sabores.length ? precoPizza(c, item.sabores, tamanho) : null
    if (!r) return semPreco(item, `"${item.lido}" não está no cardápio.`)
    return { item, preco: r.preco * qtd, faixa: r.faixa, opcoes: [], problema: null }
  }

  if (item.opcoes.length && !item.item)
    return semPreco(
      item,
      `"${item.lido}" pode ser mais de um item. Escolha qual.`,
      item.opcoes.map((o) => ({ sabor: o, preco: precoAvulso(c, item.tipo as Exclude<TipoItem, 'pizza'>, o) })),
    )
  const unitario = item.casou_pelo_cardapio && item.item ? precoAvulso(c, item.tipo, item.item) : null
  if (unitario === null) return semPreco(item, `"${item.lido}" não está no cardápio.`)
  return { item, preco: unitario * qtd, faixa: null, opcoes: [], problema: null }
}

// ---------- Área (R22) ----------

export type OrigemArea = 'escrito' | 'valor' | 'padrao'

const PALAVRAS_VAZIAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e'])
const palavras = (nome: string) => normalizar(nome).split(' ').filter((p) => p && !PALAVRAS_VAZIAS.has(p))

/**
 * Área citada no local escrito, pelo nome ("Pontal", "Barra") ou pelo glossário ("Arag.").
 * Com mais de uma citada, vale a que casa mais palavras e, no empate, a de taxa maior
 * ("Parque de Exposições (Barra)" é o Parque).
 */
export function areaDoLocal(local: string | null, areas: Area[], glossario: Record<string, string>): Area | null {
  if (!local) return null
  let texto = ` ${normalizar(local)} `
  for (const [abrev, nome] of Object.entries(glossario)) {
    const curta = normalizar(abrev)
    const ehLugar = areas.some((a) => palavras(a.nome)[0] === palavras(nome)[0])
    if (curta && ehLugar) texto = texto.replaceAll(` ${curta} `, ` ${normalizar(nome)} `)
  }
  let melhor: { area: Area; acertos: number } | null = null
  for (const area of areas) {
    const p = palavras(area.nome)
    if (!p.length || !texto.includes(` ${p[0]} `)) continue
    const acertos = p.filter((x) => texto.includes(` ${x} `)).length
    if (!melhor || acertos > melhor.acertos || (acertos === melhor.acertos && area.taxa > melhor.area.taxa))
      melhor = { area, acertos }
  }
  return melhor?.area ?? null
}

/** R22: escrito → pelo valor (a diferença é a taxa de exatamente uma área) → Aragarças. */
export function sugerirArea(
  local: string | null,
  total: number | null,
  itensMenosDesconto: number | null,
  areas: Area[],
  glossario: Record<string, string>,
): { area: Area; origem: OrigemArea } | null {
  const ativas = areas.filter((a) => a.ativa)
  const escrita = areaDoLocal(local, ativas, glossario)
  if (escrita) return { area: escrita, origem: 'escrito' }
  if (total !== null && itensMenosDesconto !== null) {
    const pelaTaxa = ativas.filter((a) => a.taxa === total - itensMenosDesconto)
    if (pelaTaxa.length === 1) return { area: pelaTaxa[0], origem: 'valor' }
  }
  const padrao = ativas.find((a) => palavras(a.nome)[0] === 'aragarcas') ?? ativas[0]
  return padrao ? { area: padrao, origem: 'padrao' } : null
}

// ---------- Conferência (R23 a R29) ----------

export type Estado = 'verde' | 'amarelo' | 'vermelho'
export type CampoCritico = 'telefone' | 'total' | 'pagamento' | 'local' | 'promocao'

/** R25: as duas leituras discordam num campo crítico; a tela mostra as duas. */
export interface Divergencia {
  campo: CampoCritico
  completa: string
  conferencia: string
}

export interface PagamentoConferido {
  escrita: string
  /** null: ilegível, ou Pix esperando o toque (R29). */
  forma: Forma | null
  /** "Pix": pede um toque entre Pix antecipado e Pix na máquina. */
  pedePix: boolean
  valor: number | null
}

/** O que o motoboy corrigiu ou escolheu na tela de confirmação. */
export interface Correcoes {
  codigo?: string
  total?: string
  /** Área tocada. */
  areaId?: string
  promocao?: boolean
  /** Por pagamento lido, na mesma ordem. */
  formas?: (Forma | null)[]
  /** Índice do item → sabor (ou item) escolhido entre as opções. */
  escolhas?: Record<number, string>
}

export interface EntradaConferencia {
  leitura: LeituraCompleta
  conferencia: LeituraConferencia | null
  areas: Area[]
  /** caixas.promo_desconto: centavos por pizza tradicional; null = ainda não definida na noite. */
  promoDesconto: number | null
  correcoes?: Correcoes
  /** Para o aviso de código repetido (R1). */
  comandasDaNoite?: Comanda[]
  cardapio?: Cardapio
}

export interface ResultadoLeitura {
  estado: Estado
  /** Por que não ficou verde: os do vermelho primeiro. */
  motivos: string[]
  codigo: string | null
  totalTexto: string | null
  total: number | null
  itens: ItemConferido[]
  somaItens: number | null
  promocao: boolean
  /** Pizzas cobradas como tradicional (o desconto vale uma vez por pizza). */
  pizzasTradicionais: number
  desconto: number
  /** R23: "Promoção de R$ X hoje?" (centavos por pizza), quando a noite ainda não tem valor. */
  promocaoSugerida: number | null
  sugestao: { areaId: string; origem: OrigemArea } | null
  areaId: string | null
  /** De onde veio a área usada: a sugestão ou "manual" se o motoboy tocou outra. */
  areaOrigem: OrigemArea | 'manual' | null
  taxa: number | null
  esperado: number | null
  pagamentos: PagamentoConferido[]
  divergencias: Divergencia[]
  alertas: string[]
  /** Posições do total que se confundem (3/8, 1/7, 5/6, 0/6), quando a área veio pelo valor. */
  digitosConfusos: number[]
}

const DIGITOS_CONFUSOS = new Set(['3', '8', '1', '7', '5', '6', '0'])
const PROMO_MIN = 300 // R23: a promoção vai de R$ 3 a R$ 23
const PROMO_MAX = 2300
const TOTAL_MIN = 2000 // R26: alertas de valor
const TOTAL_MAX = 30000

export function conferirLeitura(e: EntradaConferencia): ResultadoLeitura {
  const c = e.cardapio ?? CARDAPIO
  const l = e.leitura
  const cf = e.conferencia
  const cor = e.correcoes ?? {}
  const vermelho: string[] = []
  const amarelo: string[] = []

  // Campos críticos: o corrigido vale; senão a leitura completa.
  const codigo = cor.codigo ?? l.telefone_final
  const totalTexto = cor.total ?? l.total_escrito
  const total = valorLido(totalTexto)
  const promocao = cor.promocao ?? l.promocao

  // R25: dupla leitura. Campo corrigido pelo motoboy não diverge mais.
  const divergencias: Divergencia[] = []
  if (cf) {
    const telConf = cf.telefone_digitos.join('')
    if (cor.codigo === undefined && (l.telefone_final ?? '') !== telConf)
      divergencias.push({ campo: 'telefone', completa: l.telefone_final ?? '', conferencia: telConf })
    const totalConf = cf.total_digitos.join('')
    if (cor.total === undefined && valorLido(l.total_escrito) !== valorLido(totalConf))
      divergencias.push({ campo: 'total', completa: l.total_escrito ?? '', conferencia: totalConf })
    const formasL = formasDoTexto(l.pagamento.map((p) => p.forma_escrita).join(' ')).sort().join('+')
    const formasC = formasDoTexto(cf.forma_escrita).sort().join('+')
    if (cor.formas === undefined && formasL !== formasC)
      divergencias.push({
        campo: 'pagamento',
        completa: l.pagamento.map((p) => p.forma_escrita).join(' + '),
        conferencia: cf.forma_escrita ?? '',
      })
    const ativas = e.areas.filter((a) => a.ativa)
    const localL = areaDoLocal(l.local_escrito, ativas, c.glossario)
    const localC = areaDoLocal(cf.local_escrito, ativas, c.glossario)
    if (cor.areaId === undefined && localL?.id !== localC?.id)
      divergencias.push({ campo: 'local', completa: l.local_escrito ?? '', conferencia: cf.local_escrito ?? '' })
    if (cor.promocao === undefined && l.promocao !== cf.promocao)
      divergencias.push({
        campo: 'promocao',
        completa: l.promocao ? 'com asterisco' : 'sem asterisco',
        conferencia: cf.promocao ? 'com asterisco' : 'sem asterisco',
      })
  } else amarelo.push('Só uma leitura chegou: confira o código e o total.')
  for (const d of divergencias) vermelho.push(`As duas leituras discordam no ${NOME_CAMPO[d.campo]}: escolha uma.`)

  if (!codigo || !/^\d{4}$/.test(codigo)) vermelho.push('Telefone ilegível: digite os 4 dígitos.')
  if (total === null) vermelho.push('Total ilegível: digite o total.')

  // R20, R21: itens pelo cardápio.
  const itens = l.itens.map((item, i) => conferirItem(c, item, cor.escolhas?.[i]))
  for (const it of itens) if (it.problema) vermelho.push(it.problema)
  if (itens.length === 0) vermelho.push('Nenhum item lido.')
  const somaItens = itens.length && itens.every((it) => it.preco !== null) ? itens.reduce((s, it) => s + it.preco!, 0) : null

  // R23: promoção da noite, uma vez por pizza cobrada como tradicional.
  const pizzasTradicionais = itens
    .filter((it) => it.faixa === 'tradicional')
    .reduce((s, it) => s + (it.item.quantidade > 0 ? it.item.quantidade : 1), 0)
  const desconto = promocao && e.promoDesconto !== null ? e.promoDesconto * pizzasTradicionais : 0
  const itensMenosDesconto = somaItens === null ? null : somaItens - desconto

  // R22: área sugerida; a tocada vale para a conta.
  const sugestao = sugerirArea(l.local_escrito, total, itensMenosDesconto, e.areas, c.glossario)
  const tocada = cor.areaId === undefined ? null : (e.areas.find((a) => a.id === cor.areaId) ?? null)
  const area = tocada ?? sugestao?.area ?? null
  const areaOrigem = !area ? null : tocada && tocada.id !== sugestao?.area.id ? 'manual' : (sugestao?.origem ?? 'manual')
  if (!area) vermelho.push('Nenhuma área ativa.')

  // R24: esperado = itens − promoção + taxa.
  const esperado = itensMenosDesconto === null || !area ? null : itensMenosDesconto + area.taxa
  let promocaoSugerida: number | null = null
  if (promocao && e.promoDesconto === null && pizzasTradicionais > 0 && esperado !== null && total !== null) {
    const diferenca = esperado - total
    const porPizza = diferenca / pizzasTradicionais
    if (Number.isInteger(porPizza) && porPizza >= PROMO_MIN && porPizza <= PROMO_MAX) promocaoSugerida = porPizza
  }
  if (promocaoSugerida !== null) amarelo.push(`Promoção de ${formatarReais(promocaoSugerida)} hoje?`)
  else if (esperado !== null && total !== null && esperado !== total)
    vermelho.push(`A conta dá ${formatarReais(esperado)}, mas o total lido é ${formatarReais(total)}.`)

  // R29: pagamento.
  const pagamentos: PagamentoConferido[] = l.pagamento.map((p, i) => {
    const escolhida = cor.formas?.[i]
    const lida: FormaEscrita | null = p.forma ?? formasDoTexto(p.forma_escrita)[0] ?? null
    const forma: Forma | null = escolhida ?? (lida === 'pix' ? null : lida)
    return { escrita: p.forma_escrita, forma, pedePix: !escolhida && lida === 'pix', valor: valorLido(p.valor_escrito) }
  })
  if (pagamentos.length === 0 || pagamentos.some((p) => !p.forma && !p.pedePix))
    vermelho.push('Forma de pagamento ilegível: escolha a forma.')
  else if (pagamentos.some((p) => p.pedePix)) amarelo.push('Pix: toque em Pix antecipado ou Pix na máquina.')

  // R26: alertas.
  const alertas: string[] = []
  if (total !== null && total < TOTAL_MIN) alertas.push(`Total abaixo de ${formatarReais(TOTAL_MIN)}.`)
  if (total !== null && total > TOTAL_MAX) alertas.push(`Total acima de ${formatarReais(TOTAL_MAX)}.`)
  const temCombo = itens.some((it) => it.item.tipo === 'combo' && it.preco !== null)
  if (total !== null && total % 100 === 99 && !temCombo) alertas.push('Total termina em ,99 sem combo.')
  const repetida = codigo && e.comandasDaNoite ? comandaRepetida(codigo, e.comandasDaNoite) : undefined
  if (repetida) alertas.push(`Já tem a ${repetida.codigo} nesta noite (${NOMES_STATUS[repetida.status].toLowerCase()}).`)
  amarelo.push(...alertas)
  if (l.ilegiveis.length) amarelo.push(`Trecho ilegível: ${l.ilegiveis.join(', ')}.`)

  const usaValor = sugestao?.origem === 'valor' && areaOrigem === 'valor'
  return {
    estado: vermelho.length ? 'vermelho' : amarelo.length ? 'amarelo' : 'verde',
    motivos: [...vermelho, ...amarelo],
    codigo,
    totalTexto,
    total,
    itens,
    somaItens,
    promocao,
    pizzasTradicionais,
    desconto,
    promocaoSugerida,
    sugestao: sugestao && { areaId: sugestao.area.id, origem: sugestao.origem },
    areaId: area?.id ?? null,
    areaOrigem,
    taxa: area?.taxa ?? null,
    esperado,
    pagamentos,
    divergencias,
    alertas,
    digitosConfusos: usaValor
      ? [...(totalTexto ?? '')].flatMap((ch, i) => (DIGITOS_CONFUSOS.has(ch) ? [i] : []))
      : [],
  }
}

const NOME_CAMPO: Record<CampoCritico, string> = {
  telefone: 'telefone',
  total: 'total',
  pagamento: 'pagamento',
  local: 'local',
  promocao: 'asterisco',
}

/** Pagamentos para lançar: uma linha sem valor fica com o resto (R4); null se falta escolher a forma. */
export function pagamentosParaLancar(r: ResultadoLeitura): Pagamento[] | null {
  if (r.total === null || r.pagamentos.length === 0 || r.pagamentos.some((p) => !p.forma)) return null
  const linhas = r.pagamentos.map((p) => ({ forma: p.forma!, valor: r.pagamentos.length === 1 ? null : p.valor }))
  const m = montarPagamentos(r.total, linhas)
  return m.ok ? m.valor : null
}
