import App from './App'
import { ehEquipe, useSessao } from './data/sessao'
import { supabase } from './data/supabase'
import { Painel } from './telas/Painel'
import { TelaEntrar } from './telas/TelaEntrar'

/**
 * Sem nuvem configurada, o app é só do aparelho; com nuvem, precisa entrar.
 * /painel é da expedição e do admin; a expedição cai direto nele.
 */
export function Raiz() {
  const sessao = useSessao()
  if (!supabase) return <App />
  if (sessao.fase === 'carregando') return <p className="carregando">Carregando…</p>
  if (sessao.fase === 'fora') return <TelaEntrar />
  const u = sessao.usuario
  const querPainel = location.pathname.startsWith('/painel') || u.papel === 'expedicao'
  if (querPainel && ehEquipe(u)) return <Painel key={u.id} sb={supabase} usuario={u} />
  return <App key={u.id} />
}
