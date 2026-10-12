import type { Ajustes } from './tipos'

export const AJUSTES_PADRAO: Ajustes = { id: 'padrao', caixaPadrao: 8000, diariaPadrao: 3000 }

export const AREAS_PADRAO: { nome: string; taxa: number }[] = [
  { nome: 'Aragarças', taxa: 500 },
  { nome: 'Pontal', taxa: 1000 },
  { nome: 'Barra', taxa: 1200 },
  { nome: 'Parque de Exposições', taxa: 1500 },
]
