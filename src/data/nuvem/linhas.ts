// Linhas das tabelas do Supabase (supabase/001_schema.sql a 004) e a conversão para os
// tipos do app. Noite do app = caixa na nuvem (um motoboy numa noite).
import type { RegistroLeitura } from '../../domain/leitura'
import type { AcertoConfirmado, Area, Comanda, Noite, OrigemArea, Pagamento, Papel, Perfil, Status } from '../../domain/tipos'

export interface CaixaLinha {
  id: string
  motoboy_id: string
  data: string
  caixa_inicial: number
  diaria: number
  ordem_chegada: number | null
  dinheiro_contado: number | null
  fechado_em: string | null
  obs: string
  promo_desconto?: number | null // 004
  criado_em: string
  atualizado_em: string
}

export interface ComandaLinha {
  id: string
  caixa_id: string
  codigo: string
  total: number
  area_id: string
  taxa: number
  status: Status
  pagamentos: Pagamento[]
  troco: number
  papel_conferido: boolean
  pix_confirmado: boolean
  finalizada_em: string | null
  foto_path?: string | null // 004
  area_origem?: OrigemArea | null // 004
  criado_em: string
  atualizado_em: string
}

export interface AcertoLinha {
  caixa_id: string
  confirmado_por: string
  confirmado_em: string
  dinheiro_contado: number
  falta: number
  sobra: number
  pago_ao_motoboy: number
  pago_do_caixa_dele: number
  retirado_caixa_empresa: number
  vai_para_empresa: number
  completado_do_bolso: number
  obs: string
}

export type AreaLinha = Area

export interface PerfilLinha {
  id: string
  nome: string
  papel: Papel
  ativo: boolean
}

export type Tabela = 'caixas' | 'comandas' | 'areas' | 'leituras'

/** Instante do Postgres ("…+00:00", microssegundos) → ISO do app ("…Z"). */
export const iso = (t: string | null): string | null => (t === null ? null : new Date(t).toISOString())

// O que o app grava em cada tabela. Ficam de fora as colunas que o banco preenche
// (atualizado_em, ordem_chegada) e as do Luan que o motoboy só lê.

export const caixaParaGravar = (n: Noite, motoboyId: string) => ({
  id: n.id,
  motoboy_id: motoboyId,
  data: n.data,
  caixa_inicial: n.caixaInicial,
  diaria: n.diaria,
  dinheiro_contado: n.dinheiroContado,
  fechado_em: n.fechadaEm,
  obs: n.obs,
  promo_desconto: n.promoDesconto ?? null,
})

export const comandaParaGravar = (c: Comanda) => ({
  id: c.id,
  caixa_id: c.noiteId,
  codigo: c.codigo,
  total: c.total,
  area_id: c.areaId,
  taxa: c.taxa,
  status: c.status,
  pagamentos: c.pagamentos,
  troco: c.troco,
  papel_conferido: c.papelConferido === true,
  pix_confirmado: c.pixConfirmado === true,
  finalizada_em: c.finalizadaEm,
  foto_path: c.fotoPath ?? null,
  area_origem: c.areaOrigem ?? null,
  criado_em: c.criadaEm,
})

export const areaParaGravar = (a: Area) => ({ id: a.id, nome: a.nome, taxa: a.taxa, ativa: a.ativa })

export interface LeituraLinha {
  id: string
  caixa_id: string
  comanda_id: string | null
  foto_path: string
  leitura: RegistroLeitura['leitura']
  conferencia: RegistroLeitura['conferencia']
  resultado: RegistroLeitura['resultado']
  lancado: RegistroLeitura['lancado']
  corrigido: boolean
  forcado: boolean
  modelo: string | null
  ms: number | null
  criado_em: string
}

export const linhaParaLeitura = (l: LeituraLinha): RegistroLeitura => ({
  id: l.id,
  noiteId: l.caixa_id,
  comandaId: l.comanda_id,
  fotoPath: l.foto_path,
  leitura: l.leitura,
  conferencia: l.conferencia,
  resultado: l.resultado,
  lancado: l.lancado,
  corrigido: l.corrigido,
  forcado: l.forcado,
  modelo: l.modelo ?? '',
  ms: l.ms ?? 0,
  criadaEm: iso(l.criado_em)!,
})

/** O motoboy só sobe; o painel lê para medir (linhaParaLeitura). */
export const leituraParaGravar = (r: RegistroLeitura) => ({
  id: r.id,
  caixa_id: r.noiteId,
  comanda_id: r.comandaId,
  foto_path: r.fotoPath,
  leitura: r.leitura,
  conferencia: r.conferencia,
  resultado: r.resultado,
  lancado: r.lancado,
  corrigido: r.corrigido,
  forcado: r.forcado,
  modelo: r.modelo,
  ms: r.ms,
  criado_em: r.criadaEm,
})

export type Gravavel = Record<string, unknown>

export type Registro = Noite | Comanda | Area | RegistroLeitura

export function paraGravar(tabela: Tabela, registro: Registro, motoboyId: string): Gravavel {
  if (tabela === 'caixas') return caixaParaGravar(registro as Noite, motoboyId)
  if (tabela === 'comandas') return comandaParaGravar(registro as Comanda)
  if (tabela === 'leituras') return leituraParaGravar(registro as RegistroLeitura)
  return areaParaGravar(registro as Area)
}

/** Só as colunas que mudaram (para não apagar o que o Luan mudou na mesma linha). */
export function camposAlterados(antes: Gravavel, depois: Gravavel): Gravavel {
  const campos: Gravavel = {}
  for (const k of Object.keys(depois))
    if (k !== 'id' && JSON.stringify(antes[k]) !== JSON.stringify(depois[k])) campos[k] = depois[k]
  return campos
}

export const linhaParaNoite = (l: CaixaLinha): Noite => ({
  id: l.id,
  data: l.data,
  caixaInicial: l.caixa_inicial,
  diaria: l.diaria,
  dinheiroContado: l.dinheiro_contado,
  fechadaEm: iso(l.fechado_em),
  luanPagou: null,
  luanDiferenca: null,
  minutosAcerto: null,
  obs: l.obs,
  ...(l.promo_desconto != null ? { promoDesconto: l.promo_desconto } : {}),
})

export const linhaParaComanda = (l: ComandaLinha): Comanda => ({
  id: l.id,
  noiteId: l.caixa_id,
  codigo: l.codigo,
  total: l.total,
  areaId: l.area_id,
  taxa: l.taxa,
  status: l.status,
  troco: l.troco,
  pagamentos: l.pagamentos,
  criadaEm: iso(l.criado_em)!,
  atualizadaEm: iso(l.atualizado_em)!,
  finalizadaEm: iso(l.finalizada_em),
  papelConferido: l.papel_conferido,
  pixConfirmado: l.pix_confirmado,
  ...(l.foto_path ? { fotoPath: l.foto_path } : {}),
  ...(l.area_origem ? { areaOrigem: l.area_origem } : {}),
})

export const linhaParaArea = (l: AreaLinha): Area => ({ id: l.id, nome: l.nome, taxa: l.taxa, ativa: l.ativa })

export const linhaParaPerfil = (l: PerfilLinha): Perfil => ({ id: l.id, nome: l.nome, papel: l.papel, ativo: l.ativo })

export const linhaParaAcerto = (l: AcertoLinha, nome: string | null = null): AcertoConfirmado => ({
  caixaId: l.caixa_id,
  confirmadoPor: l.confirmado_por,
  confirmadoPorNome: nome,
  confirmadoEm: iso(l.confirmado_em)!,
  dinheiroContado: l.dinheiro_contado,
  falta: l.falta,
  sobra: l.sobra,
  pagoAoMotoboy: l.pago_ao_motoboy,
  pagoDoCaixaDele: l.pago_do_caixa_dele,
  retiradoCaixaEmpresa: l.retirado_caixa_empresa,
  vaiParaEmpresa: l.vai_para_empresa,
  completadoDoBolso: l.completado_do_bolso,
  obs: l.obs,
})

/** Aplica, sobre a linha que veio da nuvem, os campos ainda não enviados deste aparelho. */
export function comPendentes<T extends object>(linha: T, campos: Gravavel | undefined): T {
  return campos ? { ...linha, ...campos } : linha
}
