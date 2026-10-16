import type { Acerto } from '../domain/acerto'
import { formatarReais } from '../domain/dinheiro'

/** Os três números da noite, num topo fino e fixo. */
export function BarraTotais({ acerto }: { acerto: Acerto }) {
  return (
    <div className="totais">
      <div className="total devolver">
        <span>Devolver</span>
        <strong className="num">{formatarReais(acerto.devolver)}</strong>
      </div>
      <div className="total maquininha">
        <span>Maquininha</span>
        <strong className="num">{formatarReais(acerto.maquininha)}</strong>
      </div>
      <div className="total receber">
        <span>Receber</span>
        <strong className="num">{formatarReais(acerto.receber)}</strong>
      </div>
    </div>
  )
}
