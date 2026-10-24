import { useEffect } from 'react'
import { registerSW } from 'virtual:pwa-register'

// Service worker em modo autoUpdate: quando sai versão nova, ela é instalada e a página
// recarrega sozinha. Sem isso, o app instalado no celular continuava mostrando a versão
// antiga, porque reabrir só retoma a tela que já estava aberta. Com uma foto, leitura ou
// comanda pela metade, o recarregamento espera ela terminar.

let registro: ServiceWorkerRegistration | undefined
let ocupados = 0
let recarregar = false

/** Enquanto `ocupado`, a versão nova não recarrega a página (o que está na tela se perderia). */
export function useSegurarAtualizacao(ocupado: boolean): void {
  useEffect(() => {
    if (!ocupado) return
    ocupados++
    return () => {
      if (--ocupados === 0 && recarregar) location.reload()
    }
  }, [ocupado])
}

export function iniciarAtualizacao(): void {
  registerSW({
    immediate: true,
    onNeedReload() {
      recarregar = true
      if (ocupados === 0) location.reload()
    },
    onRegisteredSW(_url, reg) {
      registro = reg
      if (!reg) return
      const verificar = () => reg.update().catch(() => {}) // sem internet: tenta depois
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') verificar()
      })
      setInterval(verificar, 30 * 60 * 1000)
    },
  })
}

export type ResultadoAtualizacao = 'atualizando' | 'em-dia' | 'sem-internet'

/** Botão "Procurar atualização": se houver versão nova, o app recarrega quando ela terminar de baixar. */
export async function procurarAtualizacao(): Promise<ResultadoAtualizacao> {
  if (!registro) return 'em-dia'
  try {
    await registro.update()
  } catch {
    return 'sem-internet'
  }
  return registro.installing || registro.waiting ? 'atualizando' : 'em-dia'
}
