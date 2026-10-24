import { useEffect, useRef, useState } from 'react'
import {
  calcularAcerto,
  compararComLuan,
  diferencaLuan,
  registrarContado,
  registrarLuan,
  tipoDiferenca,
  type Acerto,
  type TipoDiferenca,
} from '../domain/acerto'
import { marcarConferido, marcarPapel, type Resultado } from '../domain/comanda'
import { formatarData, formatarHora } from '../domain/datas'
import { formatarReais, lerReais, paraCampo } from '../domain/dinheiro'
import { avisoAoFechar, fecharNoite, reabrirNoite } from '../domain/noite'
import type { AcertoConfirmado, Area, Comanda, Noite } from '../domain/tipos'
import { agora } from '../data/id'
import { repo } from '../data/repo'
import { BarraTotais } from '../ui/BarraTotais'
import { AcertoDoLuan, Conta, EntregasPorCidade, Maquininha, Papeis } from '../ui/BlocosAcerto'
import { BotaoConfirmar } from '../ui/BotaoConfirmar'
import { CampoReais } from '../ui/CampoReais'
import { mensagemDeErro } from '../ui/erro'
import { Icone } from '../ui/Icone'
import { ListasComandas } from './ListasComandas'

/** Acerto de uma noite. Fechada = só leitura, com Reabrir. */
export function TelaAcerto(props: {
  noite: Noite | undefined
  noites: Noite[]
  comandas: Comanda[]
  areas: Area[]
  /** Confirmado pelo Luan (com nuvem): trava a noite. */
  acerto: AcertoConfirmado | null
  /** Aberta pelo histórico: mostra as comandas e o botão de voltar. */
  voltar?: () => void
}) {
  if (!props.noite)
    return (
      <main className="app">
        <div className="vazio">
          <span className="icone-grande">
            <Icone nome="acerto" tamanho={28} />
          </span>
          <strong>Nenhuma noite ainda</strong>
          <span className="pequeno">Abra a noite na aba Noite para começar.</span>
        </div>
      </main>
    )
  return <ConteudoAcerto key={props.noite.id} {...props} noite={props.noite} />
}

/** Texto digitado → centavos; '' → null; inválido → undefined. */
const lerOpcional = (t: string) => (t.trim() === '' ? null : (lerReais(t) ?? undefined))
const campo = (v: number | null) => (v === null ? '' : paraCampo(v))

function ConteudoAcerto(props: {
  noite: Noite
  noites: Noite[]
  comandas: Comanda[]
  areas: Area[]
  acerto: AcertoConfirmado | null
  voltar?: () => void
}) {
  const { noite, comandas } = props
  const confirmado = props.acerto
  const leitura = noite.fechadaEm !== null || confirmado !== null
  const acerto = calcularAcerto(noite, comandas)
  const [erro, setErro] = useState<string | null>(null)

  async function atualizar(r: Resultado<Partial<Noite>>) {
    if (!r.ok) return setErro(r.erro)
    setErro(null)
    try {
      await repo.atualizarNoite(noite.id, r.valor)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const aviso = leitura ? null : avisoAoFechar(comandas)

  return (
    <>
      <BarraTotais acerto={acerto} />
      <main className="app app-larga pilha">
        {props.voltar && (
          <button type="button" className="link alinha-inicio" onClick={props.voltar}>
            <Icone nome="voltar" tamanho={18} />
            Voltar ao histórico
          </button>
        )}
        <div className="topo">
          <div>
            <h1>Acerto de {formatarData(noite.data)}</h1>
            <div className="pilulas">
              {noite.fechadaEm !== null ? (
                <span className="pilula fechada">
                  <Icone nome="cadeado" tamanho={13} />
                  Fechada às {formatarHora(noite.fechadaEm)}
                </span>
              ) : (
                <span className="pilula aberta">Noite aberta</span>
              )}
              {repo.nuvem &&
                (confirmado ? (
                  <span className="pilula confirmado">
                    <Icone nome="check" tamanho={13} />
                    Confirmado{confirmado.confirmadoPorNome ? ` por ${confirmado.confirmadoPorNome}` : ''} às{' '}
                    {formatarHora(confirmado.confirmadoEm)}
                  </span>
                ) : (
                  <span className="pilula aguardando">Aguardando o Luan</span>
                ))}
            </div>
          </div>
        </div>

        {/* No celular, uma coluna nesta ordem; no computador, a conta e o fechar à esquerda e o que
            conferir à direita. */}
        <div className="grade-acerto">
          <div className="pilha acerto-conta">
            <Conta acerto={acerto} />
            {aviso && <p className="aviso">{aviso}</p>}
            <Conferencia noite={noite} acerto={acerto} leitura={leitura} atualizar={atualizar} />
          </div>
          <div className="pilha acerto-conferir">
            <Papeis
              comandas={comandas}
              areas={props.areas}
              leitura={leitura}
              dica="Toque quando entregar ao Luan."
              aoAlternar={(c) => repo.salvarComanda(marcarPapel(c, !c.papelConferido, agora()))}
            />
            <Maquininha
              comandas={comandas}
              leitura={leitura}
              aoAlternar={(c, indice, conferido) => repo.salvarComanda(marcarConferido(c, indice, conferido, agora()))}
            />
            <EntregasPorCidade porArea={acerto.porArea} areas={props.areas} />
            {confirmado ? (
              <AcertoDoLuan confirmado={confirmado} />
            ) : (
              !repo.nuvem && <ComparacaoLuan noite={noite} acerto={acerto} leitura={leitura} atualizar={atualizar} />
            )}
          </div>
          <div className="pilha acerto-fechar">
            {erro && <p className="erro">{erro}</p>}
            {confirmado ? null : leitura ? (
              <button
                type="button"
                className="secundario"
                onClick={() => {
                  const r = reabrirNoite(noite, props.noites)
                  atualizar(r.ok ? { ok: true, valor: { fechadaEm: r.valor.fechadaEm } } : r)
                }}
              >
                <Icone nome="cadeado" tamanho={18} />
                Reabrir
              </button>
            ) : (
              <BotaoConfirmar
                className="primario"
                confirmacao="Toque de novo para fechar"
                onConfirmar={() => atualizar({ ok: true, valor: { fechadaEm: fecharNoite(noite, agora()).fechadaEm } })}
              >
                Fechar a noite
              </BotaoConfirmar>
            )}
          </div>
        </div>

        {props.voltar && (
          <section className="pilha">
            <h2 className="titulo-secao">Comandas</h2>
            <ListasComandas comandas={comandas} areas={props.areas} somenteLeitura />
          </section>
        )}
      </main>
    </>
  )
}

type Atualizar = (r: Resultado<Partial<Noite>>) => void

function Conferencia(props: { noite: Noite; acerto: Acerto; leitura: boolean; atualizar: Atualizar }) {
  const [contado, setContado] = useState(campo(props.noite.dinheiroContado))
  // O Luan também registra o dinheiro contado no painel: fora do campo, ele acompanha a nuvem.
  const digitando = useRef(false)
  const valorNuvem = props.noite.dinheiroContado
  useEffect(() => {
    if (!digitando.current) setContado(campo(valorNuvem))
  }, [valorNuvem])
  const conf = props.acerto.conferencia

  return (
    <section className="bloco pilha-curta">
      <h2>Conferência</h2>
      <CampoReais
        rotulo="Dinheiro contado"
        valor={contado}
        desabilitado={props.leitura}
        placeholder={paraCampo(props.acerto.devolver)}
        onChange={(t) => {
          digitando.current = true
          setContado(t)
          const v = lerOpcional(t)
          if (v !== undefined) props.atualizar(registrarContado(props.noite, v))
        }}
        aoSair={() => {
          digitando.current = false
        }}
      />
      {!props.leitura && contado.trim() === '' && (
        <button
          type="button"
          className="secundario"
          onClick={() => {
            setContado(paraCampo(props.acerto.devolver))
            props.atualizar(registrarContado(props.noite, props.acerto.devolver))
          }}
        >
          <Icone nome="check" tamanho={18} />
          Bateu: {formatarReais(props.acerto.devolver)}
        </button>
      )}
      {conf && (
        <div className={`resultado ${conf.situacao}`}>
          {conf.situacao === 'bateu' && <p>Bateu.</p>}
          {conf.situacao === 'falta' && <p>Faltou {formatarReais(conf.falta)}. Sai do que você recebe.</p>}
          {conf.situacao === 'sobra' && (
            <p>Sobrou {formatarReais(conf.sobra)}. Fica retida até descobrir a origem.</p>
          )}
          <p>
            Você recebe <strong>{formatarReais(conf.pagar)}</strong>.
          </p>
          {conf.completa > 0 && (
            <p>
              Complete <strong>{formatarReais(conf.completa)}</strong> do bolso.
            </p>
          )}
        </div>
      )}
      {conf && (
        <dl className="liquidacao">
          <div>
            <dt>Do seu caixa</dt>
            <dd>{formatarReais(conf.doCaixaDele)}</dd>
          </div>
          <div>
            <dt>O Luan tira do caixa da empresa</dt>
            <dd>{formatarReais(conf.retiradoCaixaEmpresa)}</dd>
          </div>
          <div>
            <dt>Vai para a empresa</dt>
            <dd>{formatarReais(conf.vaiParaEmpresa)}</dd>
          </div>
        </dl>
      )}
    </section>
  )
}

const TIPOS: { id: TipoDiferenca; rotulo: string }[] = [
  { id: 'bateu', rotulo: 'Bateu' },
  { id: 'falta', rotulo: 'Faltou' },
  { id: 'sobra', rotulo: 'Sobrou' },
]

function ComparacaoLuan(props: { noite: Noite; acerto: Acerto; leitura: boolean; atualizar: Atualizar }) {
  const n = props.noite
  const [f, setF] = useState(() => ({
    pagou: campo(n.luanPagou),
    tipo: tipoDiferenca(n.luanDiferenca),
    valor: n.luanDiferenca ? paraCampo(Math.abs(n.luanDiferenca)) : '',
    minutos: n.minutosAcerto === null ? '' : String(n.minutosAcerto),
    obs: n.obs,
  }))

  function mudar(parcial: Partial<typeof f>) {
    const novo = { ...f, ...parcial }
    setF(novo)
    const pagou = lerOpcional(novo.pagou)
    const valor = lerOpcional(novo.valor)
    const minutos = novo.minutos.trim() === '' ? null : /^\d+$/.test(novo.minutos) ? Number(novo.minutos) : undefined
    if (pagou === undefined || valor === undefined || minutos === undefined) return // ainda digitando
    props.atualizar(
      registrarLuan(n, {
        luanPagou: pagou,
        luanDiferenca: diferencaLuan(novo.tipo, valor),
        minutosAcerto: minutos,
        obs: novo.obs,
      }),
    )
  }

  const comp = compararComLuan(n, props.acerto)

  return (
    <section className="bloco pilha-curta">
      <h2>Acerto com o Luan</h2>
      <CampoReais
        rotulo="Quanto o Luan te pagou"
        valor={f.pagou}
        desabilitado={props.leitura}
        onChange={(t) => mudar({ pagou: t })}
      />
      <span className="campo">
        <span>Falta ou sobra que o Luan achou</span>
      </span>
      <div className="chips chips-3" role="group" aria-label="Falta ou sobra que o Luan achou">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="chip"
            disabled={props.leitura}
            aria-pressed={f.tipo === t.id}
            onClick={() => mudar({ tipo: f.tipo === t.id ? null : t.id })}
          >
            {t.rotulo}
          </button>
        ))}
      </div>
      {(f.tipo === 'falta' || f.tipo === 'sobra') && (
        <CampoReais
          rotulo={f.tipo === 'falta' ? 'Quanto faltou' : 'Quanto sobrou'}
          valor={f.valor}
          desabilitado={props.leitura}
          onChange={(t) => mudar({ valor: t })}
        />
      )}
      <div className="lado-a-lado">
        <label className="campo">
          <span>Tempo do acerto (min)</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            disabled={props.leitura}
            value={f.minutos}
            onChange={(e) => mudar({ minutos: e.target.value.replace(/\D/g, '') })}
          />
        </label>
      </div>
      <label className="campo">
        <span>Observação</span>
        <textarea rows={3} disabled={props.leitura} value={f.obs} onChange={(e) => mudar({ obs: e.target.value })} />
      </label>
      {comp && (
        <div className={`resultado ${comp.bateu ? 'bateu' : 'falta'}`}>
          {comp.bateu ? (
            <p>Bateu com o app.</p>
          ) : (
            <>
              {comp.diferencaPago !== 0 && (
                <p>
                  O Luan pagou {formatarReais(Math.abs(comp.diferencaPago))}{' '}
                  {comp.diferencaPago > 0 ? 'a mais' : 'a menos'} que o app ({formatarReais(comp.esperado)}).
                </p>
              )}
              {comp.diferencaFaltaSobra !== null && comp.diferencaFaltaSobra !== 0 && (
                <p>A falta ou sobra do Luan difere {formatarReais(Math.abs(comp.diferencaFaltaSobra))} da do app.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
