import type { Dados } from '../domain/backup'
import type { RegistroLeitura, RespostaLeitura } from '../domain/leitura'
import type { AcertoConfirmado, Ajustes, Area, Comanda, Noite } from '../domain/tipos'
import { criarRepoLocal } from './repoLocal'

/** Situação da sincronização com a nuvem, para o indicador discreto. */
export interface EstadoSync {
  pendentes: number // alterações esperando internet
  fotos: number // fotos de comanda esperando internet
  enviando: boolean
  online: boolean
  /** Última alteração recusada pela nuvem (ex.: acerto já confirmado). */
  recusa: string | null
}

export interface FonteSync {
  obter(): EstadoSync
  aoMudar(ouvinte: () => void): () => void
  sincronizar(): Promise<void>
  limparRecusa(): void
}

/** Fotos das comandas e leitura pela IA (só com nuvem). */
export interface FonteFotos {
  /** Lê agora (precisa de internet). Lança ErroRemoto: permanente se a IA não leu, senão falta de internet. */
  ler(imagem: string, sinal?: AbortSignal): Promise<RespostaLeitura>
  /**
   * Lança a comanda com a foto, de uma vez. Com a leitura feita, ela é registrada; sem leitura
   * por falta de internet (pendente), a foto é lida quando a internet voltar (R28).
   */
  lancar(comanda: Comanda, jpeg: Blob, leitura: { registro: RegistroLeitura } | { pendente: boolean }): Promise<void>
  /** Endereço para ver a foto: a do aparelho (blob:, revogar depois) ou um link temporário da nuvem. */
  url(comanda: Comanda): Promise<string>
  /** Leituras da noite feitas neste aparelho (para o aviso "leitura não confere"). */
  leituras(noiteId: string): Promise<RegistroLeitura[]>
}

/**
 * Acesso aos dados. As telas só falam com esta interface. Sem nuvem configurada, é o
 * IndexedDB (Dexie) do aparelho; com nuvem, o mesmo IndexedDB com uma fila que sobe
 * para o Supabase quando há internet.
 */
export interface Repo {
  readonly nuvem: boolean
  /** Só com nuvem. */
  readonly sync?: FonteSync
  /** Só com nuvem: sem ela o botão Foto não aparece e o lançamento é só à mão. */
  readonly fotos?: FonteFotos

  listarNoites(): Promise<Noite[]>
  salvarNoite(noite: Noite): Promise<void>
  /** Grava só os campos informados (evita sobrescrever o que mudou em outra gravação). */
  atualizarNoite(id: string, mudancas: Partial<Omit<Noite, 'id'>>): Promise<void>

  listarComandas(noiteId: string): Promise<Comanda[]>
  listarTodasComandas(): Promise<Comanda[]>
  salvarComanda(comanda: Comanda): Promise<void>
  excluirComanda(id: string): Promise<void>
  /** Área do último pedido com este código (para vir marcada no lançamento). */
  sugerirArea(codigo: string): Promise<string | null>

  /** Ordenadas pela taxa. */
  listarAreas(): Promise<Area[]>
  salvarArea(area: Area): Promise<void>

  obterAjustes(): Promise<Ajustes>
  salvarAjustes(ajustes: Ajustes): Promise<void>

  /** Acerto confirmado pelo Luan (só existe com nuvem). */
  obterAcerto(noiteId: string): Promise<AcertoConfirmado | null>
  listarAcertos(): Promise<AcertoConfirmado[]>

  /** Backup: tudo o que está guardado. */
  lerTudo(): Promise<Dados>
  /** Importar backup: apaga tudo e grava os dados, de uma vez só. */
  substituirTudo(dados: Dados): Promise<void>

  /** Chama o ouvinte depois de cada gravação. Devolve a função que para de ouvir. */
  aoMudar(ouvinte: () => void): () => void
}

/** Banco da versão local (e do MVP). Com nuvem, só é lido para enviar o histórico. */
export const NOME_BANCO_LOCAL = 'acerto'

let atual: Repo | null = null
const usar = () => (atual ??= criarRepoLocal(NOME_BANCO_LOCAL))
const ouvintes = new Set<() => void>()
let pararAtual: (() => void) | null = null

/** Troca a implementação (no login); as telas continuam usando `repo`. */
export function usarRepo(novo: Repo): void {
  pararAtual?.()
  atual = novo
  pararAtual = novo.aoMudar(() => ouvintes.forEach((o) => o()))
  ouvintes.forEach((o) => o())
}

export const repo: Repo = {
  get nuvem() {
    return usar().nuvem
  },
  get sync() {
    return usar().sync
  },
  get fotos() {
    return usar().fotos
  },
  listarNoites: () => usar().listarNoites(),
  salvarNoite: (n) => usar().salvarNoite(n),
  atualizarNoite: (id, m) => usar().atualizarNoite(id, m),
  listarComandas: (id) => usar().listarComandas(id),
  listarTodasComandas: () => usar().listarTodasComandas(),
  salvarComanda: (c) => usar().salvarComanda(c),
  excluirComanda: (id) => usar().excluirComanda(id),
  sugerirArea: (codigo) => usar().sugerirArea(codigo),
  listarAreas: () => usar().listarAreas(),
  salvarArea: (a) => usar().salvarArea(a),
  obterAjustes: () => usar().obterAjustes(),
  salvarAjustes: (a) => usar().salvarAjustes(a),
  obterAcerto: (id) => usar().obterAcerto(id),
  listarAcertos: () => usar().listarAcertos(),
  lerTudo: () => usar().lerTudo(),
  substituirTudo: (d) => usar().substituirTudo(d),
  aoMudar(ouvinte) {
    if (!pararAtual) usarRepo(usar())
    ouvintes.add(ouvinte)
    return () => ouvintes.delete(ouvinte)
  },
}
