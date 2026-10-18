import { useState } from 'react'
import { alternarArea, editarArea, novaArea } from '../domain/ajustes'
import type { Resultado } from '../domain/comanda'
import { formatarReais, lerReais, paraCampo } from '../domain/dinheiro'
import type { Area } from '../domain/tipos'
import { novoId } from '../data/id'
import { CampoReais } from './CampoReais'
import { mensagemDeErro } from './erro'

async function salvarArea(
  r: Resultado<Area>,
  salvar: (a: Area) => Promise<void>,
  setErro: (e: string | null) => void,
): Promise<boolean> {
  if (!r.ok) {
    setErro(r.erro)
    return false
  }
  try {
    await salvar(r.valor)
    setErro(null)
    return true
  } catch (e) {
    setErro(mensagemDeErro(e))
    return false
  }
}

/** Áreas e taxas: editar, desativar e adicionar. `salvar` grava no aparelho ou direto na nuvem (painel). */
export function EditorAreas({ areas, salvar }: { areas: Area[]; salvar: (a: Area) => Promise<void> }) {
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
              if (await salvarArea(editarArea(a, entrada, areas), salvar, setErroForm)) setEditando(null)
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
            <button type="button" onClick={() => salvarArea(alternarArea(a, areas), salvar, setErro)}>
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
          if (await salvarArea(novaArea(entrada, areas, novoId()), salvar, setErroForm)) limpar()
        }}
      />
    </section>
  )
}

function FormArea(props: {
  inicial?: Area
  rotulo: string
  onSalvar: (entrada: { nome: string; taxa: number }, setErro: (e: string | null) => void, limpar: () => void) => void
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
