// "Enviar meu histórico para a nuvem": as noites da versão local viram caixas.
import type { Dados } from './backup'
import type { Resultado } from './comanda'
import { formatarReais } from './dinheiro'
import type { Area, Comanda, Noite } from './tipos'

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()

/**
 * Par de cada área local na nuvem: mesmo nome; senão um nome que começa pelo outro
 * ("Barra" → "Barra do Garças"); senão a única área com a mesma taxa.
 */
export function mapearAreas(locais: Area[], nuvem: Area[]): { mapa: Map<string, string>; semPar: Area[] } {
  const mapa = new Map<string, string>()
  const semPar: Area[] = []
  for (const l of locais) {
    const nome = normalizar(l.nome)
    const unico = (lista: Area[]) => (lista.length === 1 ? lista[0] : undefined)
    const par =
      nuvem.find((n) => normalizar(n.nome) === nome) ??
      unico(nuvem.filter((n) => normalizar(n.nome).startsWith(nome + ' ') || nome.startsWith(normalizar(n.nome) + ' '))) ??
      unico(nuvem.filter((n) => n.taxa === l.taxa))
    if (par) mapa.set(l.id, par.id)
    else semPar.push(l)
  }
  return { mapa, semPar }
}

/** A comparação com o Luan da versão local vai para a observação do caixa. */
export function obsComLuan(n: Noite): string {
  const partes: string[] = []
  if (n.luanPagou !== null) partes.push(`Luan pagou ${formatarReais(n.luanPagou)}`)
  if (n.luanDiferenca !== null)
    partes.push(
      n.luanDiferenca === 0
        ? 'bateu'
        : `${n.luanDiferenca < 0 ? 'faltou' : 'sobrou'} ${formatarReais(Math.abs(n.luanDiferenca))}`,
    )
  if (n.minutosAcerto !== null) partes.push(`acerto em ${n.minutosAcerto} min`)
  const luan = partes.length ? `Acerto com o Luan (versão local): ${partes.join(' · ')}` : ''
  return [n.obs.trim(), luan].filter(Boolean).join('\n')
}

export interface PlanoEnvio {
  noites: Noite[]
  comandas: Comanda[]
  /** Datas que já têm caixa na nuvem (um caixa por motoboy e data). */
  puladas: string[]
}

export function planejarEnvioHistorico(
  legado: Dados,
  nuvem: { areas: Area[]; noites: Noite[] },
  agora: string,
): Resultado<PlanoEnvio> {
  const usadas = new Set(legado.comandas.map((c) => c.areaId))
  const areasUsadas = legado.areas.filter((a) => usadas.has(a.id))
  if (areasUsadas.length < usadas.size) return { ok: false, erro: 'Tem comanda com área que não existe mais.' }
  const { mapa, semPar } = mapearAreas(areasUsadas, nuvem.areas)
  if (semPar.length)
    return {
      ok: false,
      erro: `Sem área igual na nuvem: ${semPar.map((a) => a.nome).join(', ')}. Peça para a expedição criar.`,
    }

  const datas = new Set(nuvem.noites.map((n) => n.data))
  const temAbertaNaNuvem = nuvem.noites.some((n) => n.fechadaEm === null)
  const enviar = legado.noites.filter((n) => !datas.has(n.data))
  const ids = new Set(enviar.map((n) => n.id))
  return {
    ok: true,
    valor: {
      noites: enviar.map((n) => ({
        ...n,
        obs: obsComLuan(n),
        luanPagou: null,
        luanDiferenca: null,
        minutosAcerto: null,
        // Uma noite aberta por vez: se já tem uma aberta na nuvem, a antiga sobe fechada.
        fechadaEm: n.fechadaEm ?? (temAbertaNaNuvem ? agora : null),
      })),
      comandas: legado.comandas.filter((c) => ids.has(c.noiteId)).map((c) => ({ ...c, areaId: mapa.get(c.areaId)! })),
      puladas: legado.noites.filter((n) => datas.has(n.data)).map((n) => n.data),
    },
  }
}
