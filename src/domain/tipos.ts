// Modelo de dados, já no formato das tabelas do Supabase.
// Todos os valores em dinheiro são centavos (inteiro).

export type Forma = 'dinheiro' | 'cartao' | 'pix_maquina' | 'pix_antecipado'
export type Status = 'em_rota' | 'entregue' | 'voltou'

export interface Area {
  id: string
  nome: string
  taxa: number
  ativa: boolean
}

export interface Noite {
  id: string
  data: string // YYYY-MM-DD
  caixaInicial: number
  diaria: number
  dinheiroContado: number | null
  fechadaEm: string | null
  luanPagou: number | null
  luanDiferenca: number | null // negativo = falta, positivo = sobra
  minutosAcerto: number | null
  obs: string
}

export interface Pagamento {
  forma: Forma
  valor: number
}

export interface Comanda {
  id: string
  noiteId: string
  codigo: string
  total: number
  areaId: string
  taxa: number
  status: Status
  troco: number
  pagamentos: Pagamento[]
  criadaEm: string
  atualizadaEm: string
}
