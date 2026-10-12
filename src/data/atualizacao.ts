import { registerSW } from 'virtual:pwa-register'

// Service worker em modo autoUpdate: quando sai versão nova, ela é instalada e a página
// recarrega sozinha. Sem isso, o app instalado no celular continuava mostrando a versão
// antiga, porque reabrir só retoma a tela que já estava aberta.

let registro: ServiceWorkerRegistration | undefined

export function iniciarAtualizacao(): void {
  registerSW({
    immediate: true,
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
