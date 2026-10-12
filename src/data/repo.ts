import type { Ajustes, Area, Comanda, Noite } from '../domain/tipos'
import { criarRepoLocal } from './repoLocal'

/**
 * Acesso aos dados. As telas só falam com esta interface; hoje a implementação é
 * IndexedDB (Dexie), na próxima versão será Supabase.
 */
export interface Repo {
  listarNoites(): Promise<Noite[]>
  salvarNoite(noite: Noite): Promise<void>
  /** Grava só os campos informados (evita sobrescrever o que mudou em outra gravação). */
  atualizarNoite(id: string, mudancas: Partial<Omit<Noite, 'id'>>): Promise<void>

  listarComandas(noiteId: string): Promise<Comanda[]>
  salvarComanda(comanda: Comanda): Promise<void>
  excluirComanda(id: string): Promise<void>

  /** Ordenadas pela taxa. */
  listarAreas(): Promise<Area[]>
  salvarArea(area: Area): Promise<void>

  obterAjustes(): Promise<Ajustes>
  salvarAjustes(ajustes: Ajustes): Promise<void>

  /** Chama o ouvinte depois de cada gravação. Devolve a função que para de ouvir. */
  aoMudar(ouvinte: () => void): () => void
}

export const repo: Repo = criarRepoLocal('acerto')
