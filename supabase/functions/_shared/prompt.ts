// Prompt da leitura da comanda (docs/SPEC-leitura.md, "Prompt" e "Saída da IA").
// Usado pela Edge Function ler-comanda. Não depende de Deno nem do SDK, para os testes do app
// rodarem aqui também. A IA só transcreve (R19): o cardápio vai sem preços e sem ingredientes.

export type TipoLeitura = 'completa' | 'conferencia'

/** O pedaço do cardapio-mel.json que o prompt usa. */
export interface CardapioPrompt {
  glossario: Record<string, string>
  pizzas: {
    tamanhos: Record<string, string>
    faixas: Record<string, unknown>
    sabores: { nome: string; faixa: string; apelidos?: string[] }[]
  }
  bordas: { nome: string }[]
  adicionais: { itens: string[]; outros: { nome: string }[] }
  combos: { id: string; itens: string[] }[]
  bebidas: { grupo: string; nome: string; apelidos?: string[] }[]
  outros: { nome: string }[]
  ambiguidades: { escrito: string; opcoes: string[] }[]
}

/** Foto de exemplo (JPEG em base64) com as duas leituras esperadas. */
export interface Exemplo {
  imagem: string
  leitura: unknown
  conferencia: unknown
}

export const REGRAS =
  'Você está lendo uma comanda de pizzaria escrita à mão. Transcreva exatamente o que está escrito, linha por linha, ' +
  'sem corrigir, deduzir ou completar nada. Marque trechos ilegíveis com [?] e liste-os em "ilegiveis". Transcreva o ' +
  'total e o telefone dígito por dígito. Use o cardápio e o glossário só para identificar itens, e marque ' +
  'casou_pelo_cardapio quando usar. Se uma palavra couber em mais de um sabor, devolva as opções em vez de escolher. ' +
  'Não calcule valores.'

const comApelidos = (nome: string, apelidos?: string[]) => (apelidos?.length ? `${nome} (${apelidos.join(', ')})` : nome)

/** Regras, glossário e cardápio: igual em toda chamada, vai com cache. */
export function montarSistema(c: CardapioPrompt): string {
  const faixas = Object.keys(c.pizzas.faixas).map((faixa) => {
    const sabores = c.pizzas.sabores.filter((s) => s.faixa === faixa).map((s) => comApelidos(s.nome, s.apelidos))
    return `- ${faixa}: ${sabores.join('; ')}`
  })
  const grupos = [...new Set(c.bebidas.map((b) => b.grupo))].map(
    (g) =>
      `- ${g}: ${c.bebidas
        .filter((b) => b.grupo === g)
        .map((b) => comApelidos(b.nome, b.apelidos))
        .join('; ')}`,
  )
  return [
    REGRAS,
    '',
    'Formato: telefone_final são os 4 últimos dígitos do telefone do cliente, que identificam a comanda. Um asterisco ' +
      'na comanda é a promoção da noite (promocao). local_escrito é o bairro, a cidade ou a referência, como escritos. ' +
      'Nos itens, sabores e item usam os nomes exatos do cardápio abaixo; combo vem como "01" a "04". Na forma de ' +
      'pagamento, forma_escrita é o texto como está; forma é "dinheiro", "cartao" ou "pix" só quando o texto diz ' +
      'claramente uma forma, e null se diz mais de uma ou nenhuma. Valores (total_escrito, valor_escrito) vêm como ' +
      'texto, do jeito que estão escritos.',
    '',
    '## Glossário',
    ...Object.entries(c.glossario).map(([abrev, sentido]) => `- "${abrev}" = ${sentido}`),
    '',
    '## Cardápio',
    `Tamanhos de pizza: ${Object.entries(c.pizzas.tamanhos)
      .map(([t, nome]) => `${t} = ${nome}`)
      .join('; ')}.`,
    'Sabores por faixa (apelidos entre parênteses):',
    ...faixas,
    `Bordas: ${c.bordas.map((b) => b.nome).join('; ')}.`,
    `Adicionais: ${[...c.adicionais.itens, ...c.adicionais.outros.map((o) => o.nome)].join('; ')}.`,
    'Combos:',
    ...c.combos.map((k) => `- ${k.id}: ${k.itens.join(' + ')}`),
    'Bebidas:',
    ...grupos,
    `Outros: ${c.outros.map((o) => o.nome).join('; ')}.`,
    'Palavras que cabem em mais de um sabor ou item (devolva as opções em "opcoes"):',
    ...c.ambiguidades.map((a) => `- "${a.escrito}": ${a.opcoes.join('; ')}`),
  ].join('\n')
}

// ---------- Saída (structured outputs: mesmo formato de supabase/functions/_shared/exemplos) ----------

const nulo = (schema: object, description?: string) => ({
  anyOf: [schema, { type: 'null' }],
  ...(description ? { description } : {}),
})
const texto = { type: 'string' }
const textos = { type: 'array', items: texto }

export const ESQUEMA_COMPLETA = {
  type: 'object',
  additionalProperties: false,
  required: ['telefone_final', 'promocao', 'local_escrito', 'itens', 'pagamento', 'total_escrito', 'transcricao', 'ilegiveis'],
  properties: {
    telefone_final: nulo(texto, '4 últimos dígitos do telefone, como escritos'),
    promocao: { type: 'boolean', description: 'asterisco presente' },
    local_escrito: nulo(texto, 'bairro, cidade ou referência, como escritos'),
    itens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lido', 'tipo', 'quantidade', 'tamanho', 'sabores', 'item', 'casou_pelo_cardapio', 'opcoes'],
        properties: {
          lido: { type: 'string', description: 'o trecho como escrito' },
          tipo: { type: 'string', enum: ['pizza', 'bebida', 'borda', 'adicional', 'combo', 'outro'] },
          quantidade: { type: 'integer' },
          tamanho: nulo({ type: 'string', enum: ['B', 'P', 'M', 'G'] }),
          sabores: { ...textos, description: 'nomes exatos do cardápio' },
          item: nulo(texto, 'nome exato do cardápio (bebida, borda, adicional) ou combo "01" a "04"'),
          casou_pelo_cardapio: { type: 'boolean' },
          opcoes: { ...textos, description: 'quando ambíguo: os sabores ou itens possíveis' },
        },
      },
    },
    pagamento: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['forma_escrita', 'forma', 'valor_escrito'],
        properties: {
          forma_escrita: texto,
          forma: nulo({ type: 'string', enum: ['dinheiro', 'cartao', 'pix'] }),
          valor_escrito: nulo(texto, 'valor desta parte, como escrito'),
        },
      },
    },
    total_escrito: nulo(texto, 'total como escrito, ex.: "113,00"'),
    transcricao: { ...textos, description: 'linha por linha' },
    ilegiveis: textos,
  },
} as const

export const ESQUEMA_CONFERENCIA = {
  type: 'object',
  additionalProperties: false,
  required: ['telefone_digitos', 'total_digitos', 'forma_escrita', 'local_escrito', 'promocao'],
  properties: {
    telefone_digitos: { ...textos, description: 'os 4 últimos dígitos do telefone, um por item' },
    total_digitos: { ...textos, description: 'o total caractere por caractere, inclusive a vírgula' },
    forma_escrita: nulo(texto),
    local_escrito: nulo(texto),
    promocao: { type: 'boolean', description: 'asterisco presente' },
  },
} as const

const PEDIDO: Record<TipoLeitura, string> = {
  completa: 'Leia esta comanda e devolva a leitura completa.',
  conferencia:
    'Leia de novo só os campos críticos desta comanda: o telefone e o total dígito por dígito, a forma de pagamento ' +
    'como escrita, o local como escrito e se tem asterisco.',
}

const foto = (base64: string) => ({
  type: 'image' as const,
  source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64 },
})

/**
 * Corpo do pedido à API (Messages). Ordem fixa para o cache: sistema (com cache), os exemplos
 * (o último com cache) e por fim a foto da vez, que muda a cada chamada.
 */
export function montarPedido(tipo: TipoLeitura, e: { cardapio: CardapioPrompt; exemplos: Exemplo[]; imagem: string; modelo: string }) {
  const exemplos = e.exemplos.flatMap((x, i) => [
    { role: 'user' as const, content: [foto(x.imagem), { type: 'text' as const, text: PEDIDO[tipo] }] },
    {
      role: 'assistant' as const,
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(tipo === 'completa' ? x.leitura : x.conferencia),
          ...(i === e.exemplos.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
        },
      ],
    },
  ])
  return {
    model: e.modelo,
    max_tokens: 8000,
    system: [{ type: 'text' as const, text: montarSistema(e.cardapio), cache_control: { type: 'ephemeral' as const } }],
    messages: [...exemplos, { role: 'user' as const, content: [foto(e.imagem), { type: 'text' as const, text: PEDIDO[tipo] }] }],
    // Esforço baixo: transcrever pede pouca deliberação e a chamada tem 20 s.
    output_config: {
      effort: 'low' as const,
      format: { type: 'json_schema' as const, schema: tipo === 'completa' ? ESQUEMA_COMPLETA : ESQUEMA_CONFERENCIA },
    },
  }
}

/** Bytes de um base64 (sem o prefixo data:), para recusar foto acima de 2 MB sem decodificar. */
export function tamanhoBase64(b64: string): number {
  const limpo = b64.replace(/\s/g, '')
  const enchimento = limpo.endsWith('==') ? 2 : limpo.endsWith('=') ? 1 : 0
  return Math.floor((limpo.length * 3) / 4) - enchimento
}

export const LIMITE_FOTO = 2 * 1024 * 1024

/** O texto da resposta como JSON do formato pedido; null se não veio ou não tem os campos. */
export function lerSaida(tipo: TipoLeitura, texto: string): Record<string, unknown> | null {
  let obj: unknown
  try {
    obj = JSON.parse(texto)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const campos = (tipo === 'completa' ? ESQUEMA_COMPLETA : ESQUEMA_CONFERENCIA).required
  return campos.every((k) => k in obj) ? (obj as Record<string, unknown>) : null
}
