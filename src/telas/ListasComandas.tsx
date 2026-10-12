import { useState, type ReactNode } from 'react'
import { marcarEntregue, marcarVoltou, NOMES_FORMA, saiuDeNovo, separarPorStatus } from '../domain/comanda'
import { formatarHora } from '../domain/datas'
import { formatarReais } from '../domain/dinheiro'
import type { Area, Comanda } from '../domain/tipos'
import { agora, novoId } from '../data/id'
import { repo } from '../data/repo'
import { mensagemDeErro } from '../ui/erro'
import { Icone } from '../ui/Icone'
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
      <article key={c.id} className={`comanda status-${c.status}`}>
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
              <Icone nome="check" tamanho={18} />
              Entregue
            </button>
            <button type="button" onClick={() => alternar('trocar')}>
              <Icone nome="trocar" tamanho={16} />
              Trocou a forma
            </button>
            <button type="button" onClick={() => gravar(marcarVoltou(c, agora()))}>
              <Icone nome="voltou" tamanho={16} />
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
            <Icone nome="denovo" tamanho={18} />
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
      {props.comandas.length === 0 && (
        <div className="vazio">
          <span className="icone-grande">
            <Icone nome="moto" tamanho={28} />
          </span>
          <strong>Nenhuma comanda ainda</strong>
          {!props.somenteLeitura && <span className="pequeno">Lance a comanda quando sair para a entrega.</span>}
        </div>
      )}
    </>
  )
}

function Lista(props: { titulo: string; comandas: Comanda[]; cartao: (c: Comanda) => ReactNode }) {
  if (props.comandas.length === 0) return null
  return (
    <section className="lista">
      <h2 className="titulo-secao">
        {props.titulo} <span className="contador">{props.comandas.length}</span>
      </h2>
      {props.comandas.map(props.cartao)}
    </section>
  )
}

export function ResumoComanda({ comanda: c, area }: { comanda: Comanda; area: string }) {
  return (
    <span className="resumo-comanda">
      <span className="resumo-linha">
        <strong className="codigo">{c.codigo}</strong>
        <strong className="valor">{formatarReais(c.total)}</strong>
      </span>
      <span className="etiquetas">
        <span className="etiqueta">
          <Icone nome="local" tamanho={13} />
          {area}
        </span>
        {c.pagamentos.map((p, i) => (
          <span key={i} className={`etiqueta forma-${p.forma}`}>
            {NOMES_FORMA[p.forma]}
            {c.pagamentos.length > 1 && ` ${formatarReais(p.valor)}`}
          </span>
        ))}
        {c.troco > 0 && <span className="etiqueta">troco por Pix {formatarReais(c.troco)}</span>}
        {c.finalizadaEm && (
          <span className="etiqueta hora">
            {c.status === 'voltou' ? 'voltou' : 'entregue'} {formatarHora(c.finalizadaEm)}
          </span>
        )}
      </span>
    </span>
  )
}
