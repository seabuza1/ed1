import { describe, expect, it } from 'vitest'
import exemplo3557 from '../../supabase/functions/_shared/exemplos/3557.json'
import { CARDAPIO, normalizar, precoAvulso } from './cardapio'
import {
  avisoLeitura,
  comandaDaLeitura,
  conferirLeitura,
  houveCorrecao,
  pagamentosParaLancar,
  registroLeitura,
  valorLido,
  type Correcoes,
  type ItemLido,
  type LeituraCompleta,
  type LeituraConferencia,
} from './leitura'
import type { Area } from './tipos'
import { r$ } from '../teste/r$'

const R = (reais: number) => Math.round(reais * 100)

// Áreas do 001_schema.sql.
const AREAS: Area[] = [
  { id: 'aragarcas', nome: 'Aragarças', taxa: R(5), ativa: true },
  { id: 'pontal', nome: 'Pontal do Araguaia', taxa: R(10), ativa: true },
  { id: 'barra', nome: 'Barra do Garças', taxa: R(12), ativa: true },
  { id: 'parque', nome: 'Parque de Exposições', taxa: R(15), ativa: true },
]

const BASE = exemplo3557 as unknown as { leitura: LeituraCompleta; conferencia: LeituraConferencia }

/** Dígitos como a leitura de conferência devolve ("113,00" → ["1","1","3",",","0","0"]). */
const digitos = (s: string | null) => [...(s ?? '')]

/** A 3557 real, com o que o teste mudar; as duas leituras concordam, salvo quando o teste diz. */
function comanda(
  mudar: Partial<LeituraCompleta> = {},
  conferencia: Partial<LeituraConferencia> = {},
): { leitura: LeituraCompleta; conferencia: LeituraConferencia } {
  const leitura = { ...structuredClone(BASE.leitura), ...mudar }
  return {
    leitura,
    conferencia: {
      telefone_digitos: digitos(leitura.telefone_final),
      total_digitos: digitos(leitura.total_escrito),
      forma_escrita: leitura.pagamento.map((p) => p.forma_escrita).join(' + ') || null,
      local_escrito: leitura.local_escrito,
      promocao: leitura.promocao,
      ...conferencia,
    },
  }
}

const pizza = (tamanho: ItemLido['tamanho'], sabores: string[], lido = sabores.join('-'), opcoes: string[] = []): ItemLido => ({
  lido,
  tipo: 'pizza',
  quantidade: 1,
  tamanho,
  sabores,
  item: null,
  casou_pelo_cardapio: true,
  opcoes,
})

const avulso = (tipo: ItemLido['tipo'], item: string): ItemLido => ({
  lido: item,
  tipo,
  quantidade: 1,
  tamanho: null,
  sabores: [],
  item,
  casou_pelo_cardapio: true,
  opcoes: [],
})

function conferir(
  c: { leitura: LeituraCompleta; conferencia: LeituraConferencia },
  promoDesconto: number | null = null,
  correcoes?: Correcoes,
) {
  return conferirLeitura({ ...c, areas: AREAS, promoDesconto, correcoes })
}

describe('leitura da comanda: L1 a L14', () => {
  it('L1 a 3557 como lida: Aragarças pelo escrito, 113, verde', () => {
    const r = conferir(comanda())
    expect(r.sugestao).toEqual({ areaId: 'aragarcas', origem: 'escrito' })
    expect([r.somaItens, r.esperado, r.total]).toEqual([R(108), R(113), R(113)])
    expect(r.itens.map((i) => [i.preco, i.faixa])).toEqual([
      [R(93), 'premium'],
      [R(15), null],
    ])
    expect(r.estado).toBe('verde')
    expect(r.motivos).toEqual([])
    expect(pagamentosParaLancar(r)).toEqual([{ forma: 'cartao', valor: R(113) }])
  })

  it('L2 sem local: Aragarças pelo valor, verde', () => {
    const r = conferir(comanda({ local_escrito: null }))
    expect(r.sugestao).toEqual({ areaId: 'aragarcas', origem: 'valor' })
    expect(r.estado).toBe('verde')
  })

  it('L3 sem local e 118: Pontal pelo valor fecha; tocando Aragarças fica vermelho', () => {
    const lida = comanda({ local_escrito: null, total_escrito: '118,00' })
    const r = conferir(lida)
    expect(r.sugestao).toEqual({ areaId: 'pontal', origem: 'valor' })
    expect([r.esperado, r.estado]).toEqual([R(118), 'verde'])
    // Os dígitos do total que se confundem ficam sublinhados: 1, 1, 8, 0, 0.
    expect(r.digitosConfusos).toEqual([0, 1, 2, 4, 5])

    const tocou = conferir(lida, null, { areaId: 'aragarcas' })
    expect([tocou.esperado, tocou.areaOrigem, tocou.estado]).toEqual([R(113), 'manual', 'vermelho'])
    expect(tocou.motivos).toContain(r$('A conta dá R$ 113,00, mas o total lido é R$ 118,00.'))
  })

  it('L4 o motoboy toca Barra: 120 ≠ 113, vermelho', () => {
    const r = conferir(comanda(), null, { areaId: 'barra' })
    expect([r.esperado, r.areaOrigem, r.estado]).toEqual([R(120), 'manual', 'vermelho'])
  })

  it('L5 sem local e 110: nenhuma área pela diferença, Aragarças padrão, vermelho', () => {
    const r = conferir(comanda({ local_escrito: null, total_escrito: '110' }))
    expect(r.sugestao).toEqual({ areaId: 'aragarcas', origem: 'padrao' })
    expect([r.esperado, r.total, r.estado]).toEqual([R(113), R(110), 'vermelho'])
  })

  it('L6 sem local e 123: Parque de Exposições pelo valor, verde', () => {
    const r = conferir(comanda({ local_escrito: null, total_escrito: '123' }))
    expect(r.sugestao).toEqual({ areaId: 'parque', origem: 'valor' })
    expect(r.estado).toBe('verde')
  })

  it('L7 promoção ainda sem valor: amarelo "Promoção de R$ 10 hoje?"; confirmando, verde', () => {
    const lida = comanda({
      itens: [pizza('G', ['Calabresa']), avulso('bebida', 'Refrigerante 2L')],
      local_escrito: 'Arag.',
      total_escrito: '83',
    })
    const r = conferir(lida)
    expect([r.esperado, r.promocaoSugerida, r.estado]).toEqual([R(93), 1000, 'amarelo'])
    expect(r.motivos).toEqual([r$('Promoção de R$ 10,00 hoje?')])

    const confirmada = conferir(lida, 1000)
    expect([confirmada.desconto, confirmada.esperado, confirmada.estado]).toEqual([1000, R(83), 'verde'])
  })

  it('L8 promoção de 10 definida: G Portuguesa 73 − 10 + 5 = 68, verde', () => {
    const r = conferir(comanda({ itens: [pizza('G', ['Portuguesa'])], local_escrito: 'Arag.', total_escrito: '68' }), 1000)
    expect([r.esperado, r.estado]).toEqual([R(68), 'verde'])
  })

  it('L9 promoção definida e a 3557: faixa cobrada premium, sem desconto, verde', () => {
    const r = conferir(comanda(), 1000)
    expect([r.pizzasTradicionais, r.desconto, r.esperado, r.estado]).toEqual([0, 0, R(113), 'verde'])
  })

  it('L10 "G frango": quatro sabores com preços diferentes, item sem preço, vermelho', () => {
    const frango = CARDAPIO.ambiguidades.find((a) => a.escrito === 'frango')!
    const r = conferir(
      comanda({ itens: [pizza('G', [], 'G frango', frango.opcoes)], local_escrito: 'Arag.', total_escrito: '78' }),
    )
    expect(r.estado).toBe('vermelho')
    expect([r.itens[0].preco, r.somaItens, r.esperado]).toEqual([null, null, null])
    expect(r.itens[0].opcoes).toEqual([
      { sabor: 'Frango c/ Catupiry', preco: R(73) },
      { sabor: 'Franguinho', preco: R(73) },
      { sabor: 'Estrogonofe de Frango', preco: R(86) },
      { sabor: 'Frango com Pequi', preco: R(93) },
    ])
    // Escolhendo Franguinho: 73 + 5 = 78 fecha.
    const escolhido = conferir(
      comanda({ itens: [pizza('G', [], 'G frango', frango.opcoes)], local_escrito: 'Arag.', total_escrito: '78' }),
      null,
      { escolhas: { 0: 'Franguinho' } },
    )
    expect([escolhido.esperado, escolhido.estado]).toEqual([R(78), 'verde'])
  })

  it('L11 leituras divergindo no total: vermelho, mostrando as duas', () => {
    const lida = comanda({}, { total_digitos: digitos('118,00') })
    const r = conferir(lida)
    expect(r.estado).toBe('vermelho')
    expect(r.divergencias).toEqual([{ campo: 'total', completa: '113,00', conferencia: '118,00' }])
    // O motoboy escolhe uma: deixa de divergir e a conta é refeita.
    expect(conferir(lida, null, { total: '113,00' }).estado).toBe('verde')
    expect(conferir(lida, null, { total: '118,00' }).estado).toBe('vermelho')
  })

  it('L12 conversão do valor lido', () => {
    expect(valorLido('113')).toBe(11300)
    expect(valorLido('113,00')).toBe(11300)
    expect(valorLido('R$ 113,50')).toBe(11350)
    expect(valorLido('1.130,00')).toBe(113000)
    expect(valorLido('11a,00')).toBeNull()
    expect(valorLido(null)).toBeNull()
  })

  it('L13 combo 01 em Aragarças: 149,99 + 5 = 154,99, verde (o ,99 tem combo)', () => {
    const r = conferir(comanda({ itens: [avulso('combo', '01')], local_escrito: 'Arag.', total_escrito: '154,99' }))
    expect([r.esperado, r.alertas, r.estado]).toEqual([15499, [], 'verde'])
  })

  it('L14 Refrigerante 1L em Aragarças: 10 + 5 = 15 fecha, mas amarelo pelo valor baixo', () => {
    const r = conferir(comanda({ itens: [avulso('bebida', 'Refrigerante 1L')], local_escrito: 'Arag.', total_escrito: '15,00' }))
    expect([r.esperado, r.total]).toEqual([R(15), R(15)])
    expect(r.alertas).toEqual([r$('Total abaixo de R$ 20,00.')])
    expect(r.estado).toBe('amarelo')
  })
})

describe('leitura: outras regras', () => {
  it('R26 total com ,99 sem combo e acima de R$ 300', () => {
    const r = conferir(comanda({ total_escrito: '112,99' }))
    expect(r.alertas).toContain('Total termina em ,99 sem combo.')
    const alto = conferir(comanda({ itens: [avulso('combo', '04'), avulso('combo', '04')], total_escrito: '494,98' }))
    expect(alto.alertas).toContain(r$('Total acima de R$ 300,00.'))
  })

  it('R29 Pix pede um toque; Dinheiro e Cartão já vêm marcados', () => {
    const pix = conferir(comanda({ pagamento: [{ forma_escrita: 'Pix', forma: 'pix', valor_escrito: null }] }))
    expect(pix.estado).toBe('amarelo')
    expect(pix.pagamentos[0]).toMatchObject({ forma: null, pedePix: true })
    expect(pagamentosParaLancar(pix)).toBeNull()
    const escolhido = conferir(comanda({ pagamento: [{ forma_escrita: 'Pix', forma: 'pix', valor_escrito: null }] }), null, {
      formas: ['pix_antecipado'],
    })
    expect(escolhido.estado).toBe('verde')
    expect(pagamentosParaLancar(escolhido)).toEqual([{ forma: 'pix_antecipado', valor: R(113) }])
  })

  it('R29 pagamento misto com o valor de cada parte', () => {
    const r = conferir(
      comanda({
        pagamento: [
          { forma_escrita: 'Cartão', forma: 'cartao', valor_escrito: '100' },
          { forma_escrita: 'dinheiro', forma: 'dinheiro', valor_escrito: '13' },
        ],
      }),
    )
    expect(r.estado).toBe('verde')
    expect(pagamentosParaLancar(r)).toEqual([
      { forma: 'cartao', valor: R(100) },
      { forma: 'dinheiro', valor: R(13) },
    ])
  })

  it('R24 telefone ou total ilegível e item fora do cardápio deixam vermelho', () => {
    expect(conferir(comanda({ telefone_final: '35[?]7' })).motivos).toContain('Telefone ilegível: digite os 4 dígitos.')
    expect(conferir(comanda({ total_escrito: null })).estado).toBe('vermelho')
    const fora = conferir(comanda({ itens: [{ ...avulso('bebida', 'Coca de vidro'), casou_pelo_cardapio: false }] }))
    expect(fora.motivos).toContain('"Coca de vidro" não está no cardápio.')
  })

  it('R24 trecho ilegível fora da conta deixa amarelo', () => {
    const r = conferir(comanda({ ilegiveis: ['obs. [?]'] }))
    expect([r.estado, r.motivos]).toEqual(['amarelo', ['Trecho ilegível: obs. [?].']])
  })

  it('R20 palavra ambígua sem mudar o preço (calabresa) fica com preço', () => {
    const r = conferir(comanda({ itens: [pizza('G', ['Filé Mignon'], 'G Filé-calabresa', ['Calabresa', 'Calabresa Picante']), avulso('bebida', 'Refrigerante 2L')] }))
    expect([r.itens[0].preco, r.estado]).toEqual([R(93), 'verde'])
  })

  it('R22 local escrito pelo nome e o Parque antes da Barra', () => {
    const r = (local: string) => conferir(comanda({ local_escrito: local })).sugestao
    expect(r('Pontal')).toEqual({ areaId: 'pontal', origem: 'escrito' })
    expect(r('B. Garças, perto do Barra Shopping')).toEqual({ areaId: 'barra', origem: 'escrito' })
    expect(r('Parque de Exposições (Barra)')).toEqual({ areaId: 'parque', origem: 'escrito' })
    // Local que não é área (só "hospital") cai para a conta pelo valor.
    expect(r('hospital')).toEqual({ areaId: 'aragarcas', origem: 'valor' })
  })

  it('R25 sem a segunda leitura não fica verde', () => {
    const r = conferirLeitura({ leitura: comanda().leitura, conferencia: null, areas: AREAS, promoDesconto: null })
    expect(r.estado).toBe('amarelo')
  })

  it('R1 código repetido na noite vira alerta', () => {
    const r = conferirLeitura({
      ...comanda(),
      areas: AREAS,
      promoDesconto: null,
      comandasDaNoite: [{ id: 'x', codigo: '3557', status: 'em_rota' } as never],
    })
    expect(r.alertas).toEqual(['Já tem a 3557 nesta noite (em rota).'])
    expect(r.estado).toBe('amarelo')
  })
})

describe('leitura: pagamento', () => {
  const pagos = (...partes: [string, 'dinheiro' | 'cartao' | 'pix' | null, string | null][]) =>
    partes.map(([forma_escrita, forma, valor_escrito]) => ({ forma_escrita, forma, valor_escrito }))

  it('misto cujas partes não fecham o total fica vermelho e não lança', () => {
    const r = conferir(comanda({ pagamento: pagos(['Cartão', 'cartao', '100'], ['din', 'dinheiro', '10']) }))
    expect(r.estado).toBe('vermelho')
    expect(r.motivos).toContain(r$('As partes somam R$ 110,00, mas o total é R$ 113,00.'))
    expect(pagamentosParaLancar(r)).toBeNull()
  })

  it('misto sem o valor das partes fica vermelho; digitando as partes, lança', () => {
    const lida = comanda({ pagamento: pagos(['Cartão', 'cartao', null], ['din', 'dinheiro', null]) })
    const r = conferir(lida)
    expect(r.motivos).toContain('Falta o valor das partes: digite quanto foi em cada forma.')
    expect(pagamentosParaLancar(r)).toBeNull()
    const sobra = conferir(comanda({ pagamento: pagos(['Cartão', 'cartao', '120'], ['din', 'dinheiro', null]) }))
    expect(sobra.estado).toBe('vermelho')

    const digitado = conferir(lida, null, {
      pagamento: [
        { forma: 'cartao', valor: '100' },
        { forma: 'dinheiro', valor: null },
      ],
    })
    expect(digitado.estado).toBe('verde')
    expect(pagamentosParaLancar(digitado)).toEqual([
      { forma: 'cartao', valor: R(100) },
      { forma: 'dinheiro', valor: R(13) },
    ])
  })

  it('o toque do Pix numa parte não apaga a divergência das outras', () => {
    const lida = comanda({ pagamento: pagos(['Pix', 'pix', '50'], ['din', 'dinheiro', null]) }, { forma_escrita: 'Pix + cartão' })
    const r = conferir(lida, null, { formas: ['pix_antecipado'] })
    expect(r.divergencias.map((d) => d.campo)).toEqual(['pagamento'])
    expect(r.estado).toBe('vermelho')
    const todas = conferir(lida, null, { formas: ['pix_antecipado', 'cartao'] })
    expect(todas.divergencias).toEqual([])
    expect(pagamentosParaLancar(todas)).toEqual([
      { forma: 'pix_antecipado', valor: R(50) },
      { forma: 'cartao', valor: R(63) },
    ])
  })

  it('a versão da conferência pode ter outro número de partes', () => {
    const lida = comanda({ pagamento: pagos(['Pix', 'pix', null], ['din', 'dinheiro', null]) }, { forma_escrita: 'Pix' })
    expect(conferir(lida).estado).toBe('vermelho')
    const r = conferir(lida, null, { pagamento: [{ forma: 'pix_antecipado', valor: null }] })
    expect([r.estado, r.divergencias]).toEqual(['verde', []])
    expect(pagamentosParaLancar(r)).toEqual([{ forma: 'pix_antecipado', valor: R(113) }])
  })

  it('uma parte só com valor menor que o total fica vermelha; maior (troco) vale o total', () => {
    const menor = conferir(comanda({ pagamento: pagos(['Pix 50', 'pix', '50']) }), null, { formas: ['pix_antecipado'] })
    expect(menor.motivos).toContain(r$('O pagamento escrito (R$ 50,00) é menor que o total: falta a forma do resto.'))
    expect(pagamentosParaLancar(menor)).toBeNull()
    const troco = conferir(comanda({ pagamento: pagos(['din, troco p/ 150', 'dinheiro', '150']) }))
    expect(troco.estado).toBe('verde')
    expect(pagamentosParaLancar(troco)).toEqual([{ forma: 'dinheiro', valor: R(113) }])
  })

  it('duas formas escritas numa parte só pedem a divisão', () => {
    const r = conferir(comanda({ pagamento: pagos(['cart. e din', null, null]) }))
    expect(r.motivos).toContain('Mais de uma forma na mesma parte: divida o pagamento.')
    expect(r.estado).toBe('vermelho')
  })
})

describe('leitura: área, promoção e itens', () => {
  it('"Arag." vence outra área citada só de passagem', () => {
    const r = (local: string) => conferir(comanda({ local_escrito: local })).sugestao
    expect(r('Arag., perto da ponte da Barra')).toEqual({ areaId: 'aragarcas', origem: 'escrito' })
    const comRural = [...AREAS, { id: 'rural', nome: 'Aragarças Zona Rural', taxa: R(20), ativa: true }]
    const rural = conferirLeitura({ ...comanda(), areas: comRural, promoDesconto: null })
    expect([rural.sugestao?.areaId, rural.estado]).toEqual(['aragarcas', 'verde'])
  })

  it('"Parque" sozinho não é o Parque de Exposições', () => {
    const r = conferir(comanda({ local_escrito: 'Parque das Águas Quentes', total_escrito: '120,00' }))
    expect([r.sugestao, r.estado]).toEqual([{ areaId: 'barra', origem: 'valor' }, 'verde'])
  })

  it('local ilegível pede o toque na área', () => {
    const lida = comanda({ local_escrito: 'hospital da [?]', ilegiveis: ['[?]'] })
    expect(conferir(lida).motivos).toContain('Local ilegível: toque na área.')
    expect(conferir(lida, null, { areaId: 'aragarcas' }).estado).toBe('amarelo')
  })

  it('asterisco sem local e promoção sem valor: não adivinha área nem promoção', () => {
    const itens = [pizza('G', ['Calabresa']), avulso('bebida', 'Refrigerante 2L')]
    // 73 + 15 − 10 + 15 (Parque) = 93, que também seria Aragarças sem promoção.
    const r = conferir(comanda({ itens, local_escrito: null, total_escrito: '93' }))
    expect([r.estado, r.promocaoSugerida]).toEqual(['vermelho', null])
    expect(r.motivos).toContain('Asterisco sem local: toque na área para conferir a promoção.')
    const tocada = conferir(comanda({ itens, local_escrito: null, total_escrito: '93' }), null, { areaId: 'parque' })
    expect([tocada.promocaoSugerida, tocada.estado]).toEqual([1000, 'amarelo'])
  })

  it('meio a meio tradicional e doce do mesmo preço: a ordem não muda a conta', () => {
    const conta = (sabores: string[]) =>
      conferir(comanda({ itens: [pizza('G', sabores)], local_escrito: 'Arag.', total_escrito: '78' }), 1000)
    const a = conta(['Calabresa', 'Brigadeiro'])
    const b = conta(['Brigadeiro', 'Calabresa'])
    expect([a.desconto, a.esperado, a.estado]).toEqual([0, R(78), 'verde'])
    expect([b.desconto, b.esperado, b.estado]).toEqual([0, R(78), 'verde'])
    // Opções do mesmo preço, uma tradicional e outra doce: a promoção muda, então pede a escolha.
    const opcoes = conferir(
      comanda({ itens: [pizza('G', [], 'G abacaxi', ['Lombo com Abacaxi', 'Abacaxi c/ Leite Condensado'])], local_escrito: 'Arag.', total_escrito: '68' }),
      1000,
    )
    expect(opcoes.itens[0].preco).toBeNull()
  })

  it('item com opções de preços diferentes fica sem preço mesmo com palpite; do mesmo preço, com preço', () => {
    const cerveja = { ...avulso('bebida', 'Brahma 600ml'), opcoes: ['Brahma 600ml', 'Heineken 600ml', 'Original 600ml'] }
    const r = conferir(comanda({ itens: [pizza('G', ['Filé Mignon']), cerveja], total_escrito: '110,00' }))
    expect([r.itens[1].preco, r.estado]).toEqual([null, 'vermelho'])
    const suco = { ...avulso('bebida', 'suco'), item: null, opcoes: ['Suco de Laranja 400ml', 'Suco de Maracujá 400ml'] }
    const s = conferir(comanda({ itens: [pizza('G', ['Filé Mignon']), suco] }))
    expect([s.itens[1].preco, s.estado]).toEqual([R(15), 'verde'])
  })
})

describe('leitura: lançar', () => {
  const ctx = { id: 'c1', noiteId: 'n1', agora: '2026-10-16T21:00:00.000Z', fotoPath: 'n1/c1.jpg' }

  it('a 3557 vira comanda em rota com a foto, a área e de onde ela veio', () => {
    const r = conferir(comanda())
    const c = comandaDaLeitura(r, AREAS, 0, ctx)
    expect(c.ok && c.valor).toMatchObject({
      id: 'c1',
      codigo: '3557',
      total: R(113),
      areaId: 'aragarcas',
      taxa: R(5),
      status: 'em_rota',
      pagamentos: [{ forma: 'cartao', valor: R(113) }],
      fotoPath: 'n1/c1.jpg',
      areaOrigem: 'escrito',
    })
  })

  it('tocar outra área marca origem manual; sem forma ou com código ruim não lança', () => {
    const c = comandaDaLeitura(conferir(comanda(), null, { areaId: 'pontal' }), AREAS, 0, ctx)
    expect(c.ok && [c.valor.areaId, c.valor.areaOrigem]).toEqual(['pontal', 'manual'])
    const pix = conferir(comanda({ pagamento: [{ forma_escrita: 'Pix', forma: 'pix', valor_escrito: null }] }))
    expect(comandaDaLeitura(pix, AREAS, 0, ctx)).toEqual({ ok: false, erro: 'Escolha a forma de pagamento.' })
    const codigo = conferir(comanda({ telefone_final: '35[?]7' }))
    expect(comandaDaLeitura(codigo, AREAS, 0, ctx)).toEqual({ ok: false, erro: 'O código precisa ter 4 dígitos.' })
    expect(codigo.problemas).toContain('codigo')
  })

  it('registro da leitura (R27): o lido, o achado e o lançado; tocar a sugestão não é correção', () => {
    const lida = comanda()
    const r = conferir(lida, null, { areaId: 'aragarcas' })
    expect(houveCorrecao({ areaId: 'aragarcas' }, r)).toBe(false)
    expect(houveCorrecao({ areaId: 'barra' }, conferir(lida, null, { areaId: 'barra' }))).toBe(true)
    expect(houveCorrecao({ total: '113' }, r)).toBe(true)
    const c = comandaDaLeitura(r, AREAS, 0, ctx)
    if (!c.ok) throw new Error(c.erro)
    const reg = registroLeitura({ ...lida, modelo: 'm', ms: 900 }, r, {
      id: 'l1',
      noiteId: 'n1',
      fotoPath: 'n1/c1.jpg',
      comanda: c.valor,
      estadoFinal: 'verde',
      segundos: 12,
      corrigido: false,
      forcado: false,
      posterior: false,
      agora: ctx.agora,
    })
    expect(reg).toMatchObject({
      comandaId: 'c1',
      resultado: { estado: 'verde', areaSugerida: 'aragarcas', origem: 'escrito', esperado: R(113), posterior: false },
      lancado: {
        codigo: '3557',
        total: R(113),
        areaId: 'aragarcas',
        areaOrigem: 'escrito',
        pagamentos: [{ forma: 'cartao', valor: R(113) }],
        troco: 0,
        estado: 'verde',
        segundos: 12,
      },
      modelo: 'm',
      ms: 900,
    })
  })

  it('R28: a leitura que chega depois só avisa quando discorda do lançado', () => {
    const lida = comanda()
    const reg = registroLeitura({ ...lida, modelo: 'm', ms: 1 }, conferir(lida), {
      id: 'l1',
      noiteId: 'n1',
      fotoPath: 'n1/c1.jpg',
      comanda: null,
      estadoFinal: null,
      segundos: null,
      corrigido: false,
      forcado: false,
      posterior: true,
      agora: ctx.agora,
    })
    const r = conferir(lida)
    const lancada = comandaDaLeitura(r, AREAS, 0, ctx)
    if (!lancada.ok) throw new Error(lancada.erro)
    const c = lancada.valor
    expect(avisoLeitura(reg, c, AREAS, null)).toEqual([])
    expect(avisoLeitura(reg, { ...c, codigo: '3558' }, AREAS, null)).toEqual(['Código lido: 3557.'])
    expect(avisoLeitura(reg, { ...c, total: R(118), areaId: 'pontal' }, AREAS, null)).toEqual([r$('Total lido: R$ 113,00.')])
    expect(avisoLeitura(reg, { ...c, areaId: 'barra' }, AREAS, null)).toEqual([r$('A conta pelo cardápio dá R$ 120,00.')])
    expect(avisoLeitura(reg, { ...c, pagamentos: [{ forma: 'dinheiro', valor: R(113) }] }, AREAS, null)).toEqual([
      'Forma lida: Cartão.',
    ])
    // Sem forma escrita na comanda, não há o que comparar.
    const semForma = { ...reg, leitura: { ...reg.leitura, pagamento: [] } }
    expect(avisoLeitura(semForma, c, AREAS, null)).toEqual([])
  })
})

describe('cardápio', () => {
  const sabores = CARDAPIO.pizzas.sabores
  it('todo sabor tem uma faixa com preço nos 4 tamanhos', () => {
    for (const s of sabores) expect(Object.keys(CARDAPIO.pizzas.faixas[s.faixa]).sort()).toEqual(['B', 'G', 'M', 'P'])
  })
  it('nomes e apelidos não se repetem', () => {
    const nomes = sabores.flatMap((s) => [s.nome, ...(s.apelidos ?? [])]).map(normalizar)
    expect(new Set(nomes).size).toBe(nomes.length)
  })
  it('as opções das ambiguidades existem e o "muda_preco" bate com as faixas', () => {
    for (const a of CARDAPIO.ambiguidades) {
      const faixas = a.opcoes.map((o) => sabores.find((s) => s.nome === o)?.faixa)
      expect(faixas.every(Boolean)).toBe(true)
      const precos = new Set(faixas.map((f) => CARDAPIO.pizzas.faixas[f!].G))
      expect(precos.size > 1).toBe(a.muda_preco)
    }
  })
  it('os itens dos combos existem no cardápio', () => {
    for (const combo of CARDAPIO.combos)
      for (const item of combo.itens) {
        const sabor = item.replace(/ G$/, '')
        const existe = sabores.some((s) => s.nome === sabor) || precoAvulso(CARDAPIO, 'bebida', item) !== null
        expect(existe, item).toBe(true)
      }
  })
  it('preços em centavos, inclusive os quebrados', () => {
    expect(precoAvulso(CARDAPIO, 'combo', '01')).toBe(14999)
    expect(precoAvulso(CARDAPIO, 'adicional', 'Cuba de creme de avelã')).toBe(999)
    expect(precoAvulso(CARDAPIO, 'bebida', 'coca zero 2l')).toBe(1500)
    expect(precoAvulso(CARDAPIO, 'borda', 'Cheddar')).toBe(1600)
  })
})
