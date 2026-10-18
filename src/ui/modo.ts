// Quem é da equipe usa o app do motoboy e o painel. O painel tem a rota /painel; em "/", o
// admin volta para onde estava neste aparelho e, na primeira vez, o computador abre o painel.
import type { Papel } from '../domain/tipos'

export type Modo = 'app' | 'painel'

const CHAVE = 'modo'

export function escolherModo(e: { caminho: string; papel: Papel; telaLarga: boolean; salvo: Modo | null }): Modo {
  if (e.papel === 'motoboy') return 'app'
  if (e.papel === 'expedicao' || e.caminho.startsWith('/painel')) return 'painel'
  return e.salvo ?? (e.telaLarga ? 'painel' : 'app')
}

export function lerModo(): Modo | null {
  try {
    const m = localStorage.getItem(CHAVE)
    return m === 'app' || m === 'painel' ? m : null
  } catch {
    return null
  }
}

export function salvarModo(modo: Modo): void {
  try {
    localStorage.setItem(CHAVE, modo)
  } catch {
    // sem localStorage: vale só até fechar
  }
}
