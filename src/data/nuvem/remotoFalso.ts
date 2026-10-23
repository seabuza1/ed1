// Nuvem falsa, em memória, para os testes da sincronização. Imita as regras do
// supabase/001_schema.sql que importam ao app: caixa travado depois do acerto, comanda
// precisa do caixa, um caixa por motoboy e data, atualizado_em dado pelo banco, e o "caiu" do
// Pix só pela equipe (006 e 010).
import type { RespostaLeitura } from '../../domain/leitura'
import type { AcertoLinha, AreaLinha, CaixaLinha, ComandaLinha, Gravavel, PerfilLinha, Tabela } from './linhas'
import { ErroRemoto, type EventoRemoto, type Remoto } from './remoto'

export function criarRemotoFalso() {
  let relogio = Date.parse('2026-10-16T21:00:00Z')
  const agora = () => new Date((relogio += 1000)).toISOString()

  const perfis = new Map<string, PerfilLinha>()
  const areas = new Map<string, AreaLinha>()
  const caixas = new Map<string, CaixaLinha>()
  const comandas = new Map<string, ComandaLinha>()
  const acertos = new Map<string, AcertoLinha>()
  const leituras = new Map<string, Gravavel>()
  const fotos = new Map<string, Blob>()
  const ouvintes = new Set<(e: EventoRemoto) => void>()

  const estado = {
    offline: false,
    chamadas: 0,
    /** O que a IA devolve no próximo lerComanda. Com `fora`, a falha é passageira (tenta de novo). */
    ia: { erro: 'sem resposta configurada' } as RespostaLeitura | { erro: string; fora?: boolean },
    leiturasIA: 0,
  }

  function rede() {
    estado.chamadas++
    if (estado.offline) throw new ErroRemoto('Failed to fetch', false)
  }
  const recusa = (motivo: string) => new ErroRemoto(motivo, true)
  const travado = (caixaId: string) => acertos.has(caixaId)
  const avisar = (e: EventoRemoto) => ouvintes.forEach((o) => o(structuredClone(e)))
  const copia = <T>(x: T): T => structuredClone(x)
  const pixAntecipado = (l: Gravavel | undefined) =>
    ((l?.pagamentos ?? []) as { forma: string; valor: number }[]).reduce((s, p) => s + (p.forma === 'pix_antecipado' ? p.valor : 0), 0)
  /** O app escreve como motoboy: a comanda nova vem sem o "caiu"; a existente o mantém se o Pix não mudou. */
  const pixDaEquipe = (antes: Gravavel | undefined, nova: Gravavel) =>
    ({ ...nova, pix_confirmado: antes?.pix_confirmado === true && pixAntecipado(antes) === pixAntecipado(nova) })

  const remoto: Remoto = {
    perfis: async () => (rede(), [...perfis.values()].map(copia)),
    areas: async () => (rede(), [...areas.values()].map(copia)),
    caixas: async (m) => (rede(), [...caixas.values()].filter((c) => c.motoboy_id === m).map(copia)),
    comandas: async (m, desde) => {
      rede()
      return [...comandas.values()]
        .filter((c) => caixas.get(c.caixa_id)?.motoboy_id === m && (!desde || c.atualizado_em >= desde))
        .map(copia)
    },
    idsComandas: async (ids) => (rede(), [...comandas.values()].filter((c) => ids.includes(c.caixa_id)).map((c) => c.id)),
    acertos: async (m) => (rede(), [...acertos.values()].filter((a) => caixas.get(a.caixa_id)?.motoboy_id === m).map(copia)),
    areaDoCodigo: async (codigo) => {
      rede()
      const ultima = [...comandas.values()].filter((c) => c.codigo === codigo).sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0]
      return ultima?.area_id ?? null
    },

    async inserir(tabela: Tabela, linha: Gravavel) {
      rede()
      const id = linha.id as string
      if (tabela === 'areas') return void areas.set(id, copia(linha) as unknown as AreaLinha)
      if (tabela === 'caixas') {
        const existente = caixas.get(id)
        if (existente && travado(id)) throw recusa('sem permissão')
        if ([...caixas.values()].some((c) => c.id !== id && c.motoboy_id === linha.motoboy_id && c.data === linha.data))
          throw new ErroRemoto('já existe um registro igual na nuvem', true, 409, '23505')
        const nova = {
          ordem_chegada: [...caixas.values()].filter((c) => c.data === linha.data).length + 1,
          criado_em: agora(),
          ...existente,
          ...copia(linha),
          atualizado_em: agora(),
        } as CaixaLinha
        caixas.set(id, nova)
        return avisar({ tabela, tipo: existente ? 'UPDATE' : 'INSERT', nova: copia(nova) as never, antiga: null })
      }
      const caixaId = linha.caixa_id as string
      if (!caixas.has(caixaId)) throw recusa('falta o registro ligado a este na nuvem')
      if (travado(caixaId)) throw recusa('sem permissão')
      if (tabela === 'leituras') {
        if (linha.comanda_id && !comandas.has(linha.comanda_id as string)) throw recusa('falta o registro ligado a este na nuvem')
        return void leituras.set(id, copia(linha))
      }
      const existente = comandas.get(id)
      const nova = pixDaEquipe(existente as Gravavel | undefined, { ...existente, ...copia(linha), atualizado_em: agora() }) as unknown as ComandaLinha
      comandas.set(id, nova)
      avisar({ tabela, tipo: existente ? 'UPDATE' : 'INSERT', nova: copia(nova) as never, antiga: null })
    },
    async atualizar(tabela: Tabela, id: string, campos: Gravavel) {
      rede()
      const mapa = (tabela === 'caixas' ? caixas : tabela === 'comandas' ? comandas : areas) as unknown as Map<string, Gravavel>
      const atual = mapa.get(id)
      const caixaId = tabela === 'caixas' ? id : (atual?.caixa_id as string)
      if (!atual || (tabela !== 'areas' && travado(caixaId))) throw recusa('sem permissão')
      const junta = { ...atual, ...copia(campos), atualizado_em: agora() }
      const nova = tabela === 'comandas' ? pixDaEquipe(atual, junta) : junta
      mapa.set(id, nova)
      if (tabela === 'caixas' || tabela === 'comandas') avisar({ tabela, tipo: 'UPDATE', nova: copia(nova), antiga: null })
    },
    async excluir(tabela: Tabela, id: string) {
      rede()
      if (tabela === 'comandas') {
        const atual = comandas.get(id)
        if (atual && travado(atual.caixa_id)) throw recusa('sem permissão')
        if (comandas.delete(id)) avisar({ tabela, tipo: 'DELETE', nova: null, antiga: { id } })
      }
    },
    ouvir(aoEvento) {
      ouvintes.add(aoEvento)
      return () => ouvintes.delete(aoEvento)
    },

    async enviarFoto(caminho, jpeg) {
      rede()
      const caixaId = caminho.split('/')[0]
      if (!caixas.has(caixaId) || travado(caixaId)) throw recusa('sem permissão')
      if (!fotos.has(caminho)) fotos.set(caminho, jpeg)
    },
    async urlFoto(caminho) {
      rede()
      if (!fotos.has(caminho)) throw new ErroRemoto('A foto ainda não chegou na nuvem.', false)
      return `nuvem://${caminho}`
    },
    async lerComanda() {
      rede()
      estado.leiturasIA++
      const r = estado.ia
      // Como a função: 503 quando a IA está fora; 200 com { erro } quando não leu.
      if ('erro' in r) throw new ErroRemoto(r.erro, !r.fora, r.fora ? 503 : 200)
      return copia(r)
    },
  }

  /** O que o Luan (ou o admin) faz pelo painel, direto na nuvem. */
  const equipe = {
    marcar(id: string, campos: Partial<ComandaLinha>) {
      const nova = { ...comandas.get(id)!, ...campos, atualizado_em: agora() }
      comandas.set(id, nova)
      avisar({ tabela: 'comandas', tipo: 'UPDATE', nova: copia(nova) as never, antiga: null })
    },
    apagarComanda(id: string) {
      comandas.delete(id)
      avisar({ tabela: 'comandas', tipo: 'DELETE', nova: null, antiga: { id } })
    },
    confirmar(caixaId: string, confirmadoPor: string) {
      const a: AcertoLinha = {
        caixa_id: caixaId,
        confirmado_por: confirmadoPor,
        confirmado_em: agora(),
        dinheiro_contado: 0,
        falta: 0,
        sobra: 0,
        pago_ao_motoboy: 0,
        pago_do_caixa_dele: 0,
        retirado_caixa_empresa: 0,
        vai_para_empresa: 0,
        completado_do_bolso: 0,
        obs: '',
      }
      acertos.set(caixaId, a)
      avisar({ tabela: 'acertos', tipo: 'INSERT', nova: copia(a) as never, antiga: null })
    },
    reabrir(caixaId: string) {
      acertos.delete(caixaId)
      avisar({ tabela: 'acertos', tipo: 'DELETE', nova: null, antiga: { caixa_id: caixaId } })
    },
  }

  return { remoto, estado, perfis, areas, caixas, comandas, acertos, leituras, fotos, equipe }
}
