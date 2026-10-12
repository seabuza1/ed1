import { useState } from 'react'
import { alternarArea, editarAjustes, editarArea, novaArea } from '../domain/ajustes'
import type { Resultado } from '../domain/comanda'
import { formatarReais, lerReais, paraCampo } from '../domain/dinheiro'
import type { Ajustes, Area } from '../domain/tipos'
import { novoId } from '../data/id'
import { repo } from '../data/repo'
import { CampoReais } from '../ui/CampoReais'
import { mensagemDeErro } from '../ui/erro'

export function TelaAjustes(props: { areas: Area[]; ajustes: Ajustes }) {
  return (
    <main className="app pilha">
      <h1>Ajustes</h1>
      <Areas areas={props.areas} />
      <ValoresPadrao key={`${props.ajustes.caixaPadrao}-${props.ajustes.diariaPadrao}`} ajustes={props.ajustes} />
    </main>
  )
}

async function salvarArea(r: Resultado<Area>, setErro: (e: string | null) => void): Promise<boolean> {
  if (!r.ok) {
    setErro(r.erro)
    return false
  }
  try {
    await repo.salvarArea(r.valor)
    setErro(null)
    return true
  } catch (e) {
    setErro(mensagemDeErro(e))
    return false
  }
}

function Areas({ areas }: { areas: Area[] }) {
  const [editando, setEditando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  return (
    <section className="bloco pilha-curta">
      <h2>Áreas e taxas</h2>
      <p className="discreto pequeno">Mudar a taxa vale para as próximas comandas; as já lançadas não mudam.</p>
      {areas.map((a) =>
        editando === a.id ? (
          <FormArea
            key={a.id}
            inicial={a}
            rotulo="Salvar"
            onCancelar={() => setEditando(null)}
            onSalvar={async (entrada, setErroForm) => {
              if (await salvarArea(editarArea(a, entrada, areas), setErroForm)) setEditando(null)
            }}
          />
        ) : (
          <div key={a.id} className={`linha-area ${a.ativa ? '' : 'inativa'}`}>
            <div>
              <strong>{a.nome}</strong>
              <div className="discreto pequeno">
                {formatarReais(a.taxa)}
                {!a.ativa && ' · desativada'}
              </div>
            </div>
            <button type="button" onClick={() => (setEditando(a.id), setErro(null))}>
              Editar
            </button>
            <button type="button" onClick={() => salvarArea(alternarArea(a, areas), setErro)}>
              {a.ativa ? 'Desativar' : 'Ativar'}
            </button>
          </div>
        ),
      )}
      {erro && <p className="erro">{erro}</p>}
      <h2 className="subtitulo">Nova área</h2>
      <FormArea
        rotulo="Adicionar"
        onSalvar={async (entrada, setErroForm, limpar) => {
          if (await salvarArea(novaArea(entrada, areas, novoId()), setErroForm)) limpar()
        }}
      />
    </section>
  )
}

function FormArea(props: {
  inicial?: Area
  rotulo: string
  onSalvar: (
    entrada: { nome: string; taxa: number },
    setErro: (e: string | null) => void,
    limpar: () => void,
  ) => void
  onCancelar?: () => void
}) {
  const [nome, setNome] = useState(props.inicial?.nome ?? '')
  const [taxa, setTaxa] = useState(props.inicial ? paraCampo(props.inicial.taxa) : '')
  const [erro, setErro] = useState<string | null>(null)

  return (
    <div className="pilha-curta form-area">
      <div className="linha-form-area">
        <label className="campo">
          <span>Nome</span>
          <input value={nome} autoComplete="off" onChange={(e) => (setNome(e.target.value), setErro(null))} />
        </label>
        <CampoReais rotulo="Taxa" valor={taxa} onChange={(t) => (setTaxa(t), setErro(null))} />
      </div>
      <div className={props.onCancelar ? 'lado-a-lado' : undefined}>
        {props.onCancelar && (
          <button type="button" className="secundario" onClick={props.onCancelar}>
            Cancelar
          </button>
        )}
        <button
          type="button"
          className="primario"
          onClick={() => {
            const valor = lerReais(taxa)
            props.onSalvar({ nome, taxa: valor ?? NaN }, setErro, () => {
              setNome('')
              setTaxa('')
            })
          }}
        >
          {props.rotulo}
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}

function ValoresPadrao({ ajustes }: { ajustes: Ajustes }) {
  const [caixa, setCaixa] = useState(paraCampo(ajustes.caixaPadrao))
  const [diaria, setDiaria] = useState(paraCampo(ajustes.diariaPadrao))
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  async function salvar() {
    const caixaPadrao = lerReais(caixa)
    const diariaPadrao = lerReais(diaria)
    if (caixaPadrao === null) return setMsg({ ok: false, texto: 'Caixa inválido.' })
    if (diariaPadrao === null) return setMsg({ ok: false, texto: 'Diária inválida.' })
    const r = editarAjustes({ caixaPadrao, diariaPadrao })
    if (!r.ok) return setMsg({ ok: false, texto: r.erro })
    try {
      await repo.salvarAjustes(r.valor)
      setMsg({ ok: true, texto: 'Salvo. Vale para as próximas noites.' })
    } catch (e) {
      setMsg({ ok: false, texto: mensagemDeErro(e) })
    }
  }

  return (
    <section className="bloco pilha-curta">
      <h2>Valores padrão</h2>
      <p className="discreto pequeno">Preenchem o "Abrir noite". A noite aberta muda pelo "Editar" dela.</p>
      <div className="lado-a-lado">
        <CampoReais rotulo="Caixa" valor={caixa} onChange={(t) => (setCaixa(t), setMsg(null))} />
        <CampoReais rotulo="Diária" valor={diaria} onChange={(t) => (setDiaria(t), setMsg(null))} />
      </div>
      <button type="button" className="primario" onClick={salvar}>
        Salvar
      </button>
      {msg && <p className={msg.ok ? 'sucesso' : 'erro'}>{msg.texto}</p>}
    </section>
  )
}
