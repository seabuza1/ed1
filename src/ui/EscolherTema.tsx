import { useState } from 'react'
import { lerTema, salvarTema, type Tema } from './tema'

const TEMAS: { id: Tema; rotulo: string }[] = [
  { id: 'sistema', rotulo: 'Sistema' },
  { id: 'escuro', rotulo: 'Escuro' },
  { id: 'claro', rotulo: 'Claro' },
]

export function EscolherTema() {
  const [tema, setTema] = useState(lerTema)
  return (
    <section className="bloco pilha-curta">
      <h2>Tema</h2>
      <div className="chips chips-3" role="group" aria-label="Tema">
        {TEMAS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            aria-pressed={tema === t.id}
            onClick={() => {
              setTema(t.id)
              salvarTema(t.id)
            }}
          >
            {t.rotulo}
          </button>
        ))}
      </div>
    </section>
  )
}
