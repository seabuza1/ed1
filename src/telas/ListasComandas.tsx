import { descreverPagamentos, separarPorStatus } from '../domain/comanda'
import { formatarReais } from '../domain/dinheiro'
import type { Area, Comanda } from '../domain/tipos'

const nomeArea = (areas: Area[], id: string) => areas.find((a) => a.id === id)?.nome ?? '—'

export function ListasComandas(props: { comandas: Comanda[]; areas: Area[] }) {
  const { emRota, entregues, voltaram } = separarPorStatus(props.comandas)
  return (
    <>
      <Lista titulo="Em rota" comandas={emRota} areas={props.areas} />
      <Lista titulo="Entregues" comandas={entregues} areas={props.areas} />
      <Lista titulo="Voltaram" comandas={voltaram} areas={props.areas} />
    </>
  )
}

function Lista(props: { titulo: string; comandas: Comanda[]; areas: Area[] }) {
  if (props.comandas.length === 0) return null
  return (
    <section className="lista">
      <h2>
        {props.titulo} <span className="discreto">({props.comandas.length})</span>
      </h2>
      {props.comandas.map((c) => (
        <ResumoComanda key={c.id} comanda={c} area={nomeArea(props.areas, c.areaId)} />
      ))}
    </section>
  )
}

export function ResumoComanda({ comanda: c, area }: { comanda: Comanda; area: string }) {
  return (
    <div className="resumo-comanda">
      <div>
        <strong className="codigo">{c.codigo}</strong>
        <span className="discreto"> · {area}</span>
        <div className="discreto pequeno">
          {descreverPagamentos(c.pagamentos)}
          {c.troco > 0 && ` · troco por Pix ${formatarReais(c.troco)}`}
        </div>
      </div>
      <strong className="nowrap">{formatarReais(c.total)}</strong>
    </div>
  )
}
