// Tipos no formato das tabelas do Supabase (supabase/001_schema.sql), em camelCase.
// Dinheiro sempre em centavos (inteiro).

export type Papel = 'motoboy' | 'expedicao' | 'admin'
export type Forma = 'dinheiro' | 'cartao' | 'pix_maquina' | 'pix_antecipado'
export type Status = 'em_rota' | 'entregue' | 'voltou'

export interface Area {
  id: string
  nome: string
  taxa: number
  ativa: boolean
}

/** Um caixa = um motoboy numa noite. */
export interface Caixa {
  id: string
  motoboyId: string
  data: string // YYYY-MM-DD
  caixaInicial: number
  diaria: number
  ordemChegada: number | null
  dinheiroContado: number | null
  fechadoEm: string | null
  obs: string
  criadoEm: string
  atualizadoEm: string
}

export interface Pagamento {
  forma: Forma
  valor: number
}

export interface Comanda {
  id: string
  caixaId: string
  codigo: string
  total: number
  areaId: string
  taxa: number // gravada no lançamento
  status: Status
  pagamentos: Pagamento[]
  troco: number
  papelConferido: boolean
  pixConfirmado: boolean
  criadoEm: string
  atualizadoEm: string
}
