import { comHoraDeEntrega, FORMAS, type Resultado } from './comanda'
import type { Ajustes, Area, Comanda, Noite } from './tipos'

export interface Dados {
  noites: Noite[]
  comandas: Comanda[]
  areas: Area[]
  ajustes: Ajustes
}

export interface Backup extends Dados {
  app: 'acerto-motoboy'
  versao: 1
  exportadoEm: string
}

export const montarBackup = (dados: Dados, agora: string): Backup => ({
  app: 'acerto-motoboy',
  versao: 1,
  exportadoEm: agora,
  ...dados,
})

/** acerto-backup-2026-10-12-2340.json (horário do aparelho). */
export function nomeArquivoBackup(agora: Date): string {
  const d = (n: number) => n.toString().padStart(2, '0')
  return `acerto-backup-${agora.getFullYear()}-${d(agora.getMonth() + 1)}-${d(agora.getDate())}-${d(agora.getHours())}${d(agora.getMinutes())}.json`
}

export const resumoBackup = (b: Dados) =>
  `${b.noites.length} ${b.noites.length === 1 ? 'noite' : 'noites'}, ` +
  `${b.comandas.length} ${b.comandas.length === 1 ? 'comanda' : 'comandas'}, ` +
  `${b.areas.length} ${b.areas.length === 1 ? 'área' : 'áreas'}`

// Validação do arquivo importado: ele substitui tudo, então precisa estar inteiro.

type Obj = Record<string, unknown>
const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const ehTexto = (v: unknown): v is string => typeof v === 'string'
const ehCentavos = (v: unknown) => Number.isInteger(v) && (v as number) >= 0
const ehCentavosOuNulo = (v: unknown) => v === null || ehCentavos(v)
const ehInteiroOuNulo = (v: unknown) => v === null || Number.isInteger(v)

const noiteValida = (n: unknown): n is Noite =>
  ehObj(n) &&
  ehTexto(n.id) &&
  ehTexto(n.data) &&
  /^\d{4}-\d{2}-\d{2}$/.test(n.data) &&
  ehCentavos(n.caixaInicial) &&
  ehCentavos(n.diaria) &&
  ehCentavosOuNulo(n.dinheiroContado) &&
  (n.fechadaEm === null || ehTexto(n.fechadaEm)) &&
  ehCentavosOuNulo(n.luanPagou) &&
  ehInteiroOuNulo(n.luanDiferenca) &&
  ehCentavosOuNulo(n.minutosAcerto) &&
  ehTexto(n.obs)

const comandaValida = (c: unknown): c is Comanda =>
  ehObj(c) &&
  ehTexto(c.id) &&
  ehTexto(c.noiteId) &&
  ehTexto(c.codigo) &&
  ehCentavos(c.total) &&
  ehTexto(c.areaId) &&
  ehCentavos(c.taxa) &&
  ['em_rota', 'entregue', 'voltou'].includes(c.status as string) &&
  ehCentavos(c.troco) &&
  Array.isArray(c.pagamentos) &&
  c.pagamentos.every(
    (p) =>
      ehObj(p) &&
      FORMAS.includes(p.forma as never) &&
      ehCentavos(p.valor) &&
      (p.conferido === undefined || typeof p.conferido === 'boolean'),
  ) &&
  ehTexto(c.criadaEm) &&
  ehTexto(c.atualizadaEm) &&
  (c.finalizadaEm === undefined || c.finalizadaEm === null || ehTexto(c.finalizadaEm)) // ausente em backup antigo

const areaValida = (a: unknown): a is Area =>
  ehObj(a) && ehTexto(a.id) && ehTexto(a.nome) && ehCentavos(a.taxa) && typeof a.ativa === 'boolean'

const ajustesValidos = (a: unknown): a is Ajustes =>
  ehObj(a) && a.id === 'padrao' && ehCentavos(a.caixaPadrao) && ehCentavos(a.diariaPadrao)

export function lerBackup(texto: string): Resultado<Backup> {
  let b: unknown
  try {
    b = JSON.parse(texto)
  } catch {
    return { ok: false, erro: 'O arquivo não é um JSON válido.' }
  }
  if (!ehObj(b) || b.app !== 'acerto-motoboy') return { ok: false, erro: 'Não é um backup deste app.' }
  if (b.versao !== 1) return { ok: false, erro: 'Versão de backup desconhecida.' }
  if (!Array.isArray(b.noites) || !b.noites.every(noiteValida)) return { ok: false, erro: 'Backup com noite inválida.' }
  if (!Array.isArray(b.comandas) || !b.comandas.every(comandaValida))
    return { ok: false, erro: 'Backup com comanda inválida.' }
  if (!Array.isArray(b.areas) || !b.areas.every(areaValida)) return { ok: false, erro: 'Backup com área inválida.' }
  if (!ajustesValidos(b.ajustes)) return { ok: false, erro: 'Backup com ajustes inválidos.' }
  const noites = b.noites as Noite[]
  const ids = new Set(noites.map((n) => n.id))
  if ((b.comandas as Comanda[]).some((c) => !ids.has(c.noiteId)))
    return { ok: false, erro: 'Backup com comanda sem noite.' }
  if (noites.filter((n) => n.fechadaEm === null).length > 1)
    return { ok: false, erro: 'Backup com mais de uma noite aberta.' }
  const backup = b as unknown as Backup
  return { ok: true, valor: { ...backup, comandas: backup.comandas.map(comHoraDeEntrega) } }
}
