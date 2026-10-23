import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { calcularAcerto } from '../domain/acerto'
import { mudarPerfil, NOMES_PAPEL } from '../domain/ajustes'
import { dataDaNoite, formatarData, formatarHora, partesData, somarDias } from '../domain/datas'
import { formatarNumero, formatarReais, lerReais, paraCampo } from '../domain/dinheiro'
import {
  colunaPix,
  montarAcerto,
  montarFolha,
  numerosDaNoite,
  resumirNoiteDaEquipe,
  textoLiquidacao,
  type ColunaFolha,
  type NumerosDaNoite,
  type ResumoDaNoite,
} from '../domain/painel'
import type { Area, Comanda, Papel, Perfil } from '../domain/tipos'
import { linhasMedicao, nomeArquivoLeituras, paraCsv, resumirMedicao, type ResumoMedicao } from '../domain/medicao'
import { avisoAoFechar } from '../domain/noite'
import { baixarTexto } from '../data/arquivo'
import { acoesPainel, carregarLeituras, usePainel } from '../data/painel'
import { sair, type Usuario } from '../data/sessao'
import { AcertoDoLuan, Conta, EntregasPorCidade, Maquininha, Papeis } from '../ui/BlocosAcerto'
import { BotaoConfirmar } from '../ui/BotaoConfirmar'
import { CampoReais } from '../ui/CampoReais'
import { useAviso } from '../ui/desfazer'
import { EditorAreas } from '../ui/EditorAreas'
import { EscolherTema } from '../ui/EscolherTema'
import { mensagemDeErro, textoDoErro } from '../ui/erro'
import { Icone, type NomeIcone } from '../ui/Icone'
import { VerFoto } from '../ui/VerFoto'
import { AreasSoLeitura } from './TelaAjustes'

type Acoes = ReturnType<typeof acoesPainel>
type Vista = 'folha' | 'resumo' | 'ajustes'

const VISTAS: { id: Vista; rotulo: string; curto: string; icone: NomeIcone }[] = [
  { id: 'folha', rotulo: 'Folha da noite', curto: 'Folha', icone: 'painel' },
  { id: 'resumo', rotulo: 'Resumo da noite', curto: 'Resumo', icone: 'grafico' },
  { id: 'ajustes', rotulo: 'Áreas e equipe', curto: 'Ajustes', icone: 'equipe' },
]

/**
 * Painel do Luan (/painel, só expedição e admin): a folha da noite em tempo real, o resumo,
 * as áreas e a equipe. No computador, menu na lateral; no celular, abas embaixo.
 */
export function Painel({ sb, usuario, abrirApp }: { sb: SupabaseClient; usuario: Usuario; abrirApp?: () => void }) {
  // O painel fica aberto no computador de uma noite para a outra: "hoje" acompanha o relógio, e
  // quem estava na noite de hoje passa para a nova.
  const [hoje, setHoje] = useState(() => dataDaNoite(new Date()))
  const [data, setData] = useState(hoje)
  const hojeAntes = useRef(hoje)
  useEffect(() => {
    const conferir = () => {
      const antes = hojeAntes.current
      const agora = dataDaNoite(new Date())
      if (agora === antes) return
      hojeAntes.current = agora
      setHoje(agora)
      setData((d) => (d === antes ? agora : d))
    }
    const aoVoltar = () => document.visibilityState === 'visible' && conferir()
    const relogio = setInterval(conferir, 60_000)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearInterval(relogio)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [])
  const [vista, setVista] = useState<Vista>('folha')
  const [caixaId, setCaixaId] = useState<string | null>(null)
  const { dados, erro, recarregar } = usePainel(sb, data)
  const acoes = useMemo(() => acoesPainel(sb), [sb])
  const colunas = useMemo(() => (dados ? montarFolha(dados.caixas, dados.comandas, dados.acertos) : []), [dados])
  const aberta = colunas.find((c) => c.caixa.noite.id === caixaId)
  const aviso = useAviso()

  // O caixa aberto entra no histórico do navegador: o Voltar do celular volta para a folha.
  useEffect(() => {
    const aoVoltar = () => setCaixaId((history.state as { caixa?: string } | null)?.caixa ?? null)
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])
  const abrirCaixa = (id: string) => {
    history.pushState({ caixa: id }, '')
    setCaixaId(id)
  }
  const fecharCaixa = () => ((history.state as { caixa?: string } | null)?.caixa ? history.back() : setCaixaId(null))

  const irPara = (v: Vista) => {
    setVista(v)
    setCaixaId(null)
    window.scrollTo(0, 0)
  }
  const mudarData = (d: string) => {
    setData(d)
    setCaixaId(null)
  }

  /** Coluna PIX: tocar marca que o Pix caiu (pix_confirmado), com desfazer. */
  async function marcarPix(c: Comanda) {
    const caiu = !c.pixConfirmado
    try {
      await acoes.marcarPix(c.id, caiu)
      recarregar()
      aviso(`Pix da ${c.codigo} ${caiu ? 'caiu' : 'desmarcado'}`, async () => {
        await acoes.marcarPix(c.id, !caiu)
        recarregar()
      })
    } catch (e) {
      aviso(mensagemDeErro(e))
    }
  }

  const { semana } = partesData(data)
  const titulo = aberta ? `${aberta.posicao} ${aberta.caixa.nome}` : VISTAS.find((v) => v.id === vista)!.rotulo

  return (
    <div className="painel-casca">
      <nav className="abas painel-nav" aria-label="Painel">
        <div className="painel-marca">
          <Icone nome="painel" tamanho={22} />
          <span>
            <strong>Painel</strong>
            <span className="discreto pequeno">Acerto dos motoboys</span>
          </span>
        </div>
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-current={vista === v.id ? 'page' : undefined}
            onClick={() => irPara(v.id)}
          >
            <Icone nome={v.icone} tamanho={22} />
            <span className="rotulo-longo">{v.rotulo}</span>
            <span className="rotulo-curto">{v.curto}</span>
          </button>
        ))}
        {abrirApp && (
          <button type="button" className="painel-trocar" onClick={abrirApp}>
            <Icone nome="moto" tamanho={22} />
            <span className="rotulo-longo">Meu caixa no app</span>
            <span className="rotulo-curto">Meu caixa</span>
          </button>
        )}
        <div className="painel-quem">
          <span>
            <strong>{usuario.nome}</strong>
            <span className="discreto pequeno">{NOMES_PAPEL[usuario.papel]}</span>
          </span>
          <button type="button" className="secundario" onClick={sair}>
            <Icone nome="sair" tamanho={18} />
            Sair
          </button>
        </div>
      </nav>

      <main className="app painel pilha">
        <header className="topo topo-painel">
          <div>
            <h1>{titulo}</h1>
            {vista !== 'ajustes' && (
              <p className="discreto pequeno">
                Noite de {semana} {formatarData(data)}
                {data === hoje && ' · hoje'}
              </p>
            )}
          </div>
          {vista !== 'ajustes' && !aberta && <EscolherData data={data} hoje={hoje} mudar={mudarData} />}
        </header>
        {erro && <p className="aviso">{erro}</p>}

        {!dados ? (
          <p className="carregando">Carregando…</p>
        ) : vista === 'ajustes' ? (
          <AjustesDoPainel
            areas={dados.areas}
            perfis={dados.perfis}
            usuario={usuario}
            acoes={acoes}
            recarregar={recarregar}
          />
        ) : aberta ? (
          <CaixaNoPainel
            key={aberta.caixa.noite.id}
            col={aberta}
            comandas={dados.comandas.filter((c) => c.noiteId === aberta.caixa.noite.id)}
            areas={dados.areas}
            acoes={acoes}
            admin={usuario.papel === 'admin'}
            recarregar={recarregar}
            voltar={fecharCaixa}
          />
        ) : colunas.length === 0 ? (
          <div className="vazio">
            <Icone nome="moto" tamanho={28} />
            <strong>Nenhum caixa em {formatarData(data)}</strong>
            <span className="pequeno">As colunas aparecem quando os motoboys abrem a noite no app.</span>
          </div>
        ) : vista === 'folha' ? (
          <>
            <NumerosNoite n={numerosDaNoite(colunas)} />
            <Folha colunas={colunas} abrir={abrirCaixa} marcarPix={marcarPix} />
          </>
        ) : (
          <Resumo
            resumo={resumirNoiteDaEquipe(colunas)}
            areas={dados.areas}
            extra={<MedicaoLeituras sb={sb} data={data} perfis={dados.perfis} areas={dados.areas} />}
          />
        )}
      </main>
    </div>
  )
}

/** Noite anterior, a data, a próxima e "Hoje". */
function EscolherData({ data, hoje, mudar }: { data: string; hoje: string; mudar: (d: string) => void }) {
  return (
    <div className="escolher-data" role="group" aria-label="Noite">
      <button
        type="button"
        className="secundario so-icone"
        aria-label="Noite anterior"
        onClick={() => mudar(somarDias(data, -1))}
      >
        <Icone nome="voltar" tamanho={20} />
      </button>
      <label className="campo campo-data">
        <span className="so-leitor">Data</span>
        <input type="date" value={data} onChange={(e) => e.target.value && mudar(e.target.value)} />
      </label>
      <button
        type="button"
        className="secundario so-icone"
        aria-label="Próxima noite"
        disabled={data >= hoje}
        onClick={() => mudar(somarDias(data, 1))}
      >
        <Icone nome="avancar" tamanho={20} />
      </button>
      {data !== hoje && (
        <button type="button" className="secundario" onClick={() => mudar(hoje)}>
          Hoje
        </button>
      )}
    </div>
  )
}

/** A noite num relance, em cima da folha. */
function NumerosNoite({ n }: { n: NumerosDaNoite }) {
  const itens: { rotulo: string; valor: string; detalhe?: string; alerta?: boolean }[] = [
    { rotulo: 'Motoboys', valor: String(n.motoboys) },
    { rotulo: 'Em rota', valor: String(n.emRota) },
    {
      rotulo: 'Entregues',
      valor: String(n.entregues),
      detalhe: n.voltaram ? `${n.voltaram} ${n.voltaram === 1 ? 'voltou' : 'voltaram'}` : undefined,
    },
    { rotulo: 'Pix a conferir', valor: String(n.pixAConferir), alerta: n.pixAConferir > 0 },
    { rotulo: 'Acertos pendentes', valor: String(n.acertosPendentes), alerta: n.acertosPendentes > 0 },
    { rotulo: 'Devolvem', valor: formatarReais(n.devolver) },
    { rotulo: 'Recebem', valor: formatarReais(n.receber) },
  ]
  return (
    <dl className="numeros-noite">
      {itens.map((i) => (
        <div key={i.rotulo} className={i.alerta ? 'alerta' : undefined}>
          <dt>{i.rotulo}</dt>
          <dd className="num">{i.valor}</dd>
          {i.detalhe && <dd className="pequeno discreto">{i.detalhe}</dd>}
        </div>
      ))}
    </dl>
  )
}

const ICONE_STATUS: Record<Comanda['status'], NomeIcone> = { em_rota: 'moto', entregue: 'check', voltou: 'voltou' }

/** Como a folha de papel: uma coluna por motoboy, na ordem de chegada. */
function Folha(props: { colunas: ColunaFolha[]; abrir: (id: string) => void; marcarPix: (c: Comanda) => void }) {
  const { colunas, abrir } = props
  const pix = colunaPix(colunas)
  const caiu = pix.filter((p) => p.comanda.pixConfirmado).length
  return (
    <div className="folha">
      {colunas.map((col) => (
        <button
          key={col.caixa.noite.id}
          type="button"
          className="coluna-folha"
          onClick={() => abrir(col.caixa.noite.id)}
        >
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
                {i.comanda.fotoPath && (
                  <span className="tem-foto" aria-label="com foto">
                    <Icone nome="camera" tamanho={12} />
                  </span>
                )}
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
      <section className="coluna-folha coluna-pix" aria-label="PIX">
        <span className="coluna-titulo">PIX</span>
        <span className="itens-folha">
          {pix.map((p) => (
            <button
              key={p.comanda.id}
              type="button"
              className="item-pix"
              aria-pressed={p.comanda.pixConfirmado === true}
              onClick={() => props.marcarPix(p.comanda)}
            >
              <span className="codigo">{p.comanda.codigo}</span>
              <span className="estado-pix">{p.comanda.pixConfirmado ? 'caiu ✓' : 'conferir'}</span>
              <span className="quem">
                {p.nome} · <span className="num">{formatarNumero(p.valor)}</span>
              </span>
            </button>
          ))}
          {pix.length === 0 && <span className="discreto pequeno">Nenhum Pix antecipado</span>}
        </span>
        {pix.length > 0 && (
          <span className="rodape-folha">
            <span>
              {caiu} de {pix.length} {pix.length === 1 ? 'caiu' : 'caíram'}
            </span>
            <span className="linha-valor">
              Total <span className="num">{formatarNumero(pix.reduce((s, p) => s + p.valor, 0))}</span>
            </span>
          </span>
        )}
      </section>
    </div>
  )
}

/** Caixa do motoboy: conta completa, cidades, maquininha, papéis, dinheiro contado e confirmação. */
const textoContado = (v: number | null) => (v === null ? '' : paraCampo(v))

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
  const [contado, setContado] = useState(textoContado(noite.dinheiroContado))
  // O motoboy também grava o dinheiro contado: enquanto o Luan não mexe no campo, ele acompanha a
  // nuvem; ao sair, só grava se o Luan mudou o texto (e não regrava um valor velho).
  const mexeu = useRef(false)
  useEffect(() => {
    if (!mexeu.current) setContado(textoContado(noite.dinheiroContado))
  }, [noite.dinheiroContado])
  const [erro, setErro] = useState<string | null>(null)
  const [foto, setFoto] = useState<Comanda | null>(null)
  const carregarFoto = useCallback(() => acoes.urlDaFoto(foto!.fotoPath!), [acoes, foto])
  const valorContado = contado.trim() === '' ? null : lerReais(contado)
  // A conta acompanha o que está sendo digitado, antes de gravar.
  const conta = calcularAcerto({ ...noite, dinheiroContado: valorContado }, props.comandas)
  const conf = conta.conferencia
  const faltamPapeis = props.comandas.filter((c) => !c.papelConferido).length
  // R6: comanda ainda em rota conta como entregue; depois de confirmar, o motoboy não corrige mais.
  const emRota = avisoAoFechar(props.comandas)

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
    if (!mexeu.current) return
    if (valorContado === undefined || (contado.trim() !== '' && valorContado === null))
      return setErro('Valor inválido.')
    mexeu.current = false
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
      {foto?.fotoPath && <VerFoto titulo={foto.codigo} carregar={carregarFoto} fechar={() => setFoto(null)} />}
      <button type="button" className="link alinha-inicio" onClick={props.voltar}>
        <Icone nome="voltar" tamanho={18} />
        Folha
      </button>
      <div className="caixa-grade">
        <div className="pilha">
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
                onChange={(t) => {
                  mexeu.current = true
                  setContado(t)
                  setErro(null)
                }}
                aoSair={gravarContado}
              />
              {conf && (
                <>
                  <div className={`resultado ${conf.situacao}`}>
                    {conf.situacao === 'bateu' && <p>Bateu.</p>}
                    {conf.situacao === 'falta' && <p>Faltou {formatarReais(conf.falta)}.</p>}
                    {conf.situacao === 'sobra' && (
                      <p>Sobrou {formatarReais(conf.sobra)}: fica retida até descobrir a origem.</p>
                    )}
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
                  {faltamPapeis} {faltamPapeis === 1 ? 'papel não conferido' : 'papéis não conferidos'}. Confira abaixo
                  antes de confirmar.
                </p>
              )}
              {emRota && conf && <p className="aviso">{emRota} Confira com o motoboy antes de confirmar.</p>}
              <BotaoConfirmar
                className="primario"
                confirmacao={emRota ? 'Há comanda em rota: toque de novo para confirmar' : 'Toque de novo para confirmar e travar'}
                onConfirmar={confirmar}
                desabilitado={!conf}
              >
                Confirmar acerto
              </BotaoConfirmar>
            </section>
          )}
          {erro && <p className="erro">{erro}</p>}
          <Conta acerto={conta} />
        </div>
        <div className="pilha">
          <Papeis
            comandas={props.comandas}
            areas={props.areas}
            abrirFoto={setFoto}
            leitura={false}
            dica="Marque cada papel recebido."
            aoAlternar={(c) => agir(() => acoes.marcarPapel(c.id, !c.papelConferido))}
          />
          <EntregasPorCidade porArea={conta.porArea} areas={props.areas} />
          <Maquininha comandas={props.comandas} leitura />
        </div>
      </div>
    </>
  )
}

function Resumo({ resumo: r, areas, extra }: { resumo: ResumoDaNoite; areas: Area[]; extra?: ReactNode }) {
  const linha = (rotulo: string, valor: number) => (
    <div>
      <dt>{rotulo}</dt>
      <dd>{formatarReais(valor)}</dd>
    </div>
  )
  const recebido = r.recebido
  return (
    <div className="grade-blocos">
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
      {extra}
    </div>
  )
}

const PAPEIS: Papel[] = ['motoboy', 'expedicao', 'admin']

/** Áreas e taxas e a equipe (só o admin muda, R18), o tema e a conta. */
function AjustesDoPainel(props: {
  areas: Area[]
  perfis: Perfil[]
  usuario: Usuario
  acoes: Acoes
  recarregar: () => void
}) {
  const { acoes, recarregar } = props
  return (
    <div className="grade-blocos">
      {props.usuario.papel === 'admin' ? (
        <EditorAreas
          areas={props.areas}
          salvar={async (a) => {
            await acoes.salvarArea(a)
            recarregar()
          }}
        />
      ) : (
        <AreasSoLeitura areas={props.areas} />
      )}
      <Equipe perfis={props.perfis} eu={props.usuario} acoes={acoes} recarregar={recarregar} />
      <EscolherTema />
      <section className="bloco pilha-curta so-celular">
        <h2>Conta</h2>
        <p>
          <strong>{props.usuario.nome}</strong> · {NOMES_PAPEL[props.usuario.papel]}
          <br />
          <span className="discreto pequeno">{props.usuario.email}</span>
        </p>
        <button type="button" className="perigo" onClick={sair}>
          <Icone nome="sair" tamanho={18} />
          Sair
        </button>
      </section>
    </div>
  )
}

function Equipe(props: { perfis: Perfil[]; eu: Usuario; acoes: Acoes; recarregar: () => void }) {
  const { eu, acoes, recarregar } = props
  const aviso = useAviso()
  const admin = eu.papel === 'admin'

  async function mudar(p: Perfil, mudanca: Partial<Pick<Perfil, 'papel' | 'ativo'>>) {
    const r = mudarPerfil(eu, p, mudanca)
    if (!r.ok) return aviso(r.erro)
    try {
      await acoes.mudarPerfil(r.valor)
      recarregar()
      const texto =
        mudanca.ativo === undefined
          ? `${p.nome} agora é ${NOMES_PAPEL[r.valor.papel].toLowerCase()}`
          : `${p.nome} ${r.valor.ativo ? 'ativado' : 'desativado'}`
      aviso(texto, async () => {
        await acoes.mudarPerfil(p)
        recarregar()
      })
    } catch (e) {
      aviso(mensagemDeErro(e))
    }
  }

  return (
    <section className="bloco pilha-curta">
      <h2>Equipe</h2>
      <p className="discreto pequeno">
        {admin
          ? 'Cada um cria a conta pelo app e entra como motoboy. Aqui você escolhe o papel.'
          : 'Só o admin muda os papéis.'}
      </p>
      {props.perfis.map((p) => (
        <div key={p.id} className={`linha-equipe ${p.ativo ? '' : 'inativa'}`}>
          <div className="linha-equipe-nome">
            <strong>{p.nome}</strong>
            <span className="discreto pequeno">
              {p.id === eu.id ? ' · você' : ''}
              {p.ativo ? '' : ' · desativado'}
            </span>
          </div>
          {admin && p.id !== eu.id ? (
            <div className="linha-equipe-acoes">
              <div className="chips chips-3" role="group" aria-label={`Papel de ${p.nome}`}>
                {PAPEIS.map((papel) => (
                  <button
                    key={papel}
                    type="button"
                    className="chip"
                    aria-pressed={p.papel === papel}
                    onClick={() => p.papel !== papel && mudar(p, { papel })}
                  >
                    {NOMES_PAPEL[papel]}
                  </button>
                ))}
              </div>
              {p.ativo ? (
                <BotaoConfirmar
                  className="secundario"
                  confirmacao="Toque de novo para desativar"
                  onConfirmar={() => mudar(p, { ativo: false })}
                >
                  Desativar
                </BotaoConfirmar>
              ) : (
                <button type="button" className="secundario" onClick={() => mudar(p, { ativo: true })}>
                  Ativar
                </button>
              )}
            </div>
          ) : (
            <span className="pilula">{NOMES_PAPEL[p.papel]}</span>
          )}
        </div>
      ))}
    </section>
  )
}

/** R27: exporta as leituras por foto em CSV para medir, com o resumo do período. */
function MedicaoLeituras(props: { sb: SupabaseClient; data: string; perfis: Perfil[]; areas: Area[] }) {
  const [resumo, setResumo] = useState<ResumoMedicao | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  async function exportar(de: string) {
    setMsg(null)
    try {
      const leituras = await carregarLeituras(props.sb, de, props.data, props.perfis)
      setResumo(leituras.length ? resumirMedicao(leituras) : null)
      if (!leituras.length) return setMsg({ ok: false, texto: 'Nenhuma leitura nesse período.' })
      // O BOM faz o Excel mostrar os acentos.
      const csv = '\uFEFF' + paraCsv(linhasMedicao(leituras, props.areas))
      baixarTexto(csv, nomeArquivoLeituras(de, props.data), 'text/csv;charset=utf-8')
      setMsg({ ok: true, texto: `${leituras.length} ${leituras.length === 1 ? 'leitura exportada' : 'leituras exportadas'}.` })
    } catch (e) {
      setMsg({ ok: false, texto: textoDoErro(e) })
    }
  }

  const linha = (rotulo: string, valor: string) => (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  )
  return (
    <section className="bloco pilha-curta">
      <h2>Leituras por foto</h2>
      <p className="discreto pequeno">Para medir quantas verdes estavam erradas (meta: zero) e o tempo por comanda.</p>
      <div className="lado-a-lado">
        <button type="button" className="secundario" onClick={() => exportar(props.data)}>
          <Icone nome="baixar" tamanho={18} />
          Desta noite
        </button>
        <button type="button" className="secundario" onClick={() => exportar(somarDias(props.data, -29))}>
          <Icone nome="baixar" tamanho={18} />
          Últimos 30 dias
        </button>
      </div>
      {resumo && (
        <dl className="liquidacao">
          {linha('Leituras', String(resumo.total))}
          {linha('Verdes', String(resumo.verdes))}
          {linha('Verdes erradas', String(resumo.verdesErradas))}
          {linha('Amarelas', String(resumo.amarelas))}
          {linha('Vermelhas', String(resumo.vermelhas))}
          {linha('Lançadas assim (forçadas)', String(resumo.forcadas))}
          {resumo.segundosMedio !== null && linha('Tempo médio por comanda', `${resumo.segundosMedio} s`)}
        </dl>
      )}
      {msg && <p className={msg.ok ? 'sucesso' : 'erro'}>{msg.texto}</p>}
    </section>
  )
}
