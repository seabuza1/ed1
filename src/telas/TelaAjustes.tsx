import { useState } from 'react'
import { alternarArea, editarAjustes, editarArea, novaArea } from '../domain/ajustes'
import type { Resultado } from '../domain/comanda'
import { formatarDataHora } from '../domain/datas'
import { formatarReais, lerReais, paraCampo } from '../domain/dinheiro'
import type { Ajustes, Area } from '../domain/tipos'
import { procurarAtualizacao } from '../data/atualizacao'
import { novoId } from '../data/id'
import { repo } from '../data/repo'
import { ehEquipe, sair, useUsuario, type Usuario } from '../data/sessao'
import { BotaoConfirmar } from '../ui/BotaoConfirmar'
import { CampoReais } from '../ui/CampoReais'
import { mensagemDeErro } from '../ui/erro'
import { Icone } from '../ui/Icone'
import { lerTema, salvarTema, type Tema } from '../ui/tema'

const TEMAS: { id: Tema; rotulo: string }[] = [
  { id: 'sistema', rotulo: 'Sistema' },
  { id: 'escuro', rotulo: 'Escuro' },
  { id: 'claro', rotulo: 'Claro' },
]

function EscolherTema() {
  const [tema, setTema] = useState(lerTema)
  return (
    <section className="bloco pilha-curta">
      <h2>Tema</h2>
      <div className="chips chips-3" role="group" aria-label="Tema">
        {TEMAS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            aria-pressed={tema === t.id}
            onClick={() => {
              setTema(t.id)
              salvarTema(t.id)
            }}
          >
            {t.rotulo}
          </button>
        ))}
      </div>
    </section>
  )
}

export function TelaAjustes(props: { areas: Area[]; ajustes: Ajustes; voltar: () => void }) {
  const usuario = useUsuario()
  // Com nuvem, as áreas são da pizzaria: só a expedição e o admin mudam.
  const editaAreas = !repo.nuvem || ehEquipe(usuario)
  return (
    <main className="app pilha">
      <button type="button" className="link alinha-inicio" onClick={props.voltar}>
        <Icone nome="voltar" tamanho={18} />
        Histórico
      </button>
      <h1>Ajustes</h1>
      {usuario && <Conta usuario={usuario} />}
      <EscolherTema />
      {editaAreas ? <Areas areas={props.areas} /> : <AreasSoLeitura areas={props.areas} />}
      <ValoresPadrao key={`${props.ajustes.caixaPadrao}-${props.ajustes.diariaPadrao}`} ajustes={props.ajustes} />
      <SobreApp />
    </main>
  )
}

const NOMES_PAPEL = { motoboy: 'Motoboy', expedicao: 'Expedição', admin: 'Admin' }

function Conta({ usuario }: { usuario: Usuario }) {
  const pendentes = repo.sync?.obter().pendentes ?? 0
  return (
    <section className="bloco">
      <h2>Conta</h2>
      <p>
        <strong>{usuario.nome}</strong> · {NOMES_PAPEL[usuario.papel]}
        <br />
        <span className="discreto pequeno">{usuario.email}</span>
      </p>
      {ehEquipe(usuario) && (
        <a className="botao secundario" href="/painel">
          <Icone nome="painel" tamanho={18} />
          Painel da expedição
        </a>
      )}
      {pendentes > 0 ? (
        <>
          <p className="aviso">
            {pendentes} {pendentes === 1 ? 'alteração ainda não subiu' : 'alterações ainda não subiram'} para a nuvem. Elas
            ficam guardadas neste celular e sobem quando você entrar de novo.
          </p>
          <BotaoConfirmar className="perigo" confirmacao="Toque de novo para sair" onConfirmar={sair}>
            <Icone nome="sair" tamanho={18} />
            Sair
          </BotaoConfirmar>
        </>
      ) : (
        <button type="button" className="perigo" onClick={sair}>
          <Icone nome="sair" tamanho={18} />
          Sair
        </button>
      )}
    </section>
  )
}

function AreasSoLeitura({ areas }: { areas: Area[] }) {
  return (
    <section className="bloco">
      <h2>Áreas e taxas</h2>
      <p className="discreto pequeno">Definidas pela expedição.</p>
      {areas
        .filter((a) => a.ativa)
        .map((a) => (
          <div key={a.id} className="linha-area">
            <strong>{a.nome}</strong>
            <span className="num">{formatarReais(a.taxa)}</span>
          </div>
        ))}
    </section>
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
      <h2>
        Áreas e taxas
      </h2>
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
      <h2>
        Valores padrão
      </h2>
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

const TEXTO_ATUALIZACAO = {
  atualizando: 'Baixando a versão nova. O app recarrega sozinho em instantes.',
  'em-dia': 'Você já está na versão mais nova.',
  'sem-internet': 'Sem internet agora. Tente de novo com conexão.',
}

function SobreApp() {
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <section className="bloco pilha-curta">
      <h2>
        App
      </h2>
      <p className="discreto pequeno">
        Versão {__VERSAO__} de {formatarDataHora(__COMPILADO_EM__)}. O app se atualiza sozinho ao abrir ou ao voltar
        para ele.
      </p>
      <button
        type="button"
        className="secundario"
        onClick={async () => {
          setMsg('Procurando…')
          setMsg(TEXTO_ATUALIZACAO[await procurarAtualizacao()])
        }}
      >
        <Icone nome="atualizar" tamanho={18} />
        Procurar atualização
      </button>
      {msg && <p className="discreto">{msg}</p>}
    </section>
  )
}
