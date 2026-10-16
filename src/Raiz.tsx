import App from './App'
import { useSessao } from './data/sessao'
import { supabase } from './data/supabase'
import { TelaEntrar } from './telas/TelaEntrar'

/** Sem nuvem configurada, o app é só do aparelho; com nuvem, precisa entrar. */
export function Raiz() {
  const sessao = useSessao()
  if (!supabase) return <App />
  if (sessao.fase === 'carregando') return <p className="carregando">Carregando…</p>
  if (sessao.fase === 'fora') return <TelaEntrar />
  return <App key={sessao.usuario.id} />
}
