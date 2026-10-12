import type { Resultado } from './comanda'
import type { Ajustes, Area } from './tipos'

export interface EntradaArea {
  nome: string
  taxa: number
}

function validarArea(entrada: EntradaArea, areas: Area[], id?: string): string | null {
  const nome = entrada.nome.trim()
  if (nome === '') return 'Informe o nome da área.'
  if (areas.some((a) => a.id !== id && a.nome.trim().toLowerCase() === nome.toLowerCase()))
    return `Já existe a área ${nome}.`
  if (!Number.isInteger(entrada.taxa) || entrada.taxa <= 0) return 'Informe a taxa.'
  return null
}

export function novaArea(entrada: EntradaArea, areas: Area[], id: string): Resultado<Area> {
  const erro = validarArea(entrada, areas)
  if (erro) return { ok: false, erro }
  return { ok: true, valor: { id, nome: entrada.nome.trim(), taxa: entrada.taxa, ativa: true } }
}

/** R3: mudar a taxa aqui não altera as comandas já lançadas (a taxa fica gravada nelas). */
export function editarArea(area: Area, entrada: EntradaArea, areas: Area[]): Resultado<Area> {
  const erro = validarArea(entrada, areas, area.id)
  if (erro) return { ok: false, erro }
  return { ok: true, valor: { ...area, nome: entrada.nome.trim(), taxa: entrada.taxa } }
}

/** Desativar some dos chips de lançamento; sempre fica pelo menos uma ativa. */
export function alternarArea(area: Area, areas: Area[]): Resultado<Area> {
  if (area.ativa && !areas.some((a) => a.id !== area.id && a.ativa))
    return { ok: false, erro: 'Deixe pelo menos uma área ativa.' }
  return { ok: true, valor: { ...area, ativa: !area.ativa } }
}

export function editarAjustes(valores: { caixaPadrao: number; diariaPadrao: number }): Resultado<Ajustes> {
  const ok = (n: number) => Number.isInteger(n) && n >= 0
  if (!ok(valores.caixaPadrao)) return { ok: false, erro: 'Caixa inválido.' }
  if (!ok(valores.diariaPadrao)) return { ok: false, erro: 'Diária inválida.' }
  return { ok: true, valor: { id: 'padrao', ...valores } }
}
