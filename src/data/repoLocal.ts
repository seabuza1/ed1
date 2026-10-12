import Dexie, { type EntityTable } from 'dexie'
import { AJUSTES_PADRAO, AREAS_PADRAO } from '../domain/padroes'
import type { Ajustes, Area, Comanda, Noite } from '../domain/tipos'
import { novoId } from './id'
import type { Repo } from './repo'

type Banco = Dexie & {
  noites: EntityTable<Noite, 'id'>
  comandas: EntityTable<Comanda, 'id'>
  areas: EntityTable<Area, 'id'>
  ajustes: EntityTable<Ajustes, 'id'>
}

export function criarRepoLocal(nome: string): Repo {
  const db = new Dexie(nome) as Banco
  db.version(1).stores({
    noites: 'id, data',
    comandas: 'id, noiteId',
    areas: 'id',
    ajustes: 'id',
  })
  // Primeira abertura: áreas e valores padrão.
  db.on('populate', async (tx) => {
    await tx.table('areas').bulkAdd(AREAS_PADRAO.map((a) => ({ id: novoId(), ...a, ativa: true })))
    await tx.table('ajustes').add(AJUSTES_PADRAO)
  })

  const ouvintes = new Set<() => void>()
  const gravar = async (op: () => Promise<unknown>) => {
    await op()
    ouvintes.forEach((o) => o())
  }

  return {
    listarNoites: () => db.noites.toArray(),
    salvarNoite: (noite) => gravar(() => db.noites.put(noite)),

    listarComandas: (noiteId) => db.comandas.where('noiteId').equals(noiteId).sortBy('criadaEm'),
    salvarComanda: (comanda) => gravar(() => db.comandas.put(comanda)),
    excluirComanda: (id) => gravar(() => db.comandas.delete(id)),

    listarAreas: async () =>
      (await db.areas.toArray()).sort((a, b) => a.taxa - b.taxa || a.nome.localeCompare(b.nome)),
    salvarArea: (area) => gravar(() => db.areas.put(area)),

    obterAjustes: async () => (await db.ajustes.get('padrao')) ?? AJUSTES_PADRAO,
    salvarAjustes: (ajustes) => gravar(() => db.ajustes.put(ajustes)),

    aoMudar(ouvinte) {
      ouvintes.add(ouvinte)
      return () => ouvintes.delete(ouvinte)
    },
  }
}
