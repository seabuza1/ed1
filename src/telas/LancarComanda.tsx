import { useRef, useState } from 'react'
import { comandaRepetida, criarComanda } from '../domain/comanda'
import { lerReais } from '../domain/dinheiro'
import type { Area, Comanda, Noite } from '../domain/tipos'
import { agora, novoId } from '../data/id'
import { repo } from '../data/repo'
import { CampoReais } from '../ui/CampoReais'
import { ChipsArea } from '../ui/ChipsArea'
import { useAviso } from '../ui/desfazer'
import { EditorPagamento } from '../ui/EditorPagamento'
import { mensagemDeErro } from '../ui/erro'
import { Icone } from '../ui/Icone'
import { lerPagamento, pagamentoVazio, type EstadoPagamento } from '../ui/pagamento'

const STATUS: Record<Comanda['status'], string> = {
  em_rota: 'em rota',
  entregue: 'entregue',
  voltou: 'voltou',
}

interface Formulario {
  codigo: string
  total: string
  areaId: string | null
  pagamento: EstadoPagamento
}

const vazio = (): Formulario => ({ codigo: '', total: '', areaId: null, pagamento: pagamentoVazio() })

/** Lançar comanda: tocar na forma de pagamento já lança; "Lançar" só no pagamento dividido. */
export function LancarComanda(props: { noite: Noite; areas: Area[]; comandas: Comanda[] }) {
  const [f, setF] = useState(vazio)
  const [sugerida, setSugerida] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [repetidaOk, setRepetidaOk] = useState(false)
  // Com comanda em rota, abre recolhido: na porta do cliente a lista "Em rota" fica à mão.
  const [aberto, setAberto] = useState(() => !props.comandas.some((c) => c.status === 'em_rota'))
  const refCodigo = useRef<HTMLInputElement>(null)
  const refTotal = useRef<HTMLInputElement>(null)
  const aviso = useAviso()

  const repetida = f.codigo.length === 4 ? comandaRepetida(f.codigo, props.comandas) : undefined
  const ativas = props.areas.filter((a) => a.ativa)

  function mudar(parcial: Partial<Formulario>) {
    setF((atual) => ({ ...atual, ...parcial }))
    setErro(null)
  }

  async function sugerirArea(codigo: string) {
    try {
      const id = await repo.sugerirArea(codigo)
      if (!id || !ativas.some((a) => a.id === id)) return
      // Só marca se o código não mudou e ninguém escolheu a área enquanto isso.
      setF((atual) => (atual.codigo === codigo && atual.areaId === null ? { ...atual, areaId: id } : atual))
      setSugerida(id)
    } catch {
      // sem sugestão
    }
  }

  async function lancar(pagamento: EstadoPagamento) {
    const total = lerReais(f.total)
    if (total === null || total === 0) return setErro('Informe o total.')
    const area = ativas.find((a) => a.id === f.areaId)
    if (!area) return setErro('Escolha a área.')
    const p = lerPagamento(pagamento, total)
    if (!p.ok) return setErro(p.erro)
    const r = criarComanda({ codigo: f.codigo, total, ...p.valor }, area, {
      id: novoId(),
      noiteId: props.noite.id,
      agora: agora(),
    })
    if (!r.ok) return setErro(r.erro)
    if (repetida && !repetidaOk) return setRepetidaOk(true) // R1: segundo toque
    // Limpa antes de salvar, para não apagar o que for digitado enquanto grava.
    const anterior = { ...f, pagamento }
    setF(vazio())
    setSugerida(null)
    setRepetidaOk(false)
    refCodigo.current?.focus()
    try {
      await repo.salvarComanda(r.valor)
      aviso(`${r.valor.codigo} lançada`, async () => {
        await repo.excluirComanda(r.valor.id)
        setF(anterior)
        setAberto(true)
      })
    } catch (e) {
      setF(anterior)
      setErro(mensagemDeErro(e))
    }
  }

  if (!aberto)
    return (
      <button type="button" className="primario" onClick={() => setAberto(true)}>
        <Icone nome="mais" tamanho={22} />
        Lançar comanda
      </button>
    )

  return (
    <section className="pilha form-lancar" aria-label="Lançar comanda">
      <div className="titulo-form">
        <h2>Lançar comanda</h2>
        <button type="button" className="link" onClick={() => setAberto(false)}>
          Recolher
        </button>
      </div>
      <div className="lado-a-lado">
        <label className="campo">
          <span>Código</span>
          <input
            ref={refCodigo}
            className="codigo-campo"
            inputMode="numeric"
            enterKeyHint="next"
            autoComplete="off"
            maxLength={4}
            placeholder="0000"
            value={f.codigo}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4)
              mudar({ codigo: v, ...(sugerida && f.areaId === sugerida ? { areaId: null } : {}) })
              setSugerida(null)
              setRepetidaOk(false)
              if (v.length === 4) {
                refTotal.current?.focus()
                sugerirArea(v)
              }
            }}
          />
        </label>
        <CampoReais rotulo="Total" valor={f.total} onChange={(t) => mudar({ total: t })} ref={refTotal} />
      </div>
      {repetida && (
        <p className="aviso">
          Já tem a {repetida.codigo} nesta noite ({STATUS[repetida.status]}).
          {repetidaOk ? ' Toque de novo para lançar mesmo assim.' : ''}
        </p>
      )}
      <ChipsArea
        areas={ativas}
        selecionada={f.areaId}
        onChange={(id) => mudar({ areaId: id })}
        dica={sugerida !== null && f.areaId === sugerida ? 'a do último pedido' : undefined}
      />
      <EditorPagamento
        estado={f.pagamento}
        onChange={(p) => mudar({ pagamento: p })}
        total={lerReais(f.total)}
        aoTocarForma={lancar}
      />
      {f.pagamento.dividido && (
        <button type="button" className={`primario ${repetidaOk ? 'armado' : ''}`} onClick={() => lancar(f.pagamento)}>
          {repetidaOk ? 'Lançar mesmo assim' : 'Lançar'}
        </button>
      )}
      {erro && <p className="erro">{erro}</p>}
    </section>
  )
}
