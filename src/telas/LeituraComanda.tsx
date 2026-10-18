// Leitura da comanda por foto (docs/SPEC-leitura.md, Front): botão Foto, "Lendo…" e a tela de
// confirmação. A conta e o estado vêm de conferirLeitura; aqui só se mostra e se corrige.
import { useState } from 'react'
import { comandaRepetida, FORMAS, NOMES_FORMA } from '../domain/comanda'
import { formatarReais, lerReais, paraCampo } from '../domain/dinheiro'
import {
  comandaDaLeitura,
  conferirLeitura,
  houveCorrecao,
  registroLeitura,
  type CampoProblema,
  type Correcoes,
  type RegistroLeitura,
  type RespostaLeitura,
  type ResultadoLeitura,
} from '../domain/leitura'
import type { Area, Comanda, Forma, Noite } from '../domain/tipos'
import { agora, segundosDesde } from '../data/id'
import { BotaoConfirmar } from '../ui/BotaoConfirmar'
import { CampoReais } from '../ui/CampoReais'
import { ChipsArea } from '../ui/ChipsArea'
import { EditorPagamento } from '../ui/EditorPagamento'
import { Icone } from '../ui/Icone'
import { estadoDe, lerPagamento, pagamentoVazio, type EstadoPagamento } from '../ui/pagamento'

/** Foto pronta para ler: o id já é o da comanda que ela vai virar. */
export interface FotoDaComanda {
  id: string
  blob: Blob
  base64: string
  url: string
  /** Para medir o tempo da foto ao lançamento. */
  inicio: number
}

export function BotaoFoto({ onFoto }: { onFoto: (arquivo: File) => void }) {
  return (
    <label className="botao botao-foto">
      <Icone nome="camera" tamanho={24} />
      Foto da comanda
      <input
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          e.target.value = '' // a mesma foto de novo também dispara
          if (arquivo) onFoto(arquivo)
        }}
      />
    </label>
  )
}

/** Foto no topo; um toque amplia (e outro fecha). */
function FotoComanda({ url }: { url: string }) {
  const [cheia, setCheia] = useState(false)
  return (
    <button
      type="button"
      className={cheia ? 'foto-cheia' : 'foto-leitura'}
      aria-label={cheia ? 'Fechar foto' : 'Ampliar foto'}
      onClick={() => setCheia(!cheia)}
    >
      <img src={url} alt="Foto da comanda" />
    </button>
  )
}

export function LendoComanda(props: {
  foto: FotoDaComanda
  tremida: boolean
  onDigitar: () => void
  onTirarDeNovo: (arquivo: File) => void
}) {
  return (
    <section className="pilha form-lancar" aria-label="Lendo a comanda">
      <div className="titulo-form">
        <h2>{props.tremida ? 'Foto tremida' : 'Lendo…'}</h2>
        <button type="button" className="link" onClick={props.onDigitar}>
          Digitar
        </button>
      </div>
      <FotoComanda url={props.foto.url} />
      {props.tremida ? (
        <>
          <p className="erro">Foto tremida, tire de novo.</p>
          <BotaoFoto onFoto={props.onTirarDeNovo} />
        </>
      ) : (
        <p className="discreto" role="status">
          Lendo a comanda. Se demorar, toque em Digitar.
        </p>
      )}
    </section>
  )
}

const TITULO = { verde: 'Confere', amarelo: 'Confira', vermelho: 'Não confere' }
const CLASSE = { verde: 'bateu', amarelo: 'sobra', vermelho: 'falta' }
const ORIGEM = { escrito: 'escrito na comanda', valor: 'pelo valor', padrao: 'padrão' }

/** O total com os dígitos que se confundem (3/8, 1/7, 5/6, 0/6) sublinhados. */
function TotalLido({ texto, confusos }: { texto: string; confusos: number[] }) {
  return (
    <span className="num">
      {[...texto].map((ch, i) =>
        confusos.includes(i) ? (
          <u key={i} className="digito-confuso">
            {ch}
          </u>
        ) : (
          ch
        ),
      )}
    </span>
  )
}

const campo = (r: ResultadoLeitura, c: CampoProblema) => (r.problemas.includes(c) ? 'campo-problema' : undefined)

export function ConfirmarLeitura(props: {
  foto: FotoDaComanda
  resposta: RespostaLeitura
  correcoesIniciais: Correcoes
  noite: Noite
  areas: Area[]
  comandas: Comanda[]
  onDigitar: (codigo: string, total: string) => void
  onLancar: (comanda: Comanda, registro: RegistroLeitura, correcoes: Correcoes) => void
  onPromocao: (centavos: number) => void
}) {
  const { resposta, noite } = props
  const [cor, setCor] = useState<Correcoes>(props.correcoesIniciais)
  const [troco, setTroco] = useState('')
  const [editarPagamento, setEditarPagamento] = useState<EstadoPagamento | null>(null)
  /** O editor de pagamento aberto com algo que ainda não fecha: não lança até corrigir. */
  const [pagamentoInvalido, setPagamentoInvalido] = useState<string | null>(null)
  const [repetidaOk, setRepetidaOk] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const entrada = {
    leitura: resposta.leitura,
    conferencia: resposta.conferencia,
    areas: props.areas,
    promoDesconto: noite.promoDesconto ?? null,
    comandasDaNoite: props.comandas,
  }
  const r = conferirLeitura({ ...entrada, correcoes: cor })
  const repetida = r.codigo !== null && comandaRepetida(r.codigo, props.comandas) !== undefined

  function corrigir(parcial: Correcoes) {
    setCor((atual) => ({ ...atual, ...parcial }))
    setErro(null)
    setRepetidaOk(false)
  }

  function lancar(final: Correcoes, forcado: boolean) {
    if (pagamentoInvalido) return setErro(pagamentoInvalido)
    const rf = conferirLeitura({ ...entrada, correcoes: final })
    const valorTroco = troco.trim() === '' ? 0 : lerReais(troco)
    if (valorTroco === null) return setErro('Troco por Pix inválido.')
    const fotoPath = `${noite.id}/${props.foto.id}.jpg`
    const c = comandaDaLeitura(rf, props.areas, valorTroco, {
      id: props.foto.id,
      noiteId: noite.id,
      agora: agora(),
      fotoPath,
    })
    if (!c.ok) return setErro(c.erro)
    const registro = registroLeitura(resposta, conferirLeitura(entrada), {
      id: props.foto.id,
      noiteId: noite.id,
      fotoPath,
      comanda: c.valor,
      estadoFinal: rf.estado,
      segundos: segundosDesde(props.foto.inicio),
      corrigido: houveCorrecao(final, rf),
      forcado,
      posterior: false,
      agora: agora(),
    })
    props.onLancar(c.valor, registro, final)
  }

  /** Verde ou amarelo: o toque na área lança (como o toque na forma no manual). */
  function tocarArea(areaId: string) {
    const final = { ...cor, areaId }
    corrigir({ areaId })
    const rf = conferirLeitura({ ...entrada, correcoes: final })
    if (rf.estado === 'vermelho') return
    if (rf.pagamentos.some((p) => p.pedePix)) return setErro('Escolha o Pix: antecipado ou na máquina.')
    if (repetida && !repetidaOk) return setRepetidaOk(true) // R1: segundo toque
    lancar(final, false)
  }

  /** Uma parte só: tocar a forma. Pix lido pede o toque (R29); outra forma é correção. */
  function tocarForma(forma: Forma) {
    const p = r.pagamentos[0]
    if (p?.pedePix && (forma === 'pix_antecipado' || forma === 'pix_maquina')) return corrigir({ formas: [forma] })
    corrigir({ pagamento: [{ forma, valor: null }], formas: undefined })
  }

  function aplicarPagamento(e: EstadoPagamento) {
    setEditarPagamento(e)
    if (r.total === null) return setPagamentoInvalido('Informe o total.')
    const p = lerPagamento(e, r.total)
    setPagamentoInvalido(p.ok ? null : p.erro)
    if (!p.ok) return
    corrigir({
      pagamento: p.valor.pagamentos.map((x) => ({ forma: x.forma, valor: paraCampo(x.valor) })),
      formas: undefined,
    })
    setTroco(e.troco)
  }

  /** O editor começa com o que foi lido, quando a forma de cada parte já está certa. */
  function abrirEditor() {
    const ps = r.pagamentos
    const formas = ps.flatMap((p) => (p.forma ? [p.forma] : []))
    if (r.total !== null && formas.length === ps.length && ps.length === 1)
      return setEditarPagamento(estadoDe([{ forma: formas[0], valor: r.total }], 0))
    if (formas.length === ps.length && ps.every((p) => p.valor !== null))
      return setEditarPagamento(
        estadoDe(
          ps.map((p, i) => ({ forma: formas[i], valor: p.valor! })),
          0,
        ),
      )
    setEditarPagamento(pagamentoVazio())
  }

  const codigoTexto = cor.codigo ?? r.codigo ?? ''
  const totalTexto = cor.total ?? r.totalTexto ?? ''
  const umaParte = r.pagamentos.length === 1 && !editarPagamento
  const divergenciaPagamento = r.divergencias.find((d) => d.campo === 'pagamento')

  return (
    <section className="pilha form-lancar" aria-label="Confirmar leitura">
      <div className="titulo-form">
        <h2>Comanda lida</h2>
        <button type="button" className="link" onClick={() => props.onDigitar(codigoTexto, totalTexto)}>
          Digitar
        </button>
      </div>
      <FotoComanda url={props.foto.url} />

      <div className={`resultado ${CLASSE[r.estado]}`} role="status">
        <strong>{TITULO[r.estado]}</strong>
        {r.motivos.map((m) => (
          <span key={m}>{m}</span>
        ))}
        {r.promocaoSugerida !== null && (
          <button
            type="button"
            className="secundario alinha-inicio"
            onClick={() => props.onPromocao(r.promocaoSugerida!)}
          >
            Sim, promoção de {formatarReais(r.promocaoSugerida)} hoje
          </button>
        )}
      </div>

      {r.divergencias
        .filter((d) => d.campo !== 'local' && d.campo !== 'pagamento')
        .map((d) => (
          <div key={d.campo} className="pilha-curta">
            <span className="rotulo-grupo">
              {d.campo === 'telefone' ? 'Código' : d.campo === 'total' ? 'Total' : 'Asterisco'}: qual está certo?
            </span>
            <div className="chips">
              {[d.completa, d.conferencia].map((v, i) => (
                <button
                  key={i}
                  type="button"
                  className="chip"
                  onClick={() =>
                    corrigir(
                      d.campo === 'telefone'
                        ? { codigo: v }
                        : d.campo === 'total'
                          ? { total: v }
                          : { promocao: v === 'com asterisco' },
                    )
                  }
                >
                  {v || '(vazio)'}
                </button>
              ))}
            </div>
          </div>
        ))}

      <div className="lado-a-lado">
        <label className={`campo ${campo(r, 'codigo') ?? ''}`}>
          <span>Código</span>
          <input
            className="codigo-campo"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={codigoTexto}
            onChange={(e) => corrigir({ codigo: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          />
        </label>
        <div className={campo(r, 'total')}>
          <CampoReais rotulo="Total" valor={totalTexto} onChange={(t) => corrigir({ total: t })} />
        </div>
      </div>
      {r.digitosConfusos.length > 0 && r.totalTexto && (
        <p className="discreto pequeno">
          Lido <TotalLido texto={r.totalTexto} confusos={r.digitosConfusos} />: confira os dígitos sublinhados (3/8,
          1/7, 5/6, 0/6).
        </p>
      )}

      <ul className={`itens-leitura ${campo(r, 'itens') ?? ''}`} aria-label="Itens">
        {r.itens.map((it, i) => (
          <li key={i}>
            <div className="linha-item">
              <span>
                {it.item.quantidade > 1 && `${it.item.quantidade}× `}
                {it.item.tamanho && `${it.item.tamanho} `}
                {it.item.sabores.length ? it.item.sabores.join(' / ') : (it.item.item ?? it.item.lido)}
              </span>
              <span className="valor">{it.preco === null ? '—' : formatarReais(it.preco)}</span>
            </div>
            {it.problema && <p className="erro pequeno">{it.problema}</p>}
            {it.opcoes.length > 0 && (
              <div className="chips">
                {it.opcoes.map((o) => (
                  <button
                    key={o.sabor}
                    type="button"
                    className="chip chip-area"
                    onClick={() => corrigir({ escolhas: { ...cor.escolhas, [i]: o.sabor } })}
                  >
                    <span>{o.sabor}</span>
                    {o.preco !== null && <small className="num">{formatarReais(o.preco)}</small>}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <dl className={`liquidacao ${campo(r, 'conta') ?? ''}`}>
        <div>
          <dt>Itens</dt>
          <dd>{r.somaItens === null ? '—' : formatarReais(r.somaItens)}</dd>
        </div>
        {r.desconto > 0 && (
          <div>
            <dt>Promoção</dt>
            <dd>− {formatarReais(r.desconto)}</dd>
          </div>
        )}
        <div>
          <dt>Taxa</dt>
          <dd>{r.taxa === null ? '—' : formatarReais(r.taxa)}</dd>
        </div>
        <div>
          <dt>Esperado</dt>
          <dd>{r.esperado === null ? '—' : formatarReais(r.esperado)}</dd>
        </div>
        <div>
          <dt>Lido</dt>
          <dd>{r.total === null ? '—' : formatarReais(r.total)}</dd>
        </div>
      </dl>

      <div className={`pilha-curta ${campo(r, 'pagamento') ?? ''}`}>
        {divergenciaPagamento && (
          <p className="aviso">
            Pagamento: {divergenciaPagamento.completa} × {divergenciaPagamento.conferencia}. Toque na forma certa.
          </p>
        )}
        {umaParte ? (
          <>
            <span className="rotulo-grupo">Forma de pagamento · escrito "{r.pagamentos[0].escrita}"</span>
            <div className="chips" role="group" aria-label="Forma de pagamento">
              {FORMAS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className="chip"
                  aria-pressed={r.pagamentos[0].forma === f}
                  onClick={() => tocarForma(f)}
                >
                  {NOMES_FORMA[f]}
                </button>
              ))}
            </div>
          </>
        ) : editarPagamento ? (
          <EditorPagamento estado={editarPagamento} onChange={aplicarPagamento} total={r.total} />
        ) : (
          <>
            <span className="rotulo-grupo">Pagamento</span>
            {r.pagamentos.map((p, i) => (
              <div key={i} className="pilha-curta">
                <span>
                  {p.escrita}
                  {p.valor !== null && ` · ${formatarReais(p.valor)}`}
                  {p.forma && ` → ${NOMES_FORMA[p.forma]}`}
                </span>
                {p.pedePix && (
                  <div className="chips">
                    {(['pix_antecipado', 'pix_maquina'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className="chip"
                        aria-pressed={cor.formas?.[i] === f}
                        onClick={() => {
                          const formas = r.pagamentos.map((_, j) => cor.formas?.[j] ?? null)
                          formas[i] = f
                          corrigir({ formas })
                        }}
                      >
                        {NOMES_FORMA[f]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
        {!editarPagamento && (
          <button type="button" className="link alinha-inicio" onClick={abrirEditor}>
            Corrigir o pagamento ou o troco
          </button>
        )}
        {pagamentoInvalido && <p className="erro pequeno">{pagamentoInvalido}</p>}
      </div>

      <div className={campo(r, 'area')}>
        <ChipsArea
          areas={props.areas.filter((a) => a.ativa)}
          selecionada={cor.areaId ?? null}
          sugerida={r.sugestao && { id: r.sugestao.areaId, origem: ORIGEM[r.sugestao.origem] }}
          dica={r.estado === 'vermelho' ? 'corrija acima' : 'tocar já lança'}
          onChange={tocarArea}
        />
      </div>
      {repetida && repetidaOk && (
        <p className="aviso">Já tem essa comanda na noite. Toque de novo na área para lançar.</p>
      )}
      {r.estado === 'vermelho' && (
        <BotaoConfirmar
          className="perigo"
          confirmacao="Toque de novo para lançar assim"
          onConfirmar={() => lancar({ ...cor, areaId: cor.areaId ?? r.areaId ?? undefined }, true)}
        >
          Lançar assim
        </BotaoConfirmar>
      )}
      {erro && <p className="erro">{erro}</p>}
    </section>
  )
}
