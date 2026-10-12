import type { Acerto } from '../domain/acerto'
import { formatarReais } from '../domain/dinheiro'

/** Os três números da noite, fixos no topo. */
export function BarraTotais({ acerto }: { acerto: Acerto }) {
  return (
    <div className="totais">
      <div>
        <span>Devolver</span>
        <strong>{formatarReais(acerto.devolver)}</strong>
      </div>
      <div>
        <span>Maquininha</span>
        <strong>{formatarReais(acerto.maquininha)}</strong>
      </div>
      <div>
        <span>Receber</span>
        <strong>{formatarReais(acerto.receber)}</strong>
      </div>
    </div>
  )
}
