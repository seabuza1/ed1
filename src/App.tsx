import { useState } from 'react'
import { noiteAberta, ordenarNoites } from './domain/noite'
import { repo } from './data/repo'
import { useConsulta } from './data/useConsulta'
import { TelaAcerto } from './telas/TelaAcerto'
import { TelaNoite } from './telas/TelaNoite'

type Aba = 'noite' | 'acerto'

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'noite', rotulo: 'Noite' },
  { id: 'acerto', rotulo: 'Acerto' },
]

export default function App() {
  const [aba, setAba] = useState<Aba>('noite')
  const noites = useConsulta(async () => ordenarNoites(await repo.listarNoites()), [])
  const ajustes = useConsulta(() => repo.obterAjustes(), [])
  const emFoco = noites && (noiteAberta(noites) ?? noites[0])
  const comandas = useConsulta(
    async () => (emFoco ? repo.listarComandas(emFoco.id) : []),
    [emFoco?.id],
  )

  if (!noites || !ajustes || !comandas) return <p className="app discreto">Carregando…</p>

  return (
    <>
      {aba === 'noite' && <TelaNoite noites={noites} ajustes={ajustes} comandas={comandas} />}
      {aba === 'acerto' && <TelaAcerto noite={emFoco} noites={noites} comandas={comandas} />}
      <nav className="abas">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-current={aba === a.id ? 'page' : undefined}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </nav>
    </>
  )
}
