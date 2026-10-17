import { useState } from 'react'
import { editarAjustes, NOMES_PAPEL } from '../domain/ajustes'
import { formatarDataHora } from '../domain/datas'
import { formatarReais, lerReais, paraCampo } from '../domain/dinheiro'
import type { Ajustes, Area } from '../domain/tipos'
import { procurarAtualizacao } from '../data/atualizacao'
import { repo } from '../data/repo'
import { ehEquipe, sair, useUsuario, type Usuario } from '../data/sessao'
import { BotaoConfirmar } from '../ui/BotaoConfirmar'
import { CampoReais } from '../ui/CampoReais'
import { mensagemDeErro } from '../ui/erro'
import { Icone } from '../ui/Icone'
import { EditorAreas } from '../ui/EditorAreas'
import { EscolherTema } from '../ui/EscolherTema'

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
      {editaAreas ? <EditorAreas areas={props.areas} salvar={repo.salvarArea} /> : <AreasSoLeitura areas={props.areas} />}
      <ValoresPadrao key={`${props.ajustes.caixaPadrao}-${props.ajustes.diariaPadrao}`} ajustes={props.ajustes} />
      <SobreApp />
    </main>
  )
}

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
