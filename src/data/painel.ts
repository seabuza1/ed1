// Painel do Luan: lê e grava direto no Supabase (precisa de internet) e atualiza sozinho
// pelo realtime; a cada 20 segundos recarrega também, caso o realtime caia.
import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import type { AcertoParaGravar, CaixaDoMotoboy } from '../domain/painel'
import type { AcertoConfirmado, Area, Comanda } from '../domain/tipos'
import {
  linhaParaAcerto,
  linhaParaArea,
  linhaParaComanda,
  linhaParaNoite,
  type AcertoLinha,
  type AreaLinha,
  type CaixaLinha,
  type ComandaLinha,
  type PerfilLinha,
} from './nuvem/linhas'
import { ErroRemoto, MOTIVOS, verificar } from './nuvem/remoto'

export interface DadosPainel {
  caixas: CaixaDoMotoboy[]
  comandas: Comanda[]
  acertos: AcertoConfirmado[]
  areas: Area[]
}

export async function carregarPainel(sb: SupabaseClient, data: string): Promise<DadosPainel> {
  const [caixas, perfis, areas] = await Promise.all([
    sb.from('caixas').select('*').eq('data', data).then((r) => verificar<CaixaLinha[]>(r)),
    sb.from('perfis').select('id, nome, papel, ativo').then((r) => verificar<PerfilLinha[]>(r)),
    sb.from('areas').select('id, nome, taxa, ativa').then((r) => verificar<AreaLinha[]>(r)),
  ])
  const ids = caixas.map((c) => c.id)
  const [comandas, acertos] = ids.length
    ? await Promise.all([
        sb.from('comandas').select('*').in('caixa_id', ids).then((r) => verificar<ComandaLinha[]>(r)),
        sb.from('acertos').select('*').in('caixa_id', ids).then((r) => verificar<AcertoLinha[]>(r)),
      ])
    : [[], []]
  const nome = new Map(perfis.map((p) => [p.id, p.nome]))
  return {
    caixas: caixas.map((c) => ({
      noite: linhaParaNoite(c),
      motoboyId: c.motoboy_id,
      nome: nome.get(c.motoboy_id) ?? 'Motoboy',
      ordem: c.ordem_chegada,
      criadoEm: c.criado_em,
    })),
    comandas: comandas.map(linhaParaComanda),
    acertos: acertos.map((a) => linhaParaAcerto(a, nome.get(a.confirmado_por) ?? null)),
    areas: areas.map(linhaParaArea).sort((a, b) => a.taxa - b.taxa || a.nome.localeCompare(b.nome)),
  }
}

/** Atualiza só o que foi pedido; recusa se nada mudou (regra de acesso). */
async function atualizar(sb: SupabaseClient, tabela: string, coluna: string, id: string, campos: object) {
  const linhas = verificar<{ id: string }[]>(await sb.from(tabela).update(campos).eq(coluna, id).select(coluna))
  if (!linhas?.length) throw new ErroRemoto(MOTIVOS['42501'], true)
}

export const acoesPainel = (sb: SupabaseClient) => ({
  marcarPix: (comandaId: string, caiu: boolean) => atualizar(sb, 'comandas', 'id', comandaId, { pix_confirmado: caiu }),
  marcarPapel: (comandaId: string, conferido: boolean) =>
    atualizar(sb, 'comandas', 'id', comandaId, { papel_conferido: conferido }),
  registrarContado: (caixaId: string, centavos: number | null) =>
    atualizar(sb, 'caixas', 'id', caixaId, { dinheiro_contado: centavos }),

  /** R15: grava os valores do momento e trava o caixa; fecha a noite se o motoboy não fechou. */
  async confirmarAcerto(a: AcertoParaGravar) {
    verificar(
      await sb.from('acertos').insert({
        caixa_id: a.caixaId,
        dinheiro_contado: a.dinheiroContado,
        falta: a.falta,
        sobra: a.sobra,
        pago_ao_motoboy: a.pagoAoMotoboy,
        pago_do_caixa_dele: a.pagoDoCaixaDele,
        retirado_caixa_empresa: a.retiradoCaixaEmpresa,
        vai_para_empresa: a.vaiParaEmpresa,
        completado_do_bolso: a.completadoDoBolso,
      }),
    )
    verificar(await sb.from('caixas').update({ fechado_em: new Date().toISOString() }).eq('id', a.caixaId).is('fechado_em', null))
  },

  /** Só o admin: apaga o acerto e o motoboy volta a editar. */
  async reabrirAcerto(caixaId: string) {
    const linhas = verificar<{ caixa_id: string }[]>(await sb.from('acertos').delete().eq('caixa_id', caixaId).select('caixa_id'))
    if (!linhas?.length) throw new ErroRemoto('Só o admin reabre o acerto.', true)
  },
})

export function usePainel(sb: SupabaseClient, data: string) {
  const [estado, setEstado] = useState<{ dados?: DadosPainel; erro?: string; data?: string }>({})
  const [versao, setVersao] = useState(0)
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    let ativo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const carregar = () =>
      carregarPainel(sb, data).then(
        (dados) => ativo && setEstado({ dados, data }),
        (e) =>
          ativo &&
          setEstado((s) => ({
            ...s,
            erro: e instanceof ErroRemoto && !e.permanente ? 'Sem internet. Mostrando o que já tinha.' : String(e.message ?? e),
          })),
      )
    // Uma mudança costuma vir junto de outras: espera um pouco e recarrega uma vez.
    const agendar = () => {
      clearTimeout(timer)
      timer = setTimeout(carregar, 300)
    }
    carregar()
    const canal = sb.channel(`painel-${data}-${Math.random().toString(36).slice(2)}`)
    for (const table of ['caixas', 'comandas', 'acertos'])
      canal.on('postgres_changes', { event: '*', schema: 'public', table }, agendar)
    canal.subscribe()
    const intervalo = setInterval(carregar, 20_000)
    const aoVoltar = () => document.visibilityState === 'visible' && carregar()
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('online', carregar)
    return () => {
      ativo = false
      clearTimeout(timer)
      clearInterval(intervalo)
      sb.removeChannel(canal)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('online', carregar)
    }
  }, [sb, data, versao])

  // Dados de outra data não valem enquanto a nova carrega.
  return { dados: estado.data === data ? estado.dados : undefined, erro: estado.erro, recarregar }
}
