// Local-first: toda alteração grava no IndexedDB do aparelho e entra numa fila, na mesma
// transação. A fila sobe para o Supabase quando há internet; o que muda na nuvem (o Luan
// marcando Pix, papel, confirmando o acerto) desce pelo realtime e a cada sincronização.
//
// Conflitos: cada alteração sobe só com as colunas que mudaram, então o motoboy marcando
// "entregue" não desfaz o "Pix caiu" do Luan na mesma comanda. Na mesma coluna vale a
// última alteração enviada. O que ainda está na fila tem prioridade sobre o que desce.
//
// Fotos das comandas (leitura): ficam no aparelho e sobem ao Storage numa fila própria, depois
// que a comanda subiu, para não travar a fila das alterações. Sem internet na hora da foto, a
// leitura é feita quando ela volta e vira só conferência (R28).
import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Dados } from '../../domain/backup'
import { areaSugerida } from '../../domain/comanda'
import { conferirLeitura, registroLeitura, type RegistroLeitura } from '../../domain/leitura'
import { planejarEnvioHistorico, type PlanoEnvio } from '../../domain/envioHistorico'
import { AJUSTES_PADRAO } from '../../domain/padroes'
import type { Resultado } from '../../domain/comanda'
import type { Ajustes, Area, Comanda, Noite, Perfil } from '../../domain/tipos'
import type { EstadoSync, Repo } from '../repo'
import { paraBase64 } from './base64'
import {
  camposAlterados,
  comPendentes,
  linhaParaAcerto,
  linhaParaArea,
  linhaParaComanda,
  linhaParaNoite,
  linhaParaPerfil,
  paraGravar,
  type Registro,
  type AcertoLinha,
  type AreaLinha,
  type CaixaLinha,
  type ComandaLinha,
  type Gravavel,
  type Tabela,
} from './linhas'
import { ErroRemoto, type EventoRemoto, type Remoto } from './remoto'

interface ItemFila {
  seq?: number
  tabela: Tabela
  id: string
  op: 'inserir' | 'atualizar' | 'excluir'
  campos?: Gravavel
  /** Muda quando o item é mesclado; quem enviou a versão antiga não apaga o item. */
  versao: number
}

interface Meta {
  chave: string
  valor: string | null
}

/** Foto de uma comanda (id = id da comanda), até subir e ser lida. */
interface FotoLocal {
  id: string
  caminho: string
  jpeg: Blob
  tiradaEm: string
  envio: 'pendente' | 'enviada' | 'recusada'
  /** feita: já tem leitura; pendente: ler quando houver internet (R28); falhou: a IA não leu. */
  leitura: 'feita' | 'pendente' | 'falhou'
  tentativas: number
}

const MAX_TENTATIVAS = 3
const DIA = 24 * 60 * 60 * 1000

type Banco = Dexie & {
  noites: EntityTable<Noite, 'id'>
  comandas: EntityTable<Comanda, 'id'>
  areas: EntityTable<Area, 'id'>
  ajustes: EntityTable<Ajustes, 'id'>
  acertos: EntityTable<AcertoLinha, 'caixa_id'>
  perfis: EntityTable<Perfil, 'id'>
  fila: EntityTable<ItemFila, 'seq'>
  meta: EntityTable<Meta, 'chave'>
  fotos: EntityTable<FotoLocal, 'id'>
  leituras: EntityTable<RegistroLeitura, 'id'>
}

export interface RepoNuvem extends Repo {
  sincronizar(): Promise<void>
  /** Liga a sincronização automática (internet voltou, app aberto, a cada minuto) e o realtime. */
  iniciar(): void
  parar(): void
  enviarHistorico(legado: Dados): Promise<Resultado<PlanoEnvio>>
}

export function criarRepoNuvem(opcoes: {
  nome: string
  usuarioId: string
  remoto: Remoto
  online?: () => boolean
  /** false nos testes: sem timers, a sincronização é chamada à mão. */
  automatico?: boolean
}): RepoNuvem {
  const { usuarioId: uid, remoto } = opcoes
  const online = opcoes.online ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const automatico = opcoes.automatico ?? true

  const db = new Dexie(opcoes.nome) as Banco
  db.version(1).stores({
    noites: 'id, data',
    comandas: 'id, noiteId',
    areas: 'id',
    ajustes: 'id',
    acertos: 'caixa_id',
    perfis: 'id',
    fila: '++seq, id',
    meta: 'chave',
  })
  db.version(2).stores({ fotos: 'id, envio, leitura', leituras: 'id, noiteId' })
  db.on('populate', (tx) => {
    tx.table('ajustes').add(AJUSTES_PADRAO)
  })

  const local: Record<Tabela, Table<Registro, string>> = {
    caixas: db.noites as Table<Registro, string>,
    comandas: db.comandas as Table<Registro, string>,
    areas: db.areas as Table<Registro, string>,
    leituras: db.leituras as Table<Registro, string>,
  }

  // ---------- Avisos ----------

  const ouvintes = new Set<() => void>()
  const ouvintesEstado = new Set<() => void>()
  let estado: EstadoSync = { pendentes: 0, fotos: 0, enviando: false, online: online(), recusa: null }

  function mudarEstado(parcial: Partial<EstadoSync>) {
    estado = { ...estado, ...parcial }
    ouvintesEstado.forEach((o) => o())
  }
  const contarPendentes = async () =>
    mudarEstado({
      pendentes: await db.fila.count(),
      fotos: await db.fotos.where('envio').equals('pendente').count(),
      online: online(),
    })

  let timerEnvio: ReturnType<typeof setTimeout> | undefined
  function mudou() {
    ouvintes.forEach((o) => o())
    contarPendentes()
    if (automatico) {
      clearTimeout(timerEnvio)
      timerEnvio = setTimeout(() => sincronizar(), 300)
    }
  }

  // ---------- Fila ----------

  async function enfileirar(tabela: Tabela, id: string, op: ItemFila['op'], campos?: Gravavel) {
    const pendentes = await db.fila.where('id').equals(id).toArray()
    const inserir = pendentes.find((p) => p.op === 'inserir')
    if (op === 'excluir') {
      // O que estava pendente não importa mais. Exclui mesmo se o inserir não subiu:
      // ele pode estar a caminho, e excluir o que não existe não dá erro.
      await db.fila.bulkDelete(pendentes.map((p) => p.seq!))
      await db.fila.add({ tabela, id, op, versao: 1 })
      return
    }
    if (op === 'inserir') {
      await db.fila.add({ tabela, id, op, versao: 1 })
      return
    }
    // atualizar: com inserir pendente, ele já manda a linha atual (só avisa que mudou).
    if (inserir) return void (await db.fila.update(inserir.seq!, { versao: inserir.versao + 1 }))
    const atualizar = pendentes.find((p) => p.op === 'atualizar')
    if (atualizar)
      await db.fila.update(atualizar.seq!, { campos: { ...atualizar.campos, ...campos }, versao: atualizar.versao + 1 })
    else await db.fila.add({ tabela, id, op, campos, versao: 1 })
  }

  async function gravar(tabela: Tabela, novo: Registro) {
    await db.transaction('rw', [local[tabela], db.fila], async () => {
      const antes = await local[tabela].get(novo.id)
      await local[tabela].put(novo)
      if (!antes) return enfileirar(tabela, novo.id, 'inserir')
      const campos = camposAlterados(paraGravar(tabela, antes, uid), paraGravar(tabela, novo, uid))
      if (Object.keys(campos).length) await enfileirar(tabela, novo.id, 'atualizar', campos)
    })
    mudou()
  }

  /** Sobe a fila em ordem. Para no primeiro erro de internet; o que a nuvem recusa sai da fila. */
  async function enviar(): Promise<boolean> {
    let recusou = false
    for (;;) {
      const item = await db.fila.orderBy('seq').first()
      if (!item) return recusou
      try {
        if (item.op === 'inserir') {
          const registro = await local[item.tabela].get(item.id)
          // Leitura de comanda que foi excluída (Desfazer sem lançar de novo): não sobe.
          const orfa = item.tabela === 'leituras' && !(await db.comandas.get((registro as RegistroLeitura).comandaId ?? ''))
          if (registro && !orfa) await remoto.inserir(item.tabela, paraGravar(item.tabela, registro, uid))
        } else if (item.op === 'atualizar') await remoto.atualizar(item.tabela, item.id, item.campos ?? {})
        else await remoto.excluir(item.tabela, item.id)
      } catch (e) {
        if (!(e instanceof ErroRemoto && e.permanente)) throw e
        // Leitura recusada é só dado de medição: sai da fila sem aviso.
        if (item.tabela !== 'leituras') {
          recusou = true
          mudarEstado({ recusa: `Uma alteração foi recusada pela nuvem: ${e.message}.` })
        }
      }
      await db.transaction('rw', db.fila, async () => {
        const atual = await db.fila.get(item.seq!)
        if (atual && atual.versao === item.versao) await db.fila.delete(item.seq!)
      })
      await contarPendentes()
    }
  }

  // ---------- O que desce da nuvem ----------

  /** Grava a linha da nuvem, respeitando o que ainda está na fila deste aparelho. */
  async function aplicar(tabela: Tabela, linha: CaixaLinha | ComandaLinha | AreaLinha) {
    const pendentes = await db.fila.where('id').equals(linha.id).toArray()
    if (pendentes.some((p) => p.op !== 'atualizar')) return
    const comLocal = comPendentes(linha, pendentes[0]?.campos)
    if (tabela === 'caixas') await db.noites.put(linhaParaNoite(comLocal as CaixaLinha))
    else if (tabela === 'comandas') await db.comandas.put(linhaParaComanda(comLocal as ComandaLinha))
    else if (tabela === 'areas') await db.areas.put(linhaParaArea(comLocal as AreaLinha))
  }

  async function removerLocal(tabela: 'caixas' | 'comandas', id: string) {
    const pendentes = await db.fila.where('id').equals(id).toArray()
    if (pendentes.some((p) => p.op === 'inserir')) return
    await db.fila.bulkDelete(pendentes.map((p) => p.seq!))
    if (tabela === 'comandas') return db.comandas.delete(id)
    await db.comandas.where('noiteId').equals(id).delete()
    await db.noites.delete(id)
  }

  const todasAsTabelas = () => [db.noites, db.comandas, db.areas, db.acertos, db.perfis, db.fila, db.meta]

  // ---------- Fotos ----------

  /** Sobe as fotos cuja comanda já está na nuvem (a regra do Storage confere o dono pelo caixa). */
  async function enviarFotos() {
    for (const f of await db.fotos.where('envio').equals('pendente').toArray()) {
      const c = await db.comandas.get(f.id)
      if (!c) continue // excluída; o Desfazer ainda pode trazer de volta
      const naFila = await db.fila.where('id').anyOf(f.id, c.noiteId).toArray()
      if (naFila.some((p) => p.op === 'inserir')) continue
      try {
        await remoto.enviarFoto(f.caminho, f.jpeg)
        await db.fotos.update(f.id, { envio: 'enviada' })
      } catch (e) {
        if (!(e instanceof ErroRemoto && e.permanente)) throw e
        await db.fotos.update(f.id, { envio: 'recusada' })
      }
      await contarPendentes()
    }
  }

  /** R28: lê as fotos tiradas sem internet. Só registra; a comanda lançada não muda. */
  async function lerPendentes() {
    for (const f of await db.fotos.where('leitura').equals('pendente').toArray()) {
      const c = await db.comandas.get(f.id)
      if (!c) continue
      let resposta
      try {
        resposta = await remoto.lerComanda(await paraBase64(f.jpeg))
      } catch (e) {
        if (!(e instanceof ErroRemoto && e.permanente)) throw e
        const tentativas = f.tentativas + 1
        await db.fotos.update(f.id, { tentativas, leitura: tentativas >= MAX_TENTATIVAS ? 'falhou' : 'pendente' })
        continue
      }
      const noite = await db.noites.get(c.noiteId)
      const r = conferirLeitura({ ...resposta, areas: await db.areas.toArray(), promoDesconto: noite?.promoDesconto ?? null })
      const registro = registroLeitura(resposta, r, {
        id: c.id,
        noiteId: c.noiteId,
        fotoPath: f.caminho,
        comanda: c,
        estadoFinal: null,
        segundos: null,
        corrigido: false,
        forcado: false,
        posterior: true,
        agora: new Date().toISOString(),
      })
      await db.transaction('rw', [db.leituras, db.fila, db.fotos], async () => {
        await db.leituras.put(registro)
        await enfileirar('leituras', registro.id, 'inserir')
        await db.fotos.update(f.id, { leitura: 'feita' })
      })
      ouvintes.forEach((o) => o())
    }
  }

  /** Apaga do aparelho as fotos já resolvidas há 2 dias e as de comanda excluída há 1 dia. */
  async function limparFotos() {
    const agora = Date.now()
    for (const f of await db.fotos.toArray()) {
      const idade = agora - Date.parse(f.tiradaEm)
      const resolvida = f.envio !== 'pendente' && f.leitura !== 'pendente'
      if ((resolvida && idade > 2 * DIA) || (idade > DIA && !(await db.comandas.get(f.id)))) await db.fotos.delete(f.id)
    }
  }

  let recarregarTudo = false

  async function baixar() {
    const cursor = recarregarTudo ? null : ((await db.meta.get('cursorComandas'))?.valor ?? null)
    const [perfis, areas, caixas, acertos, comandas] = await Promise.all([
      remoto.perfis(),
      remoto.areas(),
      remoto.caixas(uid),
      remoto.acertos(uid),
      remoto.comandas(uid, cursor),
    ])
    recarregarTudo = false
    await db.transaction('rw', todasAsTabelas(), async () => {
      await db.perfis.clear()
      await db.perfis.bulkPut(perfis.map(linhaParaPerfil))
      for (const a of areas) await aplicar('areas', a)
      for (const c of caixas) await aplicar('caixas', c)
      for (const c of comandas) await aplicar('comandas', c)
      await db.acertos.clear()
      await db.acertos.bulkPut(acertos)
      const ultima = Math.max(...comandas.map((c) => Date.parse(c.atualizado_em)))
      if (Number.isFinite(ultima)) await db.meta.put({ chave: 'cursorComandas', valor: new Date(ultima).toISOString() })
    })

    // Comandas apagadas na nuvem (pelo Luan) enquanto este aparelho estava sem internet:
    // confere as noites mais recentes.
    const naNuvem = new Set(caixas.map((c) => c.id))
    const recentes = (await db.noites.orderBy('data').reverse().limit(3).toArray()).filter((n) => naNuvem.has(n.id))
    const ids = new Set(await remoto.idsComandas(recentes.map((n) => n.id)))
    await db.transaction('rw', todasAsTabelas(), async () => {
      for (const n of recentes)
        for (const c of await db.comandas.where('noiteId').equals(n.id).toArray())
          if (!ids.has(c.id)) await removerLocal('comandas', c.id)
    })
  }

  async function aoEvento(e: EventoRemoto) {
    await db.transaction('rw', todasAsTabelas(), async () => {
      const nova = e.nova as Record<string, string> | null
      const antiga = e.antiga as Record<string, string> | null
      if (e.tabela === 'acertos') {
        if (e.tipo === 'DELETE') {
          if (antiga?.caixa_id) await db.acertos.delete(antiga.caixa_id)
        } else if (nova && (await db.noites.get(nova.caixa_id))) await db.acertos.put(e.nova as unknown as AcertoLinha)
        return
      }
      if (e.tipo === 'DELETE') {
        if (antiga?.id) await removerLocal(e.tabela, antiga.id)
        return
      }
      if (!nova) return
      if (e.tabela === 'caixas' && nova.motoboy_id === uid) await aplicar('caixas', e.nova as unknown as CaixaLinha)
      if (e.tabela === 'comandas' && (await db.noites.get(nova.caixa_id)))
        await aplicar('comandas', e.nova as unknown as ComandaLinha)
    })
    ouvintes.forEach((o) => o())
  }

  // ---------- Sincronização ----------

  let rodando: Promise<void> | null = null
  let deNovo = false

  async function umaVez() {
    if (!online()) return contarPendentes() // também marca offline
    mudarEstado({ enviando: true, online: true })
    try {
      // Com recusa, a nuvem manda a verdade de novo (desfaz aqui o que não foi aceito).
      if (await enviar()) recarregarTudo = true
      await baixar()
      ouvintes.forEach((o) => o())
      await enviarFotos()
      await lerPendentes()
      if (await enviar()) recarregarTudo = true // as leituras feitas agora
      await limparFotos()
    } catch (e) {
      if (!(e instanceof ErroRemoto) && !(e instanceof TypeError)) throw e
      // Sem internet ou nuvem fora do ar: a fila espera a próxima tentativa.
    } finally {
      mudarEstado({ enviando: false })
      await contarPendentes()
    }
  }

  function sincronizar(): Promise<void> {
    if (rodando) {
      deNovo = true
      return rodando
    }
    rodando = (async () => {
      do {
        deNovo = false
        await umaVez()
      } while (deNovo)
    })().finally(() => {
      rodando = null
    })
    return rodando
  }

  let desligar: (() => void)[] = []

  function iniciar() {
    const sinc = () => void sincronizar().catch(() => {})
    desligar = [remoto.ouvir((e) => void aoEvento(e).catch(() => {}))]
    if (automatico) {
      const aoVoltar = () => document.visibilityState === 'visible' && sinc()
      const aoMudarRede = () => (mudarEstado({ online: online() }), sinc())
      window.addEventListener('online', aoMudarRede)
      window.addEventListener('offline', aoMudarRede)
      document.addEventListener('visibilitychange', aoVoltar)
      const intervalo = setInterval(sinc, 60_000)
      desligar.push(
        () => window.removeEventListener('online', aoMudarRede),
        () => window.removeEventListener('offline', aoMudarRede),
        () => document.removeEventListener('visibilitychange', aoVoltar),
        () => clearInterval(intervalo),
      )
    }
    sinc()
  }

  // ---------- Repo ----------

  return {
    nuvem: true,
    sync: {
      obter: () => estado,
      aoMudar(o) {
        ouvintesEstado.add(o)
        return () => ouvintesEstado.delete(o)
      },
      sincronizar,
      limparRecusa: () => mudarEstado({ recusa: null }),
    },

    listarNoites: () => db.noites.toArray(),
    salvarNoite: (noite) => gravar('caixas', noite),
    async atualizarNoite(id, mudancas) {
      const atual = await db.noites.get(id)
      if (atual) await gravar('caixas', { ...atual, ...mudancas })
    },

    listarComandas: (noiteId) => db.comandas.where('noiteId').equals(noiteId).sortBy('criadaEm'),
    listarTodasComandas: () => db.comandas.toArray(),
    salvarComanda: (comanda) => gravar('comandas', comanda),
    async excluirComanda(id) {
      await db.transaction('rw', [db.comandas, db.fila], async () => {
        await db.comandas.delete(id)
        await enfileirar('comandas', id, 'excluir')
      })
      mudou()
    },
    async sugerirArea(codigo) {
      const aqui = areaSugerida(codigo, await db.comandas.toArray())
      if (aqui || !online()) return aqui
      try {
        return await remoto.areaDoCodigo(codigo)
      } catch {
        return null
      }
    },

    listarAreas: async () =>
      (await db.areas.toArray()).sort((a, b) => a.taxa - b.taxa || a.nome.localeCompare(b.nome)),
    salvarArea: (area) => gravar('areas', area),

    obterAjustes: async () => (await db.ajustes.get('padrao')) ?? AJUSTES_PADRAO,
    async salvarAjustes(ajustes) {
      await db.ajustes.put(ajustes) // só deste aparelho
      ouvintes.forEach((o) => o())
    },

    async obterAcerto(noiteId) {
      const linha = await db.acertos.get(noiteId)
      if (!linha) return null
      return linhaParaAcerto(linha, (await db.perfis.get(linha.confirmado_por))?.nome ?? null)
    },
    async listarAcertos() {
      const nomes = new Map((await db.perfis.toArray()).map((p) => [p.id, p.nome]))
      return (await db.acertos.toArray()).map((l) => linhaParaAcerto(l, nomes.get(l.confirmado_por) ?? null))
    },

    fotos: {
      ler: (imagem, sinal) => remoto.lerComanda(imagem, sinal),
      async lancar(comanda, jpeg, leitura) {
        await db.transaction('rw', [db.comandas, db.fila, db.fotos, db.leituras], async () => {
          await db.comandas.put(comanda)
          await enfileirar('comandas', comanda.id, 'inserir')
          await db.fotos.put({
            id: comanda.id,
            caminho: comanda.fotoPath ?? `${comanda.noiteId}/${comanda.id}.jpg`,
            jpeg,
            tiradaEm: new Date().toISOString(),
            envio: 'pendente',
            leitura: 'registro' in leitura ? 'feita' : leitura.pendente ? 'pendente' : 'falhou',
            tentativas: 0,
          })
          if ('registro' in leitura) {
            await db.leituras.put(leitura.registro)
            await enfileirar('leituras', leitura.registro.id, 'inserir')
          }
        })
        mudou()
      },
      async url(comanda) {
        const f = await db.fotos.get(comanda.id)
        if (f) return URL.createObjectURL(f.jpeg)
        if (!comanda.fotoPath) throw new ErroRemoto('Esta comanda não tem foto.', true)
        return remoto.urlFoto(comanda.fotoPath)
      },
      leituras: (noiteId) => db.leituras.where('noiteId').equals(noiteId).toArray(),
    },

    lerTudo: () =>
      db.transaction('r', [db.noites, db.comandas, db.areas, db.ajustes], async () => ({
        noites: await db.noites.toArray(),
        comandas: await db.comandas.toArray(),
        areas: await db.areas.toArray(),
        ajustes: (await db.ajustes.get('padrao')) ?? AJUSTES_PADRAO,
      })),
    substituirTudo: async () => {
      throw new Error('Com a nuvem, os dados vêm de lá; importar backup não está disponível.')
    },

    aoMudar(ouvinte) {
      ouvintes.add(ouvinte)
      return () => ouvintes.delete(ouvinte)
    },

    sincronizar,
    iniciar,
    parar() {
      desligar.forEach((d) => d())
      desligar = []
      clearTimeout(timerEnvio)
    },

    async enviarHistorico(legado) {
      const plano = planejarEnvioHistorico(
        legado,
        { areas: await db.areas.toArray(), noites: await db.noites.toArray() },
        new Date().toISOString(),
      )
      if (!plano.ok) return plano
      // Caixas antes das comandas: a fila sobe em ordem.
      await db.transaction('rw', [db.noites, db.comandas, db.fila], async () => {
        for (const n of plano.valor.noites) {
          await db.noites.put(n)
          await enfileirar('caixas', n.id, 'inserir')
        }
        for (const c of plano.valor.comandas) {
          await db.comandas.put(c)
          await enfileirar('comandas', c.id, 'inserir')
        }
      })
      mudou()
      return plano
    },
  }
}
