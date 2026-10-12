import { useState } from 'react'
import {
  calcularAcerto,
  compararComLuan,
  detalharAcerto,
  diferencaLuan,
  registrarContado,
  registrarLuan,
  resumoMaquininha,
  tipoDiferenca,
  type Acerto,
  type TipoDiferenca,
} from '../domain/acerto'
import { marcarConferido, type Resultado } from '../domain/comanda'
import { formatarData, formatarHora } from '../domain/datas'
import { formatarReais, lerReais, paraCampo } from '../domain/dinheiro'
import { avisoAoFechar, fecharNoite, reabrirNoite } from '../domain/noite'
import type { Area, Comanda, Noite } from '../domain/tipos'
import { agora } from '../data/id'
import { repo } from '../data/repo'
import { BarraTotais } from '../ui/BarraTotais'
import { BotaoConfirmar } from '../ui/BotaoConfirmar'
import { CampoReais } from '../ui/CampoReais'
import { mensagemDeErro } from '../ui/erro'
import { Icone, type NomeIcone } from '../ui/Icone'
import { ListasComandas } from './ListasComandas'

/** Acerto de uma noite. Fechada = só leitura, com Reabrir. */
export function TelaAcerto(props: {
  noite: Noite | undefined
  noites: Noite[]
  comandas: Comanda[]
  areas: Area[]
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
  voltar?: () => void
}) {
  const { noite, comandas } = props
  const leitura = noite.fechadaEm !== null
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
      <main className="app pilha">
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
              {leitura ? (
                <span className="pilula fechada">
                  <Icone nome="cadeado" tamanho={13} />
                  Fechada às {formatarHora(noite.fechadaEm!)} · só leitura
                </span>
              ) : (
                <span className="pilula aberta">Noite aberta</span>
              )}
            </div>
          </div>
        </div>

        <Conta acerto={acerto} />
        {aviso && <p className="aviso">{aviso}</p>}
        <Maquininha comandas={comandas} leitura={leitura} />
        <Conferencia noite={noite} acerto={acerto} leitura={leitura} atualizar={atualizar} />
        <ComparacaoLuan noite={noite} acerto={acerto} leitura={leitura} atualizar={atualizar} />

        {erro && <p className="erro">{erro}</p>}

        {leitura ? (
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

const ESTILO_LINHA: Record<string, { classe: string; icone: NomeIcone }> = {
  Devolver: { classe: 'devolver', icone: 'dinheiro' },
  Maquininha: { classe: 'maquininha', icone: 'cartao' },
  Receber: { classe: 'receber', icone: 'carteira' },
  'Pix antecipado': { classe: 'antecipado', icone: 'check' },
}

function Conta({ acerto }: { acerto: Acerto }) {
  return (
    <section className="bloco">
      <h2 className="titulo-conta">Conta</h2>
      {detalharAcerto(acerto).map((l) => {
        const estilo = ESTILO_LINHA[l.rotulo] ?? ESTILO_LINHA['Pix antecipado']
        return (
          <div key={l.rotulo} className="linha-conta">
            <span className={`marcador ${estilo.classe}`}>
              <Icone nome={estilo.icone} tamanho={20} />
            </span>
            <div>
              <div className="linha-conta-topo">
                <span>{l.rotulo}</span>
                <strong>{formatarReais(l.valor)}</strong>
              </div>
              <p className="discreto pequeno">{l.origem}</p>
            </div>
          </div>
        )
      })}
    </section>
  )
}

/** O que o relatório da maquininha deve mostrar; tocar numa linha marca o comprovante como conferido. */
function Maquininha({ comandas, leitura }: { comandas: Comanda[]; leitura: boolean }) {
  const { grupos, faltamConferir } = resumoMaquininha(comandas)
  const [erro, setErro] = useState<string | null>(null)

  async function alternar(comandaId: string, indice: number, conferido: boolean) {
    const c = comandas.find((x) => x.id === comandaId)
    if (!c) return
    try {
      await repo.salvarComanda(marcarConferido(c, indice, !conferido, agora()))
      setErro(null)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <section className="bloco pilha-curta">
      <h2>A maquininha deve mostrar</h2>
      {grupos.length === 0 ? (
        <p className="discreto">Nada na maquininha.</p>
      ) : (
        <>
          {!leitura && <p className="discreto pequeno">Toque na linha quando achar o comprovante.</p>}
          {grupos.map((g) => (
            <div key={g.forma} className="grupo-maquininha">
              <div className="linha-conta-topo">
                <strong>{g.nome}</strong>
                <span>
                  <span className="discreto pequeno">
                    {g.conferidos} de {g.itens.length} ·{' '}
                  </span>
                  <strong>{formatarReais(g.total)}</strong>
                </span>
              </div>
              {g.itens.map((i) => (
                <button
                  key={`${i.comandaId}-${i.indice}`}
                  type="button"
                  className="item-maquininha"
                  aria-pressed={i.conferido}
                  disabled={leitura}
                  onClick={() => alternar(i.comandaId, i.indice, i.conferido)}
                >
                  <span className="marca" aria-hidden>
                    {i.conferido && <Icone nome="check" tamanho={16} />}
                  </span>
                  <span className="hora">{i.hora ? formatarHora(i.hora) : 'em rota'}</span>
                  <span className="codigo">{i.codigo}</span>
                  <span className="nowrap direita">{formatarReais(i.valor)}</span>
                </button>
              ))}
            </div>
          ))}
          <p className={faltamConferir === 0 ? 'sucesso' : 'discreto'}>
            {faltamConferir === 0
              ? 'Todos os comprovantes conferidos.'
              : `Falta conferir ${faltamConferir} ${faltamConferir === 1 ? 'comprovante' : 'comprovantes'}.`}
          </p>
        </>
      )}
      {erro && <p className="erro">{erro}</p>}
    </section>
  )
}

type Atualizar = (r: Resultado<Partial<Noite>>) => void

function Conferencia(props: { noite: Noite; acerto: Acerto; leitura: boolean; atualizar: Atualizar }) {
  const [contado, setContado] = useState(campo(props.noite.dinheiroContado))
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
          setContado(t)
          const v = lerOpcional(t)
          if (v !== undefined) props.atualizar(registrarContado(props.noite, v))
        }}
      />
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
