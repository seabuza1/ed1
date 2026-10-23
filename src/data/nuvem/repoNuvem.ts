// Local-first: toda alteração grava no IndexedDB do aparelho e entra numa fila, na mesma
// transação. A fila sobe para o Supabase quando há internet; o que muda na nuvem (o Luan
// marcando Pix, papel, confirmando o acerto) desce pelo realtime e a cada sincronização.
//
// Conflitos: cada alteração sobe só com as colunas que mudaram, então o motoboy marcando
// "entregue" não desfaz o "Pix caiu" do Luan na mesma comanda. Na mesma coluna vale a
// última alteração enviada; a coluna que volta ao valor de antes (marcou e desmarcou) não sobe.
// O que ainda está na fila tem prioridade sobre o que desce. A exclusão espera o Desfazer.
//
// Fotos das comandas (leitura): ficam no aparelho e sobem ao Storage numa fila própria, depois
// que a comanda subiu, para não travar a fila das alterações. Sem internet na hora da foto, a
// leitura é feita quando ela volta e vira só conferência (R28).
import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Dados } from '../../domain/backup'
import { areaSugerida } from '../../domain/comanda'
import { formatarData } from '../../domain/datas'
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
  /** Valor de cada coluna antes da primeira alteração na fila: a que volta a ele não sobe mais. */
  base?: Gravavel
  /** Muda quando o item é mesclado; quem enviou a versão antiga não apaga o item. */
  versao: number
  /** Excluir: quando entrou na fila. Sobe só depois do tempo do Desfazer. */
  em?: number
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
  /** IA ocupada, fora do ar ou ainda sem chave: quantas vezes ficou para depois e quando tentar de novo. */
  adiadas?: number
  proximaEm?: string
}

const MAX_TENTATIVAS = 3
// Adiada: espera 2, 4, 8... até 60 min entre as tentativas e desiste na 8ª (umas 3 horas).
const MAX_ADIADAS = 8
const esperaAdiada = (n: number) => Math.min(2 ** n, 60) * 60_000
const DIA = 24 * 60 * 60 * 1000
const MARGEM_CURSOR = 2 * 60_000

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
  /** Lê as fotos pendentes (R28). A sincronização já chama sem esperar; os testes esperam. */
  lerFotos(): Promise<void>
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
  /**
   * Dono da sessão do Supabase agora (o localStorage é dividido entre abas: outra conta pode ter
   * entrado). Sem ser o dono deste banco, não sincroniza: a nuvem recusaria e a fila se perderia.
   */
  usuarioDaSessao?: () => Promise<string | null>
  /** Quanto a exclusão espera antes de subir (o Desfazer dura 5 s). */
  esperaExcluir?: number
}): RepoNuvem {
  const { usuarioId: uid, remoto } = opcoes
  const esperaExcluir = opcoes.esperaExcluir ?? 6000
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
  let estado: EstadoSync = { pendentes: 0, enviando: false, online: online(), recusa: null }

  function mudarEstado(parcial: Partial<EstadoSync>) {
    estado = { ...estado, ...parcial }
    ouvintesEstado.forEach((o) => o())
  }
  const contarPendentes = async () => mudarEstado({ pendentes: await db.fila.count(), online: online() })

  let timerEnvio: ReturnType<typeof setTimeout> | undefined
  let parado = false // depois de sair, a leitura que terminar não agenda envio
  function mudou() {
    ouvintes.forEach((o) => o())
    contarPendentes()
    if (automatico && !parado) {
      clearTimeout(timerEnvio)
      timerEnvio = setTimeout(() => sincronizar(), 300)
    }
  }

  // ---------- Fila ----------

  /** Itens pendentes de um registro. A leitura usa o id da comanda: a tabela entra na chave. */
  const pendentesDe = async (tabela: Tabela, id: string) =>
    (await db.fila.where('id').equals(id).toArray()).filter((p) => p.tabela === tabela)

  async function enfileirar(tabela: Tabela, id: string, op: ItemFila['op'], campos?: Gravavel, base?: Gravavel) {
    const pendentes = await pendentesDe(tabela, id)
    const inserir = pendentes.find((p) => p.op === 'inserir')
    if (op === 'excluir') {
      // O que estava pendente não importa mais. Exclui mesmo se o inserir não subiu:
      // ele pode estar a caminho, e excluir o que não existe não dá erro.
      await db.fila.bulkDelete(pendentes.map((p) => p.seq!))
      await db.fila.add({ tabela, id, op, versao: 1, em: Date.now() })
      return
    }
    if (op === 'inserir') {
      // Desfazer da exclusão que ainda não subiu: sobe como reenvio (upsert), sem apagar na nuvem
      // (apagar zera o "caiu" do Pix e solta a leitura da comanda).
      await db.fila.bulkDelete(pendentes.filter((p) => p.op === 'excluir').map((p) => p.seq!))
      await db.fila.add({ tabela, id, op, versao: 1 })
      return
    }
    // atualizar: com inserir pendente, ele já manda a linha atual (só avisa que mudou).
    if (inserir) return void (await db.fila.update(inserir.seq!, { versao: inserir.versao + 1 }))
    const atualizar = pendentes.find((p) => p.op === 'atualizar')
    if (!atualizar) return void (await db.fila.add({ tabela, id, op, campos, base, versao: 1 }))
    // Marcou e desmarcou sem internet: a coluna voltou ao que era e não sobe por cima da nuvem.
    // O item que está subindo agora vai inteiro de novo (a nuvem já pode ter o valor do meio).
    const juntos = { ...atualizar.campos, ...campos }
    const bases = { ...base, ...atualizar.base }
    const restantes = atualizar.base && atualizar.seq !== emEnvio ? camposAlterados(bases, juntos) : juntos
    if (Object.keys(restantes).length === 0) return void (await db.fila.delete(atualizar.seq!))
    await db.fila.update(atualizar.seq!, { campos: restantes, base: bases, versao: atualizar.versao + 1 })
  }

  async function gravar(tabela: Tabela, novo: Registro) {
    await db.transaction('rw', [local[tabela], db.fila], async () => {
      const antes = await local[tabela].get(novo.id)
      await local[tabela].put(novo)
      if (!antes) return enfileirar(tabela, novo.id, 'inserir')
      const linhaAntes = paraGravar(tabela, antes, uid)
      const campos = camposAlterados(linhaAntes, paraGravar(tabela, novo, uid))
      const base = Object.fromEntries(Object.keys(campos).map((k) => [k, linhaAntes[k]]))
      if (Object.keys(campos).length) await enfileirar(tabela, novo.id, 'atualizar', campos, base)
    })
    mudou()
  }

  let emEnvio: number | undefined

  /** Sobe a fila em ordem. Para no primeiro erro de internet; o que a nuvem recusa sai da fila. */
  async function enviar(): Promise<boolean> {
    let recusou = false
    for (;;) {
      if (parado) return recusou // saiu da conta no meio do envio: o resto espera a próxima entrada
      const pronto = (i: ItemFila) => i.op !== 'excluir' || Date.now() - (i.em ?? 0) >= esperaExcluir
      const item = await db.fila.orderBy('seq').filter(pronto).first()
      if (!item) {
        // Exclusão no tempo do Desfazer: tenta de novo quando ele acabar.
        if (automatico && !parado && (await db.fila.filter((i) => !pronto(i)).count())) {
          clearTimeout(timerEnvio)
          timerEnvio = setTimeout(() => sincronizar(), esperaExcluir)
        }
        return recusou
      }
      let enviado = false
      emEnvio = item.seq
      try {
        if (item.op === 'inserir') {
          const registro = await local[item.tabela].get(item.id)
          // Leitura de comanda que foi excluída (Desfazer sem lançar de novo): não sobe.
          const orfa =
            item.tabela === 'leituras' && !!registro && !(await db.comandas.get((registro as RegistroLeitura).comandaId ?? ''))
          if (registro && !orfa) await remoto.inserir(item.tabela, paraGravar(item.tabela, registro, uid))
        } else if (item.op === 'atualizar') await remoto.atualizar(item.tabela, item.id, item.campos ?? {})
        else await remoto.excluir(item.tabela, item.id)
        enviado = true
      } catch (e) {
        if (!(e instanceof ErroRemoto && e.permanente)) throw e
        const juntou = item.tabela === 'caixas' && item.op === 'inserir' && e.codigo === '23505' && (await juntarNoite(item.id))
        if (juntou) {
          recusou = true // baixa tudo de novo, já com a noite da nuvem
          mudarEstado({ recusa: `A noite de ${formatarData(juntou)} já estava na nuvem: as comandas deste celular foram para ela.` })
        }
        // Leitura recusada é só dado de medição: sai da fila sem aviso.
        else if (item.tabela !== 'leituras') {
          recusou = true
          mudarEstado({ recusa: `Uma alteração foi recusada pela nuvem: ${e.message}.` })
        }
      } finally {
        emEnvio = undefined
      }
      await db.transaction('rw', db.fila, async () => {
        const atual = await db.fila.get(item.seq!)
        if (atual && atual.versao === item.versao) await db.fila.delete(item.seq!)
        // Mudou enquanto subia: o que subiu é a nova base na nuvem.
        else if (atual?.base && enviado && item.op === 'atualizar')
          await db.fila.update(item.seq!, { base: { ...atual.base, ...item.campos } })
      })
      await contarPendentes()
    }
  }

  /**
   * A nuvem já tem um caixa deste motoboy na mesma data (outro aparelho, abriu antes de baixar):
   * as comandas, fotos e leituras daqui passam para ele, e a noite daqui sai. Devolve a data.
   */
  async function juntarNoite(id: string): Promise<string | null> {
    const noite = await db.noites.get(id)
    const outra = noite && (await remoto.caixas(uid)).find((c) => c.data === noite.data && c.id !== id)
    if (!outra) return null
    // O caminho da foto leva o caixa ({caixa}/{comanda}.jpg, regra do Storage).
    const caminho = (comanda: string) => `${outra.id}/${comanda}.jpg`
    await db.transaction('rw', [db.noites, db.comandas, db.fila, db.fotos, db.leituras], async () => {
      for (const c of await db.comandas.where('noiteId').equals(id).toArray()) {
        await db.comandas.put({ ...c, noiteId: outra.id, ...(c.fotoPath ? { fotoPath: caminho(c.id) } : {}) })
        if (await db.fotos.get(c.id)) await db.fotos.update(c.id, { caminho: caminho(c.id) })
      }
      for (const l of await db.leituras.where('noiteId').equals(id).toArray())
        await db.leituras.put({ ...l, noiteId: outra.id, fotoPath: caminho(l.id) })
      await db.fila.bulkDelete((await pendentesDe('caixas', id)).map((p) => p.seq!))
      await db.noites.delete(id)
      await db.noites.put(linhaParaNoite(outra))
    })
    return noite.data
  }

  // ---------- O que desce da nuvem ----------

  /** Grava a linha da nuvem, respeitando o que ainda está na fila deste aparelho. */
  async function aplicar(tabela: Tabela, linha: CaixaLinha | ComandaLinha | AreaLinha) {
    const pendentes = await pendentesDe(tabela, linha.id)
    if (pendentes.some((p) => p.op !== 'atualizar')) return
    const comLocal = comPendentes(linha, pendentes[0]?.campos)
    if (tabela === 'caixas') await db.noites.put(linhaParaNoite(comLocal as CaixaLinha))
    else if (tabela === 'comandas') await db.comandas.put(linhaParaComanda(comLocal as ComandaLinha))
    else if (tabela === 'areas') await db.areas.put(linhaParaArea(comLocal as AreaLinha))
  }

  async function removerLocal(tabela: 'caixas' | 'comandas', id: string) {
    const pendentes = await pendentesDe(tabela, id)
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
      // A comanda e o caixa precisam estar na nuvem (a regra do Storage confere o dono pelo caixa).
      const naFila = [...(await pendentesDe('comandas', f.id)), ...(await pendentesDe('caixas', c.noiteId))]
      if (naFila.some((p) => p.op === 'inserir')) continue
      try {
        await remoto.enviarFoto(f.caminho, f.jpeg)
        await db.fotos.update(f.id, { envio: 'enviada' })
      } catch (e) {
        if (!(e instanceof ErroRemoto && e.permanente)) throw e
        await db.fotos.update(f.id, { envio: 'recusada' })
      }
    }
  }

  /** R28: lê as fotos tiradas sem internet. Só registra; a comanda lançada não muda. */
  async function lerPendentes() {
    for (const f of await db.fotos.where('leitura').equals('pendente').toArray()) {
      if (f.proximaEm && Date.parse(f.proximaEm) > Date.now()) continue
      const c = await db.comandas.get(f.id)
      if (!c) continue
      // Acerto confirmado: a nuvem recusa a leitura, então nem chama a IA.
      if (await db.acertos.get(c.noiteId)) {
        await db.fotos.update(f.id, { leitura: 'falhou' })
        continue
      }
      let resposta
      try {
        resposta = await remoto.lerComanda(await paraBase64(f.jpeg))
      } catch (e) {
        if (!(e instanceof ErroRemoto)) return
        const adiar = () => {
          const adiadas = (f.adiadas ?? 0) + 1
          return db.fotos.update(
            f.id,
            adiadas >= MAX_ADIADAS
              ? { adiadas, leitura: 'falhou' }
              : { adiadas, proximaEm: new Date(Date.now() + esperaAdiada(adiadas)).toISOString() },
          )
        }
        // Sem resposta da função: sem internet, tenta na próxima. Com internet (demorou demais, a
        // conexão caiu no meio), a função pode ter chamado a IA: esta foto espera como adiada.
        // Sessão vencida (401) renova sozinha e não conta.
        if (!e.permanente && (e.status === 0 || e.status === 401)) {
          if (e.status === 0 && online()) await adiar()
          return
        }
        if (!e.permanente) {
          // A função respondeu que a IA não leu agora: esta foto espera, as outras seguem.
          await adiar()
          continue
        }
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
      mudou() // a leitura sobe no próximo envio
    }
  }

  let lendo: Promise<void> | null = null
  /** Lê as fotos pendentes fora da sincronização: a leitura leva até 30 s por foto e a fila não espera. */
  function lerFotos(): Promise<void> {
    lendo ??= lerPendentes()
      .catch(() => {}) // leitura é só medição; tenta de novo na próxima sincronização
      .finally(() => {
        lendo = null
      })
    return lendo
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
    // A hora da linha é a do início da transação, não a do commit: a alteração que terminou depois
    // da última descida pode ter hora menor que o cursor. A margem traz de novo (sem efeito) as recentes.
    const desde = cursor && new Date(Date.parse(cursor) - MARGEM_CURSOR).toISOString()
    const [perfis, areas, caixas, acertos, comandas] = await Promise.all([
      remoto.perfis(),
      remoto.areas(),
      remoto.caixas(uid),
      remoto.acertos(uid),
      remoto.comandas(uid, desde),
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
    if (opcoes.usuarioDaSessao && (await opcoes.usuarioDaSessao().catch(() => null)) !== uid) return contarPendentes()
    mudarEstado({ enviando: true, online: true })
    try {
      // Com recusa, a nuvem manda a verdade de novo (desfaz aqui o que não foi aceito).
      if (await enviar()) recarregarTudo = true
      await baixar()
      ouvintes.forEach((o) => o())
      await enviarFotos()
      void lerFotos()
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
    parado = false
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
            // Pendente com internet: a leitura ao vivo não veio (IA ocupada ou o motoboy digitou).
            // A fila espera um pouco em vez de reenviar a foto logo em seguida.
            ...('pendente' in leitura && leitura.pendente && online()
              ? { proximaEm: new Date(Date.now() + 2 * 60_000).toISOString() }
              : {}),
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
    lerFotos,
    iniciar,
    parar() {
      parado = true
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
