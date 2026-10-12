import { useState } from 'react'
import { calcularAcerto } from '../domain/acerto'
import { dataDaNoite, formatarData } from '../domain/datas'
import { formatarReais, lerReais, paraCampo } from '../domain/dinheiro'
import { abrirNoite, editarValoresNoite, noiteAberta, reabrirNoite } from '../domain/noite'
import type { Ajustes, Area, Comanda, Noite } from '../domain/tipos'
import { novoId } from '../data/id'
import { repo } from '../data/repo'
import { BarraTotais } from '../ui/BarraTotais'
import { CampoReais } from '../ui/CampoReais'
import { mensagemDeErro } from '../ui/erro'
import { LancarComanda } from './LancarComanda'
import { ListasComandas } from './ListasComandas'

export function TelaNoite(props: {
  noites: Noite[]
  ajustes: Ajustes
  areas: Area[]
  comandas: Comanda[]
}) {
  const aberta = noiteAberta(props.noites)
  if (!aberta) return <AbrirNoite noites={props.noites} ajustes={props.ajustes} />
  return (
    <>
      <BarraTotais acerto={calcularAcerto(aberta, props.comandas)} />
      <main className="app pilha">
        <ValoresNoite noite={aberta} />
        <LancarComanda noite={aberta} areas={props.areas} comandas={props.comandas} />
        <ListasComandas comandas={props.comandas} areas={props.areas} />
      </main>
    </>
  )
}

function AbrirNoite({ noites, ajustes }: { noites: Noite[]; ajustes: Ajustes }) {
  const [data, setData] = useState(() => dataDaNoite(new Date()))
  const [caixa, setCaixa] = useState(paraCampo(ajustes.caixaPadrao))
  const [diaria, setDiaria] = useState(paraCampo(ajustes.diariaPadrao))
  const [erro, setErro] = useState<string | null>(null)
  const existente = noites.find((n) => n.data === data)

  async function abrir() {
    const caixaInicial = lerReais(caixa)
    const valorDiaria = lerReais(diaria)
    if (caixaInicial === null) return setErro('Caixa inválido.')
    if (valorDiaria === null) return setErro('Diária inválida.')
    const r = abrirNoite({ data, caixaInicial, diaria: valorDiaria }, noites, novoId())
    if (!r.ok) return setErro(r.erro)
    try {
      await repo.salvarNoite(r.valor)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  async function reabrir(noite: Noite) {
    const r = reabrirNoite(noite, noites)
    if (!r.ok) return setErro(r.erro)
    try {
      await repo.atualizarNoite(noite.id, { fechadaEm: r.valor.fechadaEm })
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <main className="app">
      <h1>Abrir noite</h1>
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault()
          if (!existente) abrir()
        }}
      >
        <label className="campo">
          <span>Data</span>
          <input type="date" value={data} onChange={(e) => (setData(e.target.value), setErro(null))} />
        </label>
        {existente ? (
          <>
            <p className="aviso">Já existe a noite de {formatarData(existente.data)}.</p>
            <button type="button" className="primario" onClick={() => reabrir(existente)}>
              Reabrir essa noite
            </button>
          </>
        ) : (
          <>
            <div className="lado-a-lado">
              <CampoReais rotulo="Caixa" valor={caixa} onChange={(t) => (setCaixa(t), setErro(null))} />
              <CampoReais rotulo="Diária" valor={diaria} onChange={(t) => (setDiaria(t), setErro(null))} />
            </div>
            <button type="submit" className="primario">
              Abrir noite
            </button>
          </>
        )}
        {erro && <p className="erro">{erro}</p>}
      </form>
    </main>
  )
}

function ValoresNoite({ noite }: { noite: Noite }) {
  const [editando, setEditando] = useState(false)
  const [caixa, setCaixa] = useState('')
  const [diaria, setDiaria] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    const caixaInicial = lerReais(caixa)
    const valorDiaria = lerReais(diaria)
    if (caixaInicial === null) return setErro('Caixa inválido.')
    if (valorDiaria === null) return setErro('Diária inválida.')
    const r = editarValoresNoite(noite, { caixaInicial, diaria: valorDiaria })
    if (!r.ok) return setErro(r.erro)
    try {
      await repo.atualizarNoite(noite.id, { caixaInicial, diaria: valorDiaria })
      setEditando(false)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  if (!editando)
    return (
      <section className="cabecalho-noite">
        <div>
          <h1>Noite de {formatarData(noite.data)}</h1>
          <p className="discreto">
            <span className="nowrap">Caixa {formatarReais(noite.caixaInicial)}</span> ·{' '}
            <span className="nowrap">Diária {formatarReais(noite.diaria)}</span>
          </p>
        </div>
        <button
          type="button"
          className="secundario"
          onClick={() => {
            setCaixa(paraCampo(noite.caixaInicial))
            setDiaria(paraCampo(noite.diaria))
            setErro(null)
            setEditando(true)
          }}
        >
          Editar
        </button>
      </section>
    )

  return (
    <form
      className="pilha"
      onSubmit={(e) => {
        e.preventDefault()
        salvar()
      }}
    >
      <h1>Noite de {formatarData(noite.data)}</h1>
      <div className="lado-a-lado">
        <CampoReais rotulo="Caixa" valor={caixa} onChange={setCaixa} />
        <CampoReais rotulo="Diária" valor={diaria} onChange={setDiaria} />
      </div>
      <div className="lado-a-lado">
        <button type="button" className="secundario" onClick={() => setEditando(false)}>
          Cancelar
        </button>
        <button type="submit" className="primario">
          Salvar
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}
    </form>
  )
}
