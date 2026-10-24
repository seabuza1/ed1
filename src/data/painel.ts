// Painel do Luan: lê e grava direto no Supabase (precisa de internet) e atualiza sozinho
// pelo realtime; a cada 20 segundos recarrega também, caso o realtime caia.
import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import type { LeituraMedida } from '../domain/medicao'
import type { AcertoParaGravar, CaixaDoMotoboy } from '../domain/painel'
import type { AcertoConfirmado, Area, Comanda, Noite, Perfil } from '../domain/tipos'
import {
  areaParaGravar,
  linhaParaAcerto,
  linhaParaArea,
  linhaParaComanda,
  linhaParaNoite,
  linhaParaLeitura,
  linhaParaPerfil,
  type AcertoLinha,
  type AreaLinha,
  type CaixaLinha,
  type ComandaLinha,
  type LeituraLinha,
  type PerfilLinha,
} from './nuvem/linhas'
import { ErroRemoto, MOTIVOS, todas, urlFotoAssinada, verificar } from './nuvem/remoto'

export interface DadosPainel {
  caixas: CaixaDoMotoboy[]
  comandas: Comanda[]
  acertos: AcertoConfirmado[]
  areas: Area[]
  /** A equipe toda (a expedição e o admin leem todos os perfis). */
  perfis: Perfil[]
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
    perfis: perfis.map(linhaParaPerfil).sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome)),
  }
}

type LeituraComCaixa = LeituraLinha & { caixas: { data: string; motoboy_id: string }; comandas: ComandaLinha | null }

/** Leituras das noites de `de` a `ate` (R27), com a noite, o motoboy e a comanda como está agora. */
export async function carregarLeituras(sb: SupabaseClient, de: string, ate: string, perfis: { id: string; nome: string }[]) {
  const linhas = await todas<LeituraComCaixa>((i, f) =>
    sb
      .from('leituras')
      .select('*, caixas!inner(data, motoboy_id), comandas(*)')
      .gte('caixas.data', de)
      .lte('caixas.data', ate)
      .order('criado_em')
      .order('id')
      .range(i, f),
  )
  const nome = new Map(perfis.map((p) => [p.id, p.nome]))
  return linhas.map(
    (l): LeituraMedida => ({
      registro: linhaParaLeitura(l),
      data: l.caixas.data,
      motoboy: nome.get(l.caixas.motoboy_id) ?? 'Motoboy',
      atual: l.comandas ? linhaParaComanda(l.comandas) : null,
    }),
  )
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

  /** Áreas e taxas (expedição e admin); os celulares recebem na próxima sincronização. */
  async salvarArea(area: Area) {
    verificar(await sb.from('areas').upsert(areaParaGravar(area)))
  },

  urlDaFoto: (caminho: string) => urlFotoAssinada(sb, caminho, 'A foto ainda não chegou do celular do motoboy.'),

  /** Só o admin (regra de acesso perfis_admin). */
  mudarPerfil: (p: Perfil) => atualizar(sb, 'perfis', 'id', p.id, { papel: p.papel, ativo: p.ativo }),

  /**
   * R15: grava os valores do momento, trava o caixa e fecha a noite se o motoboy não fechou, tudo de
   * uma vez no banco (011). Se o motoboy mudou o caixa ou as comandas depois do que o Luan viu, não
   * grava e pede para conferir de novo.
   */
  async confirmarAcerto(a: AcertoParaGravar, visto: { noite: Noite; comandas: Comanda[] }) {
    const ultima = visto.comandas.reduce<string | null>((m, c) => (!m || c.atualizadaEm > m ? c.atualizadaEm : m), null)
    const r = verificar<string>(
      await sb.rpc('confirmar_acerto', {
        p_caixa: a.caixaId,
        p_comandas: visto.comandas.length,
        p_ultima_alteracao: ultima,
        p_caixa_inicial: visto.noite.caixaInicial,
        p_diaria: visto.noite.diaria,
        p_dinheiro_contado: a.dinheiroContado,
        p_falta: a.falta,
        p_sobra: a.sobra,
        p_pago_ao_motoboy: a.pagoAoMotoboy,
        p_pago_do_caixa_dele: a.pagoDoCaixaDele,
        p_retirado_caixa_empresa: a.retiradoCaixaEmpresa,
        p_vai_para_empresa: a.vaiParaEmpresa,
        p_completado_do_bolso: a.completadoDoBolso,
      }),
    )
    if (r === 'mudou')
      throw new ErroRemoto('o motoboy mudou o caixa enquanto você conferia. Confira de novo e confirme.', true)
    if (r === 'já confirmado') throw new ErroRemoto('este acerto já foi confirmado.', true)
    if (r !== 'ok') throw new ErroRemoto('caixa não encontrado.', true)
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
