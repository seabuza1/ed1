import Dexie, { type EntityTable } from 'dexie'
import { areaSugerida, comHoraDeEntrega } from '../domain/comanda'
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
  const tabelas = { noites: 'id, data', comandas: 'id, noiteId', areas: 'id', ajustes: 'id' }
  db.version(1).stores(tabelas)
  // v2: hora da entrega (finalizadaEm) nas comandas já gravadas.
  db.version(2)
    .stores(tabelas)
    .upgrade((tx) =>
      tx
        .table('comandas')
        .toCollection()
        .modify((c: Comanda) => {
          c.finalizadaEm = comHoraDeEntrega(c).finalizadaEm
        }),
    )
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
    nuvem: false,
    listarNoites: () => db.noites.toArray(),
    salvarNoite: (noite) => gravar(() => db.noites.put(noite)),
    atualizarNoite: (id, mudancas) => gravar(() => db.noites.update(id, mudancas)),

    listarComandas: (noiteId) => db.comandas.where('noiteId').equals(noiteId).sortBy('criadaEm'),
    listarTodasComandas: () => db.comandas.toArray(),
    salvarComanda: (comanda) => gravar(() => db.comandas.put(comanda)),
    excluirComanda: (id) => gravar(() => db.comandas.delete(id)),
    sugerirArea: async (codigo) => areaSugerida(codigo, await db.comandas.toArray()),

    listarAreas: async () =>
      (await db.areas.toArray()).sort((a, b) => a.taxa - b.taxa || a.nome.localeCompare(b.nome)),
    salvarArea: (area) => gravar(() => db.areas.put(area)),

    obterAjustes: async () => (await db.ajustes.get('padrao')) ?? AJUSTES_PADRAO,
    salvarAjustes: (ajustes) => gravar(() => db.ajustes.put(ajustes)),

    obterAcerto: async () => null,
    listarAcertos: async () => [],

    lerTudo: () =>
      db.transaction('r', [db.noites, db.comandas, db.areas, db.ajustes], async () => ({
        noites: await db.noites.toArray(),
        comandas: await db.comandas.toArray(),
        areas: await db.areas.toArray(),
        ajustes: (await db.ajustes.get('padrao')) ?? AJUSTES_PADRAO,
      })),
    substituirTudo: (dados) =>
      gravar(() =>
        db.transaction('rw', [db.noites, db.comandas, db.areas, db.ajustes], async () => {
          await Promise.all([db.noites.clear(), db.comandas.clear(), db.areas.clear(), db.ajustes.clear()])
          await db.noites.bulkAdd(dados.noites)
          await db.comandas.bulkAdd(dados.comandas)
          await db.areas.bulkAdd(dados.areas)
          await db.ajustes.add(dados.ajustes)
        }),
      ),

    aoMudar(ouvinte) {
      ouvintes.add(ouvinte)
      return () => ouvintes.delete(ouvinte)
    },
  }
}
