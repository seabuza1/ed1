import { useState, type ReactNode } from 'react'
import { descreverPagamentos, marcarEntregue, marcarVoltou, saiuDeNovo, separarPorStatus } from '../domain/comanda'
import { formatarReais } from '../domain/dinheiro'
import type { Area, Comanda } from '../domain/tipos'
import { agora, novoId } from '../data/id'
import { repo } from '../data/repo'
import { mensagemDeErro } from '../ui/erro'
import { EditarComanda, TrocarForma } from './EditarComanda'

type Aberta = { id: string; modo: 'editar' | 'trocar' } | null

/** Listas da noite. Sem `somenteLeitura`, com as ações e a edição. */
export function ListasComandas(props: { comandas: Comanda[]; areas: Area[]; somenteLeitura?: boolean }) {
  const { emRota, entregues, voltaram } = separarPorStatus(props.comandas)
  const [aberta, setAberta] = useState<Aberta>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function gravar(c: Comanda) {
    setErro(null)
    try {
      await repo.salvarComanda(c)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const cartao = (c: Comanda) => {
    const area = props.areas.find((a) => a.id === c.areaId)
    const modo = aberta?.id === c.id ? aberta.modo : null
    const alternar = (m: 'editar' | 'trocar') => setAberta(modo === m ? null : { id: c.id, modo: m })
    return (
      <article key={c.id} className="comanda">
        {props.somenteLeitura ? (
          <ResumoComanda comanda={c} area={area?.nome ?? '—'} />
        ) : (
          <button type="button" className="resumo-botao" onClick={() => alternar('editar')}>
            <ResumoComanda comanda={c} area={area?.nome ?? '—'} />
          </button>
        )}
        {!props.somenteLeitura && modo === null && c.status === 'em_rota' && (
          <div className="acoes">
            <button type="button" className="ok" onClick={() => gravar(marcarEntregue(c, agora()))}>
              Entregue
            </button>
            <button type="button" onClick={() => alternar('trocar')}>
              Trocou a forma
            </button>
            <button type="button" onClick={() => gravar(marcarVoltou(c, agora()))}>
              Voltou
            </button>
          </div>
        )}
        {!props.somenteLeitura && modo === null && c.status === 'voltou' && (
          <button
            type="button"
            className="secundario largo"
            onClick={() => {
              const r = saiuDeNovo(c, area, { id: novoId(), agora: agora() })
              if (!r.ok) return setErro(r.erro)
              gravar(r.valor)
            }}
          >
            Saiu de novo
          </button>
        )}
        {modo === 'trocar' && <TrocarForma comanda={c} onFechar={() => setAberta(null)} />}
        {modo === 'editar' && (
          <EditarComanda comanda={c} areas={props.areas} comandas={props.comandas} onFechar={() => setAberta(null)} />
        )}
      </article>
    )
  }

  return (
    <>
      {erro && <p className="erro">{erro}</p>}
      <Lista titulo="Em rota" comandas={emRota} cartao={cartao} />
      <Lista titulo="Entregues" comandas={entregues} cartao={cartao} />
      <Lista titulo="Voltaram" comandas={voltaram} cartao={cartao} />
      {props.comandas.length === 0 && <p className="discreto">Nenhuma comanda lançada.</p>}
    </>
  )
}

function Lista(props: { titulo: string; comandas: Comanda[]; cartao: (c: Comanda) => ReactNode }) {
  if (props.comandas.length === 0) return null
  return (
    <section className="lista">
      <h2>
        {props.titulo} <span className="discreto">({props.comandas.length})</span>
      </h2>
      {props.comandas.map(props.cartao)}
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
