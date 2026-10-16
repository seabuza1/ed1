import { useState } from 'react'
import { noiteAberta, ordenarNoites } from './domain/noite'
import { repo } from './data/repo'
import { useConsulta } from './data/useConsulta'
import { TelaAcerto } from './telas/TelaAcerto'
import { TelaAjustes } from './telas/TelaAjustes'
import { NoiteDoHistorico, TelaHistorico } from './telas/TelaHistorico'
import { TelaNoite } from './telas/TelaNoite'
import { Icone, type NomeIcone } from './ui/Icone'
import { useAvisoPix } from './ui/useAvisoPix'

type Aba = 'noite' | 'acerto' | 'historico'

const ABAS: { id: Aba; rotulo: string; icone: NomeIcone }[] = [
  { id: 'noite', rotulo: 'Noite', icone: 'noite' },
  { id: 'acerto', rotulo: 'Acerto', icone: 'acerto' },
  { id: 'historico', rotulo: 'Histórico', icone: 'historico' },
]

export default function App() {
  const [aba, setAba] = useState<Aba>('noite')
  const [idHistorico, setIdHistorico] = useState<string | null>(null)
  const [ajustesAbertos, setAjustesAbertos] = useState(false)
  const noites = useConsulta(async () => ordenarNoites(await repo.listarNoites()), [])
  const ajustes = useConsulta(() => repo.obterAjustes(), [])
  const areas = useConsulta(() => repo.listarAreas(), [])
  const acertos = useConsulta(() => repo.listarAcertos(), [])
  const emFoco = noites && (noiteAberta(noites) ?? noites[0])
  const comandas = useConsulta(
    async () => (emFoco ? repo.listarComandas(emFoco.id) : []),
    [emFoco?.id],
  )

  useAvisoPix(comandas, emFoco?.id)

  const noiteHistorico = noites?.find((n) => n.id === idHistorico)

  if (!noites || !ajustes || !areas || !comandas || !acertos) return <p className="carregando">Carregando…</p>
  const acertoDe = (id: string | undefined) => acertos.find((a) => a.caixaId === id) ?? null

  return (
    <>
      {aba === 'noite' && (
        <TelaNoite noites={noites} ajustes={ajustes} areas={areas} comandas={comandas} acertos={acertos} />
      )}
      {aba === 'acerto' && (
        <TelaAcerto noite={emFoco} noites={noites} comandas={comandas} areas={areas} acerto={acertoDe(emFoco?.id)} />
      )}
      {aba === 'historico' &&
        (ajustesAbertos ? (
          <TelaAjustes areas={areas} ajustes={ajustes} voltar={() => setAjustesAbertos(false)} />
        ) : noiteHistorico ? (
          <NoiteDoHistorico
            noite={noiteHistorico}
            noites={noites}
            areas={areas}
            acerto={acertoDe(noiteHistorico.id)}
            voltar={() => setIdHistorico(null)}
          />
        ) : (
          <TelaHistorico
            noites={noites}
            acertos={acertos}
            areas={areas}
            onAbrir={setIdHistorico}
            onAjustes={() => setAjustesAbertos(true)}
          />
        ))}
      <nav className="abas">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-current={aba === a.id ? 'page' : undefined}
            onClick={() => {
              setAba(a.id)
              setIdHistorico(null)
              setAjustesAbertos(false)
              window.scrollTo(0, 0)
            }}
          >
            <Icone nome={a.icone} tamanho={22} />
            {a.rotulo}
          </button>
        ))}
      </nav>
    </>
  )
}
