import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ContextoAviso, type MostrarAviso } from './desfazer'
import { mensagemDeErro } from './erro'

interface Aviso {
  id: number
  texto: string
  desfazer?: () => Promise<void> | void
}

let seq = 0

/** Aviso rápido acima das abas: "3557 lançada · Desfazer". Some em 5 segundos. */
export function ProvedorAviso({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null)

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso((a) => (a?.id === aviso.id ? null : a)), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  const mostrar = useCallback<MostrarAviso>((texto, desfazer) => setAviso({ id: ++seq, texto, desfazer }), [])

  async function desfazer(a: Aviso) {
    setAviso(null)
    try {
      await a.desfazer?.()
    } catch (e) {
      setAviso({ id: ++seq, texto: mensagemDeErro(e) })
    }
  }

  return (
    <ContextoAviso.Provider value={mostrar}>
      {children}
      <div className="aviso-rapido-area" aria-live="polite">
        {aviso && (
          <div key={aviso.id} className="aviso-rapido" role="status">
            <span>{aviso.texto}</span>
            {aviso.desfazer && (
              <button type="button" onClick={() => desfazer(aviso)}>
                Desfazer
              </button>
            )}
          </div>
        )}
      </div>
    </ContextoAviso.Provider>
  )
}
