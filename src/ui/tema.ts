// Tema: segue o sistema por padrão, com opção manual (fica só neste aparelho).

export type Tema = 'sistema' | 'claro' | 'escuro'

const CHAVE = 'tema'

export function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE)
    return t === 'claro' || t === 'escuro' ? t : 'sistema'
  } catch {
    return 'sistema'
  }
}

export function aplicarTema(tema: Tema = lerTema()): void {
  const raiz = document.documentElement
  if (tema === 'sistema') delete raiz.dataset.tema
  else raiz.dataset.tema = tema
  const escuro = tema === 'escuro' || (tema === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#111316' : '#eef0f2')
}

export function salvarTema(tema: Tema): void {
  try {
    if (tema === 'sistema') localStorage.removeItem(CHAVE)
    else localStorage.setItem(CHAVE, tema)
  } catch {
    // sem localStorage: vale só até fechar
  }
  aplicarTema(tema)
}

/** Acompanha a troca de tema do sistema quando o tema é "sistema". */
export function acompanharSistema(): void {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema())
}
