import { useEffect, useState } from 'react'
import App from './App'
import { ehEquipe, useSessao } from './data/sessao'
import { supabase } from './data/supabase'
import { Painel } from './telas/Painel'
import { TelaEntrar } from './telas/TelaEntrar'
import { escolherModo, lerModo, salvarModo, type Modo } from './ui/modo'

const telaLarga = () => matchMedia('(min-width: 900px)').matches

/**
 * Sem nuvem configurada, o app é só do aparelho; com nuvem, precisa entrar.
 * /painel é da expedição e do admin; a expedição cai direto nele e o admin troca pela aba.
 */
export function Raiz() {
  const sessao = useSessao()
  const [caminho, setCaminho] = useState(location.pathname)
  // Medida uma vez: redimensionar a janela não troca de tela no meio do uso.
  const [larga] = useState(telaLarga)
  // O modo salvo vale só ao abrir o app; depois, Voltar e Avançar seguem o endereço.
  const [inicial, setInicial] = useState(true)

  useEffect(() => {
    const aoVoltar = () => {
      setInicial(false)
      setCaminho(location.pathname)
      // O próximo início abre onde o Voltar deixou (só pesa para o admin).
      salvarModo(location.pathname.startsWith('/painel') ? 'painel' : 'app')
    }
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])

  if (!supabase) return <App />
  if (sessao.fase === 'carregando') return <p className="carregando">Carregando…</p>
  if (sessao.fase === 'fora') return <TelaEntrar />
  const u = sessao.usuario
  if (!ehEquipe(u)) return <App key={u.id} />

  const modo = escolherModo({ caminho, papel: u.papel, telaLarga: larga, salvo: inicial ? lerModo() : 'app' })
  const ir = (destino: Modo) => {
    const novo = destino === 'painel' ? '/painel' : '/'
    salvarModo(destino)
    if (location.pathname !== novo) history.pushState(null, '', novo)
    setInicial(false)
    setCaminho(novo)
    window.scrollTo(0, 0)
  }
  if (modo === 'painel')
    return <Painel key={u.id} sb={supabase} usuario={u} abrirApp={u.papel === 'admin' ? () => ir('app') : undefined} />
  return <App key={u.id} abrirPainel={() => ir('painel')} />
}
