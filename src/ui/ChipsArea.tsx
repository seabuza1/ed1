import { formatarReais } from '../domain/dinheiro'
import type { Area } from '../domain/tipos'

export function ChipsArea(props: {
  areas: Area[]
  selecionada: string | null
  onChange: (areaId: string) => void
}) {
  return (
    <div className="pilha-curta">
      <span className="rotulo-grupo">Área</span>
      <div className="chips" role="group" aria-label="Área">
      {props.areas.map((a) => (
        <button
          key={a.id}
          type="button"
          className="chip chip-area"
          aria-pressed={a.id === props.selecionada}
          onClick={() => props.onChange(a.id)}
        >
          <span>{a.nome}</span>
          <small>{formatarReais(a.taxa)}</small>
        </button>
      ))}
      </div>
    </div>
  )
}
