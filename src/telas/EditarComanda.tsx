import { useState } from 'react'
import { comandaRepetida, editarComanda, NOMES_STATUS, trocarForma } from '../domain/comanda'
import { lerReais, paraCampo } from '../domain/dinheiro'
import type { Area, Comanda, Status } from '../domain/tipos'
import { agora } from '../data/id'
import { repo } from '../data/repo'
import { BotaoConfirmar } from '../ui/BotaoConfirmar'
import { CampoReais } from '../ui/CampoReais'
import { ChipsArea } from '../ui/ChipsArea'
import { EditorPagamento } from '../ui/EditorPagamento'
import { mensagemDeErro } from '../ui/erro'
import { estadoDe, lerPagamento } from '../ui/pagamento'

const STATUS: Status[] = ['em_rota', 'entregue', 'voltou']

/** Editar ou excluir uma comanda (inclui corrigir o status). */
export function EditarComanda(props: {
  comanda: Comanda
  areas: Area[]
  comandas: Comanda[]
  onFechar: () => void
}) {
  const c = props.comanda
  const [codigo, setCodigo] = useState(c.codigo)
  const [total, setTotal] = useState(paraCampo(c.total))
  const [areaId, setAreaId] = useState(c.areaId)
  const [status, setStatus] = useState<Status>(c.status)
  const [pagamento, setPagamento] = useState(() => estadoDe(c.pagamentos, c.troco))
  const [erro, setErro] = useState<string | null>(null)

  // Áreas ativas e, se estiver desativada, a da própria comanda.
  const areas = props.areas.filter((a) => a.ativa || a.id === c.areaId)
  const valorTotal = lerReais(total)
  const repetida =
    codigo.length === 4 && status !== 'voltou' ? comandaRepetida(codigo, props.comandas, c.id) : undefined

  async function salvar() {
    if (valorTotal === null || valorTotal === 0) return setErro('Informe o total.')
    const area = areas.find((a) => a.id === areaId)
    if (!area) return setErro('Escolha a área.')
    const p = lerPagamento(pagamento, valorTotal)
    if (!p.ok) return setErro(p.erro)
    const r = editarComanda(c, { codigo, total: valorTotal, ...p.valor }, area, status, agora())
    if (!r.ok) return setErro(r.erro)
    try {
      await repo.salvarComanda(r.valor)
      props.onFechar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  async function excluir() {
    try {
      await repo.excluirComanda(c.id)
      props.onFechar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="pilha editar">
      <div className="lado-a-lado">
        <label className="campo">
          <span>Código</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={codigo}
            onChange={(e) => (setCodigo(e.target.value.replace(/\D/g, '').slice(0, 4)), setErro(null))}
          />
        </label>
        <CampoReais rotulo="Total" valor={total} onChange={(t) => (setTotal(t), setErro(null))} />
      </div>
      {repetida && <p className="aviso">Já tem outra {repetida.codigo} nesta noite.</p>}
      <ChipsArea areas={areas} selecionada={areaId} onChange={(id) => (setAreaId(id), setErro(null))} />
      <EditorPagamento estado={pagamento} onChange={(e) => (setPagamento(e), setErro(null))} total={valorTotal} />
      <div className="chips chips-3" role="group" aria-label="Status">
        {STATUS.map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
            {NOMES_STATUS[s]}
          </button>
        ))}
      </div>
      <div className="lado-a-lado">
        <button type="button" className="secundario" onClick={props.onFechar}>
          Cancelar
        </button>
        <button type="button" className="primario" onClick={salvar}>
          Salvar
        </button>
      </div>
      <BotaoConfirmar className="perigo" confirmacao="Toque de novo para excluir" onConfirmar={excluir}>
        Excluir comanda
      </BotaoConfirmar>
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}

/** "Trocou a forma": abre as formas e a divisão; confirmar marca entregue. */
export function TrocarForma(props: { comanda: Comanda; onFechar: () => void }) {
  const c = props.comanda
  const [pagamento, setPagamento] = useState(() => estadoDe(c.pagamentos, c.troco))
  const [erro, setErro] = useState<string | null>(null)

  async function confirmar() {
    const p = lerPagamento(pagamento, c.total)
    if (!p.ok) return setErro(p.erro)
    const r = trocarForma(c, p.valor, agora())
    if (!r.ok) return setErro(r.erro)
    try {
      await repo.salvarComanda(r.valor)
      props.onFechar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <div className="pilha editar">
      <EditorPagamento estado={pagamento} onChange={(e) => (setPagamento(e), setErro(null))} total={c.total} />
      <div className="lado-a-lado">
        <button type="button" className="secundario" onClick={props.onFechar}>
          Cancelar
        </button>
        <button type="button" className="primario" onClick={confirmar}>
          Entregue
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
