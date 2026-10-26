// Formato da saída da IA (docs/SPEC-leitura.md, "Saída da IA"), igual para todo provedor.
// JSON Schema simples: type, properties, required, enum, items e additionalProperties; anyOf só
// para o campo que pode ser nulo (o Gemini e a Anthropic aceitam). Sem $ref.

export type TipoLeitura = 'completa' | 'conferencia'

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
          sabores: {
            ...textos,
            description: 'um por sabor, na ordem escrita (meio a meio: todos); nome exato do cardápio ou, se ambíguo, a palavra',
          },
          item: nulo(texto, 'nome exato do cardápio (bebida, borda, adicional) ou combo "01" a "04"'),
          casou_pelo_cardapio: { type: 'boolean' },
          opcoes: { ...textos, description: 'fora da pizza, quando ambíguo: os itens possíveis' },
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

export const ESQUEMA = { completa: ESQUEMA_COMPLETA, conferencia: ESQUEMA_CONFERENCIA }

interface Esquema {
  type?: string
  properties?: Record<string, Esquema>
  required?: readonly string[]
  additionalProperties?: boolean
  items?: Esquema
  enum?: readonly unknown[]
  anyOf?: readonly Esquema[]
}

const TIPOS: Record<string, (v: unknown) => boolean> = {
  object: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
  array: Array.isArray,
  string: (v) => typeof v === 'string',
  boolean: (v) => typeof v === 'boolean',
  integer: Number.isInteger,
  null: (v) => v === null,
}

/** O valor segue o esquema? Só as palavras usadas acima. */
export function valida(e: Esquema, v: unknown): boolean {
  if (e.anyOf) return e.anyOf.some((x) => valida(x, v))
  if (e.type && !TIPOS[e.type]?.(v)) return false
  if (e.enum && !e.enum.includes(v)) return false
  if (Array.isArray(v)) return !e.items || v.every((x) => valida(e.items!, x))
  if (e.type !== 'object') return true
  const obj = v as Record<string, unknown>
  // Object.hasOwn: "constructor" ou "toString" não contam como propriedade do esquema.
  if (!(e.required ?? []).every((k) => Object.hasOwn(obj, k))) return false
  return Object.entries(obj).every(([k, x]) =>
    e.properties && Object.hasOwn(e.properties, k) ? valida(e.properties[k], x) : e.additionalProperties !== false,
  )
}

/** A saída da IA (texto JSON ou já objeto) no formato pedido; null se não veio ou não segue o esquema. */
export function lerSaida(tipo: TipoLeitura, saida: unknown): Record<string, unknown> | null {
  let obj = saida
  if (typeof saida === 'string') {
    try {
      obj = JSON.parse(saida)
    } catch {
      return null
    }
  }
  return valida(ESQUEMA[tipo], obj) ? (obj as Record<string, unknown>) : null
}
