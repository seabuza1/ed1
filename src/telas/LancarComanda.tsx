import { useRef, useState } from 'react'
import { comandaRepetida, criarComanda } from '../domain/comanda'
import { lerReais } from '../domain/dinheiro'
import type { Area, Comanda, Noite } from '../domain/tipos'
import { agora, novoId } from '../data/id'
import { repo } from '../data/repo'
import { CampoReais } from '../ui/CampoReais'
import { ChipsArea } from '../ui/ChipsArea'
import { EditorPagamento } from '../ui/EditorPagamento'
import { mensagemDeErro } from '../ui/erro'
import { lerPagamento, pagamentoVazio } from '../ui/pagamento'

const STATUS: Record<Comanda['status'], string> = {
  em_rota: 'em rota',
  entregue: 'entregue',
  voltou: 'voltou',
}

export function LancarComanda(props: { noite: Noite; areas: Area[]; comandas: Comanda[] }) {
  const [codigo, setCodigo] = useState('')
  const [total, setTotal] = useState('')
  const [areaId, setAreaId] = useState<string | null>(null)
  const [pagamento, setPagamento] = useState(pagamentoVazio)
  const [erro, setErro] = useState<string | null>(null)
  const [repetidaOk, setRepetidaOk] = useState(false)
  const refCodigo = useRef<HTMLInputElement>(null)
  const refTotal = useRef<HTMLInputElement>(null)

  const repetida = codigo.length === 4 ? comandaRepetida(codigo, props.comandas) : undefined
  const ativas = props.areas.filter((a) => a.ativa)
  const valorTotal = lerReais(total)

  const mudou = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setErro(null)
  }

  async function lancar() {
    if (valorTotal === null || valorTotal === 0) return setErro('Informe o total.')
    const area = ativas.find((a) => a.id === areaId)
    if (!area) return setErro('Escolha a área.')
    const p = lerPagamento(pagamento, valorTotal)
    if (!p.ok) return setErro(p.erro)
    const r = criarComanda({ codigo, total: valorTotal, ...p.valor }, area, {
      id: novoId(),
      noiteId: props.noite.id,
      agora: agora(),
    })
    if (!r.ok) return setErro(r.erro)
    if (repetida && !repetidaOk) return setRepetidaOk(true) // R1: segundo toque
    // Limpa antes de salvar, para não apagar o que for digitado enquanto grava.
    const anterior = { codigo, total, areaId, pagamento }
    preencher({ codigo: '', total: '', areaId: null, pagamento: pagamentoVazio() })
    refCodigo.current?.focus()
    try {
      await repo.salvarComanda(r.valor)
    } catch (e) {
      preencher(anterior)
      setErro(mensagemDeErro(e))
    }
  }

  function preencher(v: { codigo: string; total: string; areaId: string | null; pagamento: typeof pagamento }) {
    setCodigo(v.codigo)
    setTotal(v.total)
    setAreaId(v.areaId)
    setPagamento(v.pagamento)
    setRepetidaOk(false)
  }

  return (
    <section className="pilha cartao-form">
      <h2>Lançar comanda</h2>
      <div className="lado-a-lado">
        <label className="campo">
          <span>Código</span>
          <input
            ref={refCodigo}
            inputMode="numeric"
            enterKeyHint="next"
            autoComplete="off"
            maxLength={4}
            placeholder="0000"
            value={codigo}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4)
              setCodigo(v)
              setErro(null)
              setRepetidaOk(false)
              if (v.length === 4) refTotal.current?.focus()
            }}
          />
        </label>
        <CampoReais rotulo="Total" valor={total} onChange={mudou(setTotal)} ref={refTotal} />
      </div>
      {repetida && (
        <p className="aviso">
          Já tem a {repetida.codigo} nesta noite ({STATUS[repetida.status]}).
          {repetidaOk ? ' Toque de novo para lançar mesmo assim.' : ''}
        </p>
      )}
      <ChipsArea areas={ativas} selecionada={areaId} onChange={mudou(setAreaId)} />
      <EditorPagamento estado={pagamento} onChange={mudou(setPagamento)} total={valorTotal} />
      <button type="button" className={`primario ${repetidaOk ? 'armado' : ''}`} onClick={lancar}>
        {repetidaOk ? 'Lançar mesmo assim' : 'Lançar'}
      </button>
      {erro && <p className="erro">{erro}</p>}
    </section>
  )
}
