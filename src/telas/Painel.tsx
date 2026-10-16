import type { SupabaseClient } from '@supabase/supabase-js'
import { useMemo, useState } from 'react'
import { calcularAcerto } from '../domain/acerto'
import { dataDaNoite, formatarData, formatarHora } from '../domain/datas'
import { formatarNumero, formatarReais, lerReais, paraCampo } from '../domain/dinheiro'
import {
  montarAcerto,
  montarFolha,
  resumirNoiteDaEquipe,
  textoLiquidacao,
  type ColunaFolha,
  type ResumoDaNoite,
} from '../domain/painel'
import type { Area, Comanda } from '../domain/tipos'
import { acoesPainel, usePainel } from '../data/painel'
import { sair, type Usuario } from '../data/sessao'
import { AcertoDoLuan, Conta, EntregasPorCidade, Maquininha, Papeis } from '../ui/BlocosAcerto'
import { BotaoConfirmar } from '../ui/BotaoConfirmar'
import { CampoReais } from '../ui/CampoReais'
import { mensagemDeErro } from '../ui/erro'
import { Icone, type NomeIcone } from '../ui/Icone'

type Acoes = ReturnType<typeof acoesPainel>

/** Painel do Luan (/painel, só expedição e admin): a folha da noite em tempo real. */
export function Painel({ sb, usuario }: { sb: SupabaseClient; usuario: Usuario }) {
  const [data, setData] = useState(() => dataDaNoite(new Date()))
  const [vista, setVista] = useState<'folha' | 'resumo'>('folha')
  const [caixaId, setCaixaId] = useState<string | null>(null)
  const { dados, erro, recarregar } = usePainel(sb, data)
  const acoes = useMemo(() => acoesPainel(sb), [sb])
  const colunas = useMemo(() => (dados ? montarFolha(dados.caixas, dados.comandas, dados.acertos) : []), [dados])
  const aberta = colunas.find((c) => c.caixa.noite.id === caixaId)

  return (
    <main className="app painel pilha">
      <header className="topo">
        <div>
          <h1>{aberta ? `${aberta.posicao} ${aberta.caixa.nome}` : 'Folha da noite'}</h1>
          <p className="discreto pequeno">
            {usuario.nome} · {usuario.papel === 'admin' ? 'Admin' : 'Expedição'}
          </p>
        </div>
        {!aberta && (
          <label className="campo campo-data">
            <span className="so-leitor">Data</span>
            <input type="date" value={data} onChange={(e) => e.target.value && (setData(e.target.value), setCaixaId(null))} />
          </label>
        )}
      </header>
      {erro && <p className="aviso">{erro}</p>}

      {aberta && dados ? (
        <CaixaNoPainel
          key={aberta.caixa.noite.id}
          col={aberta}
          comandas={dados.comandas.filter((c) => c.noiteId === aberta.caixa.noite.id)}
          areas={dados.areas}
          acoes={acoes}
          admin={usuario.papel === 'admin'}
          recarregar={recarregar}
          voltar={() => setCaixaId(null)}
        />
      ) : (
        <>
          <div className="chips chips-2 segmentos" role="group" aria-label="Vista">
            {(['folha', 'resumo'] as const).map((v) => (
              <button key={v} type="button" className="chip" aria-pressed={vista === v} onClick={() => setVista(v)}>
                {v === 'folha' ? 'Folha' : 'Resumo da noite'}
              </button>
            ))}
          </div>
          {!dados ? (
            <p className="carregando">Carregando…</p>
          ) : colunas.length === 0 ? (
            <div className="vazio">
              <Icone nome="moto" tamanho={28} />
              <strong>Nenhum caixa em {formatarData(data)}</strong>
              <span className="pequeno">As colunas aparecem quando os motoboys abrem a noite no app.</span>
            </div>
          ) : vista === 'folha' ? (
            <Folha colunas={colunas} abrir={setCaixaId} />
          ) : (
            <Resumo resumo={resumirNoiteDaEquipe(colunas)} areas={dados.areas} />
          )}
        </>
      )}

      <footer className="rodape-painel">
        {usuario.papel === 'admin' && (
          <a className="botao secundario" href="/">
            <Icone nome="moto" tamanho={18} />
            App do motoboy
          </a>
        )}
        <button type="button" className="secundario" onClick={sair}>
          <Icone nome="sair" tamanho={18} />
          Sair
        </button>
      </footer>
    </main>
  )
}

const ICONE_STATUS: Record<Comanda['status'], NomeIcone> = { em_rota: 'moto', entregue: 'check', voltou: 'voltou' }

/** Como a folha de papel: uma coluna por motoboy, na ordem de chegada. */
function Folha({ colunas, abrir }: { colunas: ColunaFolha[]; abrir: (id: string) => void }) {
  return (
    <div className="folha">
      {colunas.map((col) => (
        <button key={col.caixa.noite.id} type="button" className="coluna-folha" onClick={() => abrir(col.caixa.noite.id)}>
          <span className="coluna-titulo">
            <span className="num">{col.posicao}</span> {col.caixa.nome}
          </span>
          <span className="itens-folha">
            {col.itens.map((i) => (
              <span key={i.comanda.id} className={`item-folha status-${i.comanda.status}`}>
                <span className="icone-status">
                  <Icone nome={ICONE_STATUS[i.comanda.status]} tamanho={14} />
                </span>
                <span className="codigo">{i.comanda.codigo}</span>
                <span className="forma">{i.comanda.status === 'voltou' ? 'voltou' : i.forma}</span>
                {i.trocoPix > 0 && <span className="num troco">→{formatarNumero(i.trocoPix)}</span>}
                {i.papelPendente && (
                  <span className="papel-pendente" title="Papel não conferido">
                    •
                  </span>
                )}
              </span>
            ))}
            {col.itens.length === 0 && <span className="discreto pequeno">Nenhuma comanda ainda</span>}
          </span>
          <span className="rodape-folha">
            <span className="num">
              {formatarData(col.caixa.noite.data).slice(0, 5)} · {formatarNumero(col.caixa.noite.caixaInicial)}
            </span>
            <span>
              {col.entregas} {col.entregas === 1 ? 'entrega' : 'entregas'}
            </span>
            <span className="linha-valor">
              Devolve <span className="num">{formatarNumero(col.conta.devolver)}</span>
            </span>
            <span className="linha-valor">
              Recebe <span className="num">{formatarNumero(col.conta.receber)}</span>
            </span>
            <span className={`estado-acerto ${col.confirmado ? 'confirmado' : 'pendente'}`}>
              {col.confirmado ? 'Confirmado' : col.caixa.noite.fechadaEm ? 'Pendente · fechou' : 'Pendente'}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** Caixa do motoboy: conta completa, cidades, maquininha, papéis, dinheiro contado e confirmação. */
function CaixaNoPainel(props: {
  col: ColunaFolha
  comandas: Comanda[]
  areas: Area[]
  acoes: Acoes
  admin: boolean
  recarregar: () => void
  voltar: () => void
}) {
  const { col, acoes } = props
  const noite = col.caixa.noite
  const [contado, setContado] = useState(noite.dinheiroContado === null ? '' : paraCampo(noite.dinheiroContado))
  const [erro, setErro] = useState<string | null>(null)
  const valorContado = contado.trim() === '' ? null : lerReais(contado)
  // A conta acompanha o que está sendo digitado, antes de gravar.
  const conta = calcularAcerto({ ...noite, dinheiroContado: valorContado }, props.comandas)
  const conf = conta.conferencia
  const faltamPapeis = props.comandas.filter((c) => !c.papelConferido).length

  async function agir(acao: () => Promise<void>) {
    try {
      await acao()
      setErro(null)
      props.recarregar()
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const gravarContado = () => {
    if (valorContado === undefined || (contado.trim() !== '' && valorContado === null)) return setErro('Valor inválido.')
    if (valorContado !== noite.dinheiroContado) agir(() => acoes.registrarContado(noite.id, valorContado))
  }

  async function confirmar() {
    const r = montarAcerto({ ...noite, dinheiroContado: valorContado }, props.comandas)
    if (!r.ok) return setErro(r.erro)
    await agir(async () => {
      if (valorContado !== noite.dinheiroContado) await acoes.registrarContado(noite.id, valorContado)
      await acoes.confirmarAcerto(r.valor)
    })
  }

  return (
    <>
      <button type="button" className="link alinha-inicio" onClick={props.voltar}>
        <Icone nome="voltar" tamanho={18} />
        Folha
      </button>
      <div className="pilulas">
        <span className="pilula">
          {formatarData(noite.data)} · caixa {formatarReais(noite.caixaInicial)}
        </span>
        {noite.fechadaEm ? (
          <span className="pilula fechada">Motoboy fechou às {formatarHora(noite.fechadaEm)}</span>
        ) : (
          <span className="pilula aberta">Motoboy ainda lançando</span>
        )}
        <span className={`pilula ${col.confirmado ? 'confirmado' : 'aguardando'}`}>
          {col.confirmado ? 'Confirmado' : 'Pendente'}
        </span>
      </div>

      {col.confirmado ? (
        <>
          <AcertoDoLuan confirmado={col.confirmado} painel />
          {props.admin && (
            <BotaoConfirmar
              className="perigo"
              confirmacao="Toque de novo para reabrir"
              onConfirmar={() => agir(() => acoes.reabrirAcerto(noite.id))}
            >
              Reabrir acerto
            </BotaoConfirmar>
          )}
        </>
      ) : (
        <section className="bloco">
          <h2>Acerto</h2>
          <CampoReais
            rotulo="Dinheiro contado"
            valor={contado}
            placeholder={paraCampo(conta.devolver)}
            onChange={(t) => (setContado(t), setErro(null))}
            aoSair={gravarContado}
          />
          {conf && (
            <>
              <div className={`resultado ${conf.situacao}`}>
                {conf.situacao === 'bateu' && <p>Bateu.</p>}
                {conf.situacao === 'falta' && <p>Faltou {formatarReais(conf.falta)}.</p>}
                {conf.situacao === 'sobra' && <p>Sobrou {formatarReais(conf.sobra)}: fica retida até descobrir a origem.</p>}
                <p>
                  <strong>{textoLiquidacao(conf)}</strong>
                </p>
              </div>
              <dl className="liquidacao">
                <div>
                  <dt>Pago ao motoboy</dt>
                  <dd>{formatarReais(conf.pagar)}</dd>
                </div>
                <div>
                  <dt>Do caixa dele</dt>
                  <dd>{formatarReais(conf.doCaixaDele)}</dd>
                </div>
                <div>
                  <dt>Retirado do caixa da empresa</dt>
                  <dd>{formatarReais(conf.retiradoCaixaEmpresa)}</dd>
                </div>
                <div>
                  <dt>Vai para a empresa</dt>
                  <dd>{formatarReais(conf.vaiParaEmpresa)}</dd>
                </div>
              </dl>
            </>
          )}
          {faltamPapeis > 0 && conf && (
            <p className="aviso">
              {faltamPapeis} {faltamPapeis === 1 ? 'papel não conferido' : 'papéis não conferidos'}. Confira abaixo antes de
              confirmar.
            </p>
          )}
          <BotaoConfirmar
            className="primario"
            confirmacao="Toque de novo para confirmar e travar"
            onConfirmar={confirmar}
            desabilitado={!conf}
          >
            Confirmar acerto
          </BotaoConfirmar>
        </section>
      )}
      {erro && <p className="erro">{erro}</p>}

      <Papeis
        comandas={props.comandas}
        areas={props.areas}
        leitura={false}
        dica="Marque cada papel recebido."
        aoAlternar={(c) => agir(() => acoes.marcarPapel(c.id, !c.papelConferido))}
      />
      <Conta acerto={conta} />
      <EntregasPorCidade porArea={conta.porArea} areas={props.areas} />
      <Maquininha comandas={props.comandas} leitura />
    </>
  )
}

function Resumo({ resumo: r, areas }: { resumo: ResumoDaNoite; areas: Area[] }) {
  const linha = (rotulo: string, valor: number) => (
    <div>
      <dt>{rotulo}</dt>
      <dd>{formatarReais(valor)}</dd>
    </div>
  )
  const recebido = r.recebido
  return (
    <>
      <section className="bloco">
        <h2>Recebido por forma</h2>
        <dl className="liquidacao">
          {linha('Dinheiro', recebido.dinheiro)}
          {recebido.troco > 0 && linha('Troco por Pix (fica com o motoboy)', recebido.troco)}
          {linha('Cartão', recebido.cartao)}
          {linha('Pix na máquina', recebido.pixMaquina)}
          {linha('Pix antecipado', recebido.pixAntecipado)}
          {linha('Total', recebido.dinheiro + recebido.cartao + recebido.pixMaquina + recebido.pixAntecipado)}
        </dl>
      </section>
      <section className="bloco">
        <h2>Acertos</h2>
        <p className="discreto pequeno">
          {r.confirmados} {r.confirmados === 1 ? 'confirmado' : 'confirmados'}, {r.pendentes}{' '}
          {r.pendentes === 1 ? 'pendente' : 'pendentes'}
          {r.semContado > 0 && ` (${r.semContado} sem dinheiro contado, fora das somas abaixo)`}.
        </p>
        <dl className="liquidacao">
          {linha('Pago aos motoboys', r.pagoAosMotoboys)}
          {linha('Retirado do caixa da empresa', r.retiradoCaixaEmpresa)}
          {linha('Foi para a empresa', r.foiParaEmpresa)}
          {linha('Faltas', r.faltas)}
          {linha('Sobras', r.sobras)}
        </dl>
      </section>
      <EntregasPorCidade porArea={r.porArea} areas={areas} />
    </>
  )
}
