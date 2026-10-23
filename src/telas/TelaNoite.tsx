import { useEffect, useRef, useState } from 'react'
import { calcularAcerto } from '../domain/acerto'
import { dataDaNoite, formatarData } from '../domain/datas'
import { formatarReais, lerReais, paraCampo } from '../domain/dinheiro'
import { abrirNoite, editarPromocao, editarValoresNoite, noiteAberta, reabrirNoite } from '../domain/noite'
import type { AcertoConfirmado, Ajustes, Area, Comanda, Noite } from '../domain/tipos'
import { novoId } from '../data/id'
import { repo } from '../data/repo'
import { BarraTotais } from '../ui/BarraTotais'
import { CampoReais } from '../ui/CampoReais'
import { mensagemDeErro } from '../ui/erro'
import { Icone } from '../ui/Icone'
import { IndicadorNuvem } from '../ui/IndicadorNuvem'
import { EnviarHistorico } from './EnviarHistorico'
import { LancarComanda } from './LancarComanda'
import { ListasComandas } from './ListasComandas'

export function TelaNoite(props: {
  noites: Noite[]
  ajustes: Ajustes
  areas: Area[]
  comandas: Comanda[]
  acertos: AcertoConfirmado[]
}) {
  const aberta = noiteAberta(props.noites)
  if (!aberta) return <AbrirNoite noites={props.noites} ajustes={props.ajustes} acertos={props.acertos} />
  // Confirmado pelo Luan antes de fechar: a nuvem já não aceita mudanças.
  const travada = props.acertos.some((a) => a.caixaId === aberta.id)
  return (
    <>
      <BarraTotais acerto={calcularAcerto(aberta, props.comandas)} />
      <main className="app pilha">
        <ValoresNoite noite={aberta} travada={travada} />
        {travada ? (
          <p className="aviso">O Luan já confirmou o acerto desta noite. Não dá mais para lançar nem editar.</p>
        ) : (
          <LancarComanda noite={aberta} areas={props.areas} comandas={props.comandas} />
        )}
        <ListasComandas
          comandas={props.comandas}
          areas={props.areas}
          somenteLeitura={travada}
          promoDesconto={aberta.promoDesconto}
        />
      </main>
    </>
  )
}

function AbrirNoite({ noites, ajustes, acertos }: { noites: Noite[]; ajustes: Ajustes; acertos: AcertoConfirmado[] }) {
  // A data segue o relógio até ser mudada à mão: o app volta do fundo na mesma tela, noutro dia.
  const [dataEditada, setData] = useState<string | null>(null)
  const [hoje, setHoje] = useState(() => dataDaNoite(new Date()))
  useEffect(() => {
    const aoVoltar = () => document.visibilityState === 'visible' && setHoje(dataDaNoite(new Date()))
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [])
  const data = dataEditada ?? hoje
  // Toque duplo não abre duas noites: a lista só traz a nova depois de gravar.
  const abrindo = useRef(false)
  const [ocupado, setOcupado] = useState(false)
  const [caixa, setCaixa] = useState(paraCampo(ajustes.caixaPadrao))
  const [diaria, setDiaria] = useState(paraCampo(ajustes.diariaPadrao))
  const [erro, setErro] = useState<string | null>(null)
  const existente = noites.find((n) => n.data === data)
  const confirmada = existente && acertos.some((a) => a.caixaId === existente.id)

  async function abrir() {
    if (abrindo.current) return
    const caixaInicial = lerReais(caixa)
    const valorDiaria = lerReais(diaria)
    if (caixaInicial === null) return setErro('Caixa inválido.')
    if (valorDiaria === null) return setErro('Diária inválida.')
    const r = abrirNoite({ data, caixaInicial, diaria: valorDiaria }, noites, novoId())
    if (!r.ok) return setErro(r.erro)
    abrindo.current = true
    setOcupado(true)
    try {
      await repo.salvarNoite(r.valor)
      // Gravou: a tela troca quando a lista trouxer a noite; até lá, continua travado.
    } catch (e) {
      setErro(mensagemDeErro(e))
      abrindo.current = false
      setOcupado(false)
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
    <main className="app pilha">
      <div className="boas-vindas">
        <h1>Abrir noite</h1>
        <p className="discreto">Confira a data, o caixa de troco e a diária antes de sair.</p>
        <IndicadorNuvem />
      </div>
      <EnviarHistorico />
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
        {existente && confirmada ? (
          <p className="aviso">O acerto de {formatarData(existente.data)} já foi confirmado. Só o admin reabre.</p>
        ) : existente ? (
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
            <button type="submit" className="primario" disabled={ocupado}>
              Abrir noite
            </button>
          </>
        )}
        {erro && <p className="erro">{erro}</p>}
      </form>
    </main>
  )
}

function ValoresNoite({ noite, travada }: { noite: Noite; travada: boolean }) {
  const [editando, setEditando] = useState(false)
  const [caixa, setCaixa] = useState('')
  const [diaria, setDiaria] = useState('')
  const [promo, setPromo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    const caixaInicial = lerReais(caixa)
    const valorDiaria = lerReais(diaria)
    const promoDesconto = promo.trim() === '' ? null : lerReais(promo)
    if (caixaInicial === null) return setErro('Caixa inválido.')
    if (valorDiaria === null) return setErro('Diária inválida.')
    if (promo.trim() !== '' && promoDesconto === null) return setErro('Promoção inválida.')
    const r = editarValoresNoite(noite, { caixaInicial, diaria: valorDiaria })
    if (!r.ok) return setErro(r.erro)
    const p = editarPromocao(r.valor, promoDesconto)
    if (!p.ok) return setErro(p.erro)
    try {
      await repo.atualizarNoite(noite.id, { caixaInicial, diaria: valorDiaria, promoDesconto })
      setEditando(false)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  if (!editando)
    return (
      <header className="topo">
        <div>
          <h1>Noite de {formatarData(noite.data).slice(0, 5)}</h1>
          <p className="discreto pequeno">
            Caixa <span className="num">{formatarReais(noite.caixaInicial)}</span> · Diária{' '}
            <span className="num">{formatarReais(noite.diaria)}</span>
            {noite.promoDesconto != null && (
              <>
                {' '}
                · Promoção <span className="num">{formatarReais(noite.promoDesconto)}</span>
              </>
            )}
          </p>
          <IndicadorNuvem />
        </div>
        {!travada && (
          <button
            type="button"
            className="link"
            onClick={() => {
              setCaixa(paraCampo(noite.caixaInicial))
              setDiaria(paraCampo(noite.diaria))
              setPromo(noite.promoDesconto == null ? '' : paraCampo(noite.promoDesconto))
              setErro(null)
              setEditando(true)
            }}
          >
            <Icone nome="lapis" tamanho={16} />
            Editar
          </button>
        )}
      </header>
    )

  return (
    <form
      className="bloco pilha"
      onSubmit={(e) => {
        e.preventDefault()
        salvar()
      }}
    >
      <h2>Noite de {formatarData(noite.data)}</h2>
      <div className="lado-a-lado">
        <CampoReais rotulo="Caixa" valor={caixa} onChange={setCaixa} />
        <CampoReais rotulo="Diária" valor={diaria} onChange={setDiaria} />
      </div>
      <CampoReais rotulo="Promoção por pizza (vazio: sem)" valor={promo} onChange={setPromo} />
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
