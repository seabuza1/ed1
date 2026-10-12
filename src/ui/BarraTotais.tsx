import type { Acerto } from '../domain/acerto'
import { formatarReais } from '../domain/dinheiro'
import { Icone } from './Icone'

/** Os três números da noite, fixos no topo. */
export function BarraTotais({ acerto }: { acerto: Acerto }) {
  return (
    <div className="totais">
      <div className="total devolver">
        <span>
          <Icone nome="dinheiro" tamanho={14} />
          Devolver
        </span>
        <strong>{formatarReais(acerto.devolver)}</strong>
      </div>
      <div className="total maquininha">
        <span>
          <Icone nome="cartao" tamanho={14} />
          Maquininha
        </span>
        <strong>{formatarReais(acerto.maquininha)}</strong>
      </div>
      <div className="total receber">
        <span>
          <Icone nome="carteira" tamanho={14} />
          Receber
        </span>
        <strong>{formatarReais(acerto.receber)}</strong>
      </div>
    </div>
  )
}
