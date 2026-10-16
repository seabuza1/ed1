// O que o app pede à nuvem. A implementação real é com o supabase-js; nos testes, uma
// nuvem falsa em memória (remotoFalso.ts).
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { AcertoLinha, AreaLinha, CaixaLinha, ComandaLinha, Gravavel, PerfilLinha, Tabela } from './linhas'

/** permanente = a nuvem recusou (não adianta tentar de novo); senão é falta de internet. */
export class ErroRemoto extends Error {
  readonly permanente: boolean
  constructor(mensagem: string, permanente: boolean) {
    super(mensagem)
    this.permanente = permanente
  }
}

export interface EventoRemoto {
  tabela: 'caixas' | 'comandas' | 'acertos'
  tipo: 'INSERT' | 'UPDATE' | 'DELETE'
  nova: Record<string, unknown> | null
  antiga: Record<string, unknown> | null
}

export interface Remoto {
  perfis(): Promise<PerfilLinha[]>
  areas(): Promise<AreaLinha[]>
  /** Caixas do motoboy (o admin vê todos pela regra de acesso; aqui só os dele). */
  caixas(motoboyId: string): Promise<CaixaLinha[]>
  /** Comandas dos caixas do motoboy alteradas desde o instante (todas se null). */
  comandas(motoboyId: string, desde: string | null): Promise<ComandaLinha[]>
  idsComandas(caixaIds: string[]): Promise<string[]>
  acertos(motoboyId: string): Promise<AcertoLinha[]>
  /** Área do último pedido com o código na pizzaria toda (função area_do_codigo). */
  areaDoCodigo(codigo: string): Promise<string | null>

  /** Insere ou, se já existe (reenvio), atualiza. */
  inserir(tabela: Tabela, linha: Gravavel): Promise<void>
  /** Atualiza só as colunas informadas; recusa se a linha não puder ser alterada. */
  atualizar(tabela: Tabela, id: string, campos: Gravavel): Promise<void>
  excluir(tabela: Tabela, id: string): Promise<void>

  /** Realtime em caixas, comandas e acertos. Devolve a função que para de ouvir. */
  ouvir(aoEvento: (e: EventoRemoto) => void): () => void
}

const MOTIVOS: Record<string, string> = {
  '42501': 'sem permissão (o acerto pode já ter sido confirmado)',
  '23505': 'já existe um registro igual na nuvem (ex.: noite com a mesma data)',
  '23503': 'falta o registro ligado a este na nuvem',
  '23514': 'valores recusados pela nuvem',
}

type Resposta<T> = { data: T | null; error: PostgrestError | null; status: number }

function verificar<T>(r: Resposta<T>): T {
  if (!r.error) return r.data as T
  // status 0 = sem resposta (sem internet); 401 = sessão vencida, renova sozinha.
  const transitorio = r.status === 0 || r.status === 401 || r.status === 408 || r.status === 429 || r.status >= 500
  throw new ErroRemoto(MOTIVOS[r.error.code] ?? r.error.message, !transitorio)
}

const PAGINA = 1000 // limite de linhas por pedido do Supabase

async function todas<T>(pagina: (de: number, ate: number) => PromiseLike<Resposta<T[]>>): Promise<T[]> {
  const linhas: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const parte = verificar(await pagina(de, de + PAGINA - 1)) ?? []
    linhas.push(...parte)
    if (parte.length < PAGINA) return linhas
  }
}

/** Tira a junção usada só para filtrar pelo motoboy ("caixas!inner(motoboy_id)"). */
const semJuncao = <T>(l: T & { caixas?: unknown }): T => {
  const { caixas: _, ...resto } = l
  return resto as T
}

export function criarRemotoSupabase(sb: SupabaseClient): Remoto {
  return {
    perfis: () => todas<PerfilLinha>((de, ate) => sb.from('perfis').select('id, nome, papel, ativo').order('id').range(de, ate)),
    areas: () => todas<AreaLinha>((de, ate) => sb.from('areas').select('id, nome, taxa, ativa').order('id').range(de, ate)),
    caixas: (motoboyId) =>
      todas<CaixaLinha>((de, ate) => sb.from('caixas').select('*').eq('motoboy_id', motoboyId).order('id').range(de, ate)),
    comandas: async (motoboyId, desde) => {
      const linhas = await todas<ComandaLinha>((de, ate) => {
        let q = sb.from('comandas').select('*, caixas!inner(motoboy_id)').eq('caixas.motoboy_id', motoboyId)
        if (desde) q = q.gte('atualizado_em', desde)
        return q.order('atualizado_em').order('id').range(de, ate)
      })
      return linhas.map(semJuncao)
    },
    idsComandas: async (caixaIds) => {
      if (caixaIds.length === 0) return []
      const linhas = await todas<{ id: string }>((de, ate) =>
        sb.from('comandas').select('id').in('caixa_id', caixaIds).order('id').range(de, ate),
      )
      return linhas.map((l) => l.id)
    },
    acertos: async (motoboyId) => {
      const linhas = await todas<AcertoLinha>((de, ate) =>
        sb.from('acertos').select('*, caixas!inner(motoboy_id)').eq('caixas.motoboy_id', motoboyId).order('caixa_id').range(de, ate),
      )
      return linhas.map(semJuncao)
    },
    areaDoCodigo: async (codigo) => verificar<string | null>(await sb.rpc('area_do_codigo', { c: codigo })),

    inserir: async (tabela, linha) => {
      verificar(await sb.from(tabela).upsert(linha, { onConflict: 'id' }))
    },
    atualizar: async (tabela, id, campos) => {
      const linhas = verificar(await sb.from(tabela).update(campos).eq('id', id).select('id'))
      // A regra de acesso não dá erro: só não altera nada.
      if (!linhas?.length) throw new ErroRemoto(MOTIVOS['42501'], true)
    },
    excluir: async (tabela, id) => {
      const linhas = verificar(await sb.from(tabela).delete().eq('id', id).select('id'))
      if (linhas?.length) return
      // Nada apagado: ou já não existia (tudo certo) ou a regra de acesso não deixou.
      const ainda = verificar(await sb.from(tabela).select('id').eq('id', id))
      if (ainda?.length) throw new ErroRemoto(MOTIVOS['42501'], true)
    },

    ouvir(aoEvento) {
      const canal = sb.channel(`acerto-${Math.random().toString(36).slice(2)}`)
      for (const tabela of ['caixas', 'comandas', 'acertos'] as const)
        canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, (p) =>
          aoEvento({
            tabela,
            tipo: p.eventType,
            nova: p.new && Object.keys(p.new).length ? (p.new as Record<string, unknown>) : null,
            antiga: p.old && Object.keys(p.old).length ? (p.old as Record<string, unknown>) : null,
          }),
        )
      canal.subscribe()
      return () => {
        sb.removeChannel(canal)
      }
    },
  }
}
