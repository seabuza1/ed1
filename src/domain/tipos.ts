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
  /** Comprovante da maquininha conferido no acerto (cartão e Pix na máquina). */
  conferido?: boolean
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
  /** Quando foi marcada entregue (ou voltou): o horário que bate com o comprovante. */
  finalizadaEm: string | null
  /** R16: a comanda de papel foi entregue ao Luan no acerto. */
  papelConferido?: boolean
  /** Pix antecipado: o Luan confirmou que o Pix caiu. */
  pixConfirmado?: boolean
}

export interface Ajustes {
  id: 'padrao'
  caixaPadrao: number
  diariaPadrao: number
}

export type Papel = 'motoboy' | 'expedicao' | 'admin'

export interface Perfil {
  id: string
  nome: string
  papel: Papel
  ativo: boolean
}

/** Acerto confirmado pelo Luan: fotografia dos valores na hora da confirmação (tabela acertos). */
export interface AcertoConfirmado {
  caixaId: string
  confirmadoPor: string
  /** Nome de quem confirmou, quando conhecido. */
  confirmadoPorNome: string | null
  confirmadoEm: string
  dinheiroContado: number
  falta: number
  sobra: number
  pagoAoMotoboy: number
  pagoDoCaixaDele: number
  retiradoCaixaEmpresa: number
  vaiParaEmpresa: number
  completadoDoBolso: number
  obs: string
}
