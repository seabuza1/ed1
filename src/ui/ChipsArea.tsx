import { formatarReais } from '../domain/dinheiro'
import type { Area } from '../domain/tipos'

export function ChipsArea(props: {
  areas: Area[]
  selecionada: string | null
  onChange: (areaId: string) => void
  /** Texto ao lado do rótulo, ex.: "a do último pedido". */
  dica?: string
  /** Leitura da comanda: a área sugerida fica em destaque, com a origem embaixo. */
  sugerida?: { id: string; origem: string } | null
}) {
  return (
    <div className="pilha-curta">
      <span className="rotulo-grupo">
        Área{props.dica && <span className="dica"> · {props.dica}</span>}
      </span>
      <div className="chips" role="group" aria-label="Área">
        {props.areas.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`chip chip-area ${a.id === props.sugerida?.id ? 'chip-sugerida' : ''}`}
            aria-pressed={a.id === props.selecionada}
            onClick={() => props.onChange(a.id)}
          >
            <span>{a.nome}</span>
            <small className="num">{formatarReais(a.taxa)}</small>
            {a.id === props.sugerida?.id && <small className="origem">{props.sugerida.origem}</small>}
          </button>
        ))}
      </div>
    </div>
  )
}
