// Leitura da comanda por foto (docs/SPEC-leitura.md). A IA só transcreve (R19); aqui é feita a
// conta pelo cardápio, a área sugerida e o estado verde, amarelo ou vermelho. Correções do
// motoboy entram em `correcoes` e a conta é refeita do zero.
import { CARDAPIO, normalizar, precoAvulso, precoPizza, type Cardapio, type Faixa, type Tamanho } from './cardapio'
import { comandaRepetida, NOMES_FORMA, NOMES_STATUS, type Resultado } from './comanda'
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
      // Opções com o mesmo preço (ex.: Calabresa e Calabresa Picante) não mudam a conta, desde que
      // também não mudem a promoção (tradicional ou não).
      const contas = new Set(opcoes.map((o) => (o.r ? `${o.r.preco}|${o.r.faixa === 'tradicional'}` : null)))
      if (contas.size === 1 && opcoes[0].r)
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

  if (item.opcoes.length) {
    const tipo = item.tipo
    const opcoes = item.opcoes.map((o) => ({ sabor: o, preco: precoAvulso(c, tipo, o) }))
    const precos = new Set(opcoes.map((o) => o.preco))
    // Mesmo com um palpite em `item`, opções de preços diferentes ficam para o motoboy escolher.
    if (precos.size === 1 && opcoes[0].preco !== null)
      return { item, preco: opcoes[0].preco * qtd, faixa: null, opcoes: [], problema: null }
    return semPreco(item, `"${item.lido}" pode ser mais de um item. Escolha qual.`, opcoes)
  }
  const unitario = item.casou_pelo_cardapio && item.item ? precoAvulso(c, item.tipo, item.item) : null
  if (unitario === null) return semPreco(item, `"${item.lido}" não está no cardápio.`)
  return { item, preco: unitario * qtd, faixa: null, opcoes: [], problema: null }
}

// ---------- Área (R22) ----------

export type OrigemArea = 'escrito' | 'valor' | 'padrao'

const PALAVRAS_VAZIAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e'])
// Nome de área que começa assim só casa inteiro: "Parque das Águas" não é o Parque de Exposições.
const GENERICAS = new Set(['parque', 'jardim', 'vila', 'setor', 'bairro', 'residencial', 'conjunto', 'centro'])
const palavras = (nome: string) => normalizar(nome).split(' ').filter((p) => p && !PALAVRAS_VAZIAS.has(p))

/**
 * Área citada no local escrito, pelo nome ("Pontal", "Barra") ou pelo glossário ("Arag.").
 * Com mais de uma citada, vale a que casa a maior parte do próprio nome ("Parque de Exposições
 * (Barra)" é o Parque; "Arag., perto da Barra" é Aragarças), depois mais palavras, depois a taxa maior.
 */
export function areaDoLocal(local: string | null, areas: Area[], glossario: Record<string, string>): Area | null {
  if (!local) return null
  let texto = ` ${normalizar(local)} `
  for (const [abrev, nome] of Object.entries(glossario)) {
    const curta = normalizar(abrev)
    const ehLugar = areas.some((a) => palavras(a.nome)[0] === palavras(nome)[0])
    if (curta && ehLugar) texto = texto.replaceAll(` ${curta} `, ` ${normalizar(nome)} `)
  }
  let melhor: { area: Area; fracao: number; acertos: number } | null = null
  for (const area of areas) {
    const p = palavras(area.nome)
    if (!p.length || !texto.includes(` ${p[0]} `)) continue
    const acertos = p.filter((x) => texto.includes(` ${x} `)).length
    if (GENERICAS.has(p[0]) && acertos < p.length) continue
    const fracao = acertos / p.length
    const ganha =
      !melhor ||
      fracao > melhor.fracao ||
      (fracao === melhor.fracao &&
        (acertos > melhor.acertos || (acertos === melhor.acertos && area.taxa > melhor.area.taxa)))
    if (ganha) melhor = { area, fracao, acertos }
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
  const padrao =
    ativas.find((a) => normalizar(a.nome) === 'aragarcas') ??
    ativas.find((a) => palavras(a.nome)[0] === 'aragarcas') ??
    ativas[0]
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
  /** Forma tocada em cada pagamento lido, na mesma ordem (o toque do Pix entra aqui). */
  formas?: (Forma | null)[]
  /** Pagamento refeito pelo motoboy: a versão da conferência ou as partes com o valor digitado. */
  pagamento?: { forma: Forma; valor: string | null }[]
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
    // O toque do Pix numa parte não decide as outras: só some com todas as formas escolhidas.
    const pagamentoEscolhido =
      cor.pagamento !== undefined || (l.pagamento.length > 0 && l.pagamento.every((_, i) => cor.formas?.[i] != null))
    if (!pagamentoEscolhido && formasL !== formasC)
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

  // R22: área sugerida; a tocada vale para a conta. Com asterisco e a promoção da noite ainda sem
  // valor, a diferença pode ser promoção ou taxa: sem local escrito, só o toque na área resolve.
  const duasIncognitas = promocao && e.promoDesconto === null && pizzasTradicionais > 0 && cor.areaId === undefined
  const sugestao = sugerirArea(l.local_escrito, total, duasIncognitas ? null : itensMenosDesconto, e.areas, c.glossario)
  const tocada = cor.areaId === undefined ? null : (e.areas.find((a) => a.id === cor.areaId) ?? null)
  const area = tocada ?? sugestao?.area ?? null
  const areaOrigem = !area ? null : tocada && tocada.id !== sugestao?.area.id ? 'manual' : (sugestao?.origem ?? 'manual')
  const esperaToque = duasIncognitas && sugestao?.origem !== 'escrito'
  if (!area) vermelho.push('Nenhuma área ativa.')
  else if (esperaToque) vermelho.push('Asterisco sem local: toque na área para conferir a promoção.')
  else if (!tocada && sugestao?.origem !== 'escrito' && l.local_escrito?.includes('[?]'))
    vermelho.push('Local ilegível: toque na área.')

  // R24: esperado = itens − promoção + taxa.
  const esperado = itensMenosDesconto === null || !area ? null : itensMenosDesconto + area.taxa
  let promocaoSugerida: number | null = null
  if (promocao && e.promoDesconto === null && pizzasTradicionais > 0 && !esperaToque && esperado !== null && total !== null) {
    const diferenca = esperado - total
    const porPizza = diferenca / pizzasTradicionais
    if (Number.isInteger(porPizza) && porPizza >= PROMO_MIN && porPizza <= PROMO_MAX) promocaoSugerida = porPizza
  }
  if (promocaoSugerida !== null) amarelo.push(`Promoção de ${formatarReais(promocaoSugerida)} hoje?`)
  else if (!esperaToque && esperado !== null && total !== null && esperado !== total)
    vermelho.push(`A conta dá ${formatarReais(esperado)}, mas o total lido é ${formatarReais(total)}.`)

  // R29: pagamento.
  let juntas = false
  const pagamentos: PagamentoConferido[] = cor.pagamento
    ? cor.pagamento.map((p) => ({ escrita: NOMES_FORMA[p.forma], forma: p.forma, pedePix: false, valor: valorLido(p.valor) }))
    : l.pagamento.map((p, i) => {
        const escolhida = cor.formas?.[i] ?? null
        const citadas = formasDoTexto(p.forma_escrita)
        // "cart. e din" numa parte só é um misto que não veio dividido.
        if (!escolhida && !p.forma && citadas.length > 1) juntas = true
        const lida: FormaEscrita | null = p.forma ?? (citadas.length === 1 ? citadas[0] : null)
        const forma: Forma | null = escolhida ?? (lida === 'pix' ? null : lida)
        return { escrita: p.forma_escrita, forma, pedePix: !escolhida && lida === 'pix', valor: valorLido(p.valor_escrito) }
      })
  if (juntas) vermelho.push('Mais de uma forma na mesma parte: divida o pagamento.')
  else if (pagamentos.length === 0 || pagamentos.some((p) => !p.forma && !p.pedePix))
    vermelho.push('Forma de pagamento ilegível: escolha a forma.')
  else if (pagamentos.some((p) => p.pedePix)) amarelo.push('Pix: toque em Pix antecipado ou Pix na máquina.')
  if (total !== null && pagamentos.length) {
    const partes = dividir(total, pagamentos)
    if (!partes.ok) vermelho.push(partes.erro)
  }

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

/**
 * R4: valor de cada parte, fechando o total. Uma parte só vale o total (valor maior é o "troco
 * p/ 150"); no misto, uma parte sem valor fica com o resto.
 */
function dividir(total: number, pagamentos: PagamentoConferido[]): Resultado<number[]> {
  if (pagamentos.length === 1) {
    const v = pagamentos[0].valor
    if (v !== null && v < total)
      return { ok: false, erro: `O pagamento escrito (${formatarReais(v)}) é menor que o total: falta a forma do resto.` }
    return { ok: true, valor: [total] }
  }
  const vazias = pagamentos.filter((p) => p.valor === null).length
  if (vazias > 1) return { ok: false, erro: 'Falta o valor das partes: digite quanto foi em cada forma.' }
  const soma = pagamentos.reduce((s, p) => s + (p.valor ?? 0), 0)
  const resto = total - soma
  if (vazias === 1 && resto <= 0)
    return { ok: false, erro: `As partes com valor já somam ${formatarReais(soma)}: não sobra para a outra.` }
  if (vazias === 0 && resto !== 0)
    return { ok: false, erro: `As partes somam ${formatarReais(soma)}, mas o total é ${formatarReais(total)}.` }
  return { ok: true, valor: pagamentos.map((p) => p.valor ?? resto) }
}

/** Pagamentos para lançar; null se falta escolher a forma ou as partes não fecham o total. */
export function pagamentosParaLancar(r: ResultadoLeitura): Pagamento[] | null {
  if (r.total === null || r.pagamentos.length === 0 || r.pagamentos.some((p) => !p.forma)) return null
  const partes = dividir(r.total, r.pagamentos)
  return partes.ok ? r.pagamentos.map((p, i) => ({ forma: p.forma!, valor: partes.valor[i] })) : null
}
