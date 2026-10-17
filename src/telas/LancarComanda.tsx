import { useEffect, useRef, useState } from 'react'
import { comandaRepetida, criarComanda } from '../domain/comanda'
import { lerReais } from '../domain/dinheiro'
import { NITIDEZ_MINIMA } from '../domain/foto'
import {
  conferirLeitura,
  registroLeitura,
  type Correcoes,
  type RegistroLeitura,
  type RespostaLeitura,
} from '../domain/leitura'
import type { Area, Comanda, Noite } from '../domain/tipos'
import { agora, novoId, segundosDesde } from '../data/id'
import { ErroRemoto } from '../data/nuvem/remoto'
import { repo } from '../data/repo'
import { CampoReais } from '../ui/CampoReais'
import { ChipsArea } from '../ui/ChipsArea'
import { useAviso } from '../ui/desfazer'
import { EditorPagamento } from '../ui/EditorPagamento'
import { mensagemDeErro, textoDoErro } from '../ui/erro'
import { Icone } from '../ui/Icone'
import { prepararFoto } from '../ui/foto'
import { lerPagamento, pagamentoVazio, type EstadoPagamento } from '../ui/pagamento'
import { BotaoFoto, ConfirmarLeitura, LendoComanda, type FotoDaComanda } from './LeituraComanda'

const STATUS: Record<Comanda['status'], string> = {
  em_rota: 'em rota',
  entregue: 'entregue',
  voltou: 'voltou',
}

interface Formulario {
  codigo: string
  total: string
  areaId: string | null
  pagamento: EstadoPagamento
}

const vazio = (): Formulario => ({ codigo: '', total: '', areaId: null, pagamento: pagamentoVazio() })

/** A foto em leitura ou em confirmação. */
type Leitura =
  | { fase: 'lendo' | 'tremida'; foto: FotoDaComanda }
  | { fase: 'confirmar'; foto: FotoDaComanda; resposta: RespostaLeitura; correcoes: Correcoes }

/** Foto que segue com o lançamento à mão: lida depois (R28), ou já lida e recusada pelo motoboy. */
interface FotoNoManual {
  foto: FotoDaComanda
  pendente: boolean
  resposta?: RespostaLeitura
}

const SEM_INTERNET = 'Sem internet: lance à mão. A foto fica guardada e é lida quando a internet voltar.'

/** Lançar comanda: tocar na forma de pagamento já lança; "Lançar" só no pagamento dividido. */
export function LancarComanda(props: { noite: Noite; areas: Area[]; comandas: Comanda[] }) {
  const [f, setF] = useState(vazio)
  const [sugerida, setSugerida] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [repetidaOk, setRepetidaOk] = useState(false)
  // Com comanda em rota, abre recolhido: na porta do cliente a lista "Em rota" fica à mão.
  const [aberto, setAberto] = useState(() => !props.comandas.some((c) => c.status === 'em_rota'))
  const refCodigo = useRef<HTMLInputElement>(null)
  const refTotal = useRef<HTMLInputElement>(null)
  const aviso = useAviso()
  const fotos = repo.fotos
  const [leitura, setLeitura] = useState<Leitura | null>(null)
  const [fotoManual, setFotoManual] = useState<FotoNoManual | null>(null)
  const [avisoFoto, setAvisoFoto] = useState<string | null>(null)
  const pedido = useRef<AbortController | null>(null)
  // Endereços blob: das fotos desta tela, revogados ao sair.
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  async function tirarFoto(arquivo: File) {
    if (!fotos) return
    setErro(null)
    setAvisoFoto(null)
    pedido.current?.abort()
    let pronta
    try {
      pronta = await prepararFoto(arquivo)
    } catch (e) {
      return setErro(textoDoErro(e))
    }
    const url = URL.createObjectURL(pronta.blob)
    urls.current.push(url)
    const foto: FotoDaComanda = { id: novoId(), blob: pronta.blob, base64: pronta.base64, url, inicio: Date.now() }
    if (pronta.nitidez < NITIDEZ_MINIMA) return setLeitura({ fase: 'tremida', foto })
    if (!navigator.onLine) return paraManual({ foto, pendente: true }, SEM_INTERNET)
    setLeitura({ fase: 'lendo', foto })
    const ctrl = new AbortController()
    pedido.current = ctrl
    try {
      const resposta = await fotos.ler(foto.base64, ctrl.signal)
      if (!ctrl.signal.aborted) setLeitura({ fase: 'confirmar', foto, resposta, correcoes: {} })
    } catch (e) {
      if (ctrl.signal.aborted) return
      const naIA = e instanceof ErroRemoto && e.permanente
      paraManual({ foto, pendente: !naIA }, naIA ? textoDoErro(e) : SEM_INTERNET)
    }
  }

  /** Volta ao lançamento à mão; a foto segue junto e é lançada com a comanda. */
  function paraManual(fm: FotoNoManual, msg: string | null, preencher?: { codigo: string; total: string }) {
    pedido.current?.abort()
    setLeitura(null)
    setFotoManual(fm)
    setAvisoFoto(msg)
    setAberto(true)
    if (preencher) mudar(preencher)
    setTimeout(() => refCodigo.current?.focus())
  }

  async function lancarLida(
    foto: FotoDaComanda,
    resposta: RespostaLeitura,
    comanda: Comanda,
    registro: RegistroLeitura,
    correcoes: Correcoes,
  ) {
    if (!fotos) return
    setLeitura(null)
    try {
      await fotos.lancar(comanda, foto.blob, { registro })
      aviso(`${comanda.codigo} lançada`, async () => {
        await repo.excluirComanda(comanda.id)
        setLeitura({ fase: 'confirmar', foto, resposta, correcoes })
      })
    } catch (e) {
      setLeitura({ fase: 'confirmar', foto, resposta, correcoes })
      setErro(mensagemDeErro(e))
    }
  }

  const repetida = f.codigo.length === 4 ? comandaRepetida(f.codigo, props.comandas) : undefined
  const ativas = props.areas.filter((a) => a.ativa)

  function mudar(parcial: Partial<Formulario>) {
    setF((atual) => ({ ...atual, ...parcial }))
    setErro(null)
  }

  async function sugerirArea(codigo: string) {
    try {
      const id = await repo.sugerirArea(codigo)
      if (!id || !ativas.some((a) => a.id === id)) return
      // Só marca se o código não mudou e ninguém escolheu a área enquanto isso.
      setF((atual) => (atual.codigo === codigo && atual.areaId === null ? { ...atual, areaId: id } : atual))
      setSugerida(id)
    } catch {
      // sem sugestão
    }
  }

  async function lancar(pagamento: EstadoPagamento) {
    const total = lerReais(f.total)
    if (total === null || total === 0) return setErro('Informe o total.')
    const area = ativas.find((a) => a.id === f.areaId)
    if (!area) return setErro('Escolha a área.')
    const p = lerPagamento(pagamento, total)
    if (!p.ok) return setErro(p.erro)
    const fm = fotoManual
    const r = criarComanda({ codigo: f.codigo, total, ...p.valor }, area, {
      id: fm?.foto.id ?? novoId(),
      noiteId: props.noite.id,
      agora: agora(),
    })
    if (!r.ok) return setErro(r.erro)
    if (repetida && !repetidaOk) return setRepetidaOk(true) // R1: segundo toque
    // Limpa antes de salvar, para não apagar o que for digitado enquanto grava.
    const anterior = { ...f, pagamento }
    setF(vazio())
    setSugerida(null)
    setRepetidaOk(false)
    setFotoManual(null)
    setAvisoFoto(null)
    refCodigo.current?.focus()
    try {
      if (fm && fotos) {
        const fotoPath = `${props.noite.id}/${fm.foto.id}.jpg`
        const comanda: Comanda = { ...r.valor, fotoPath, areaOrigem: 'manual' }
        // Lida e trocada pelo manual: a leitura entra na medição como corrigida.
        const registro = fm.resposta && {
          registro: registroLeitura(
            fm.resposta,
            conferirLeitura({ ...fm.resposta, areas: props.areas, promoDesconto: props.noite.promoDesconto ?? null }),
            {
              id: fm.foto.id,
              noiteId: props.noite.id,
              fotoPath,
              comanda,
              estadoFinal: null,
              segundos: segundosDesde(fm.foto.inicio),
              corrigido: true,
              forcado: false,
              posterior: false,
              agora: agora(),
            },
          ),
        }
        await fotos.lancar(comanda, fm.foto.blob, registro ?? { pendente: fm.pendente })
      } else await repo.salvarComanda(r.valor)
      aviso(`${r.valor.codigo} lançada`, async () => {
        await repo.excluirComanda(r.valor.id)
        setF(anterior)
        setFotoManual(fm)
        setAberto(true)
      })
    } catch (e) {
      setF(anterior)
      setFotoManual(fm)
      setErro(mensagemDeErro(e))
    }
  }

  const botaoFoto = fotos && <BotaoFoto onFoto={tirarFoto} />

  if (leitura?.fase === 'confirmar')
    return (
      <ConfirmarLeitura
        key={leitura.foto.id}
        foto={leitura.foto}
        resposta={leitura.resposta}
        correcoesIniciais={leitura.correcoes}
        noite={props.noite}
        areas={props.areas}
        comandas={props.comandas}
        onDigitar={(codigo, total) =>
          paraManual({ foto: leitura.foto, pendente: false, resposta: leitura.resposta }, null, { codigo, total })
        }
        onLancar={(comanda, registro, correcoes) =>
          lancarLida(leitura.foto, leitura.resposta, comanda, registro, correcoes)
        }
        onPromocao={(centavos) =>
          repo.atualizarNoite(props.noite.id, { promoDesconto: centavos }).catch((e) => setErro(mensagemDeErro(e)))
        }
      />
    )
  if (leitura)
    return (
      <LendoComanda
        foto={leitura.foto}
        tremida={leitura.fase === 'tremida'}
        onDigitar={() => paraManual({ foto: leitura.foto, pendente: leitura.fase === 'lendo' }, null)}
        onTirarDeNovo={tirarFoto}
      />
    )

  if (!aberto)
    return (
      <div className="pilha-curta">
        {botaoFoto}
        <button type="button" className="primario" onClick={() => setAberto(true)}>
          <Icone nome="mais" tamanho={22} />
          Lançar comanda
        </button>
      </div>
    )

  return (
    <section className="pilha form-lancar" aria-label="Lançar comanda">
      {!fotoManual && botaoFoto}
      <div className="titulo-form">
        <h2>Lançar comanda</h2>
        <button type="button" className="link" onClick={() => setAberto(false)}>
          Recolher
        </button>
      </div>
      {fotoManual && (
        <div className="foto-no-manual">
          <img src={fotoManual.foto.url} alt="Foto da comanda" />
          <span className="pequeno">{avisoFoto ?? 'A foto vai junto com a comanda.'}</span>
          <button
            type="button"
            className="link"
            onClick={() => {
              setFotoManual(null)
              setAvisoFoto(null)
            }}
          >
            Sem foto
          </button>
        </div>
      )}
      <div className="lado-a-lado">
        <label className="campo">
          <span>Código</span>
          <input
            ref={refCodigo}
            className="codigo-campo"
            inputMode="numeric"
            enterKeyHint="next"
            autoComplete="off"
            maxLength={4}
            placeholder="0000"
            value={f.codigo}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4)
              mudar({ codigo: v, ...(sugerida && f.areaId === sugerida ? { areaId: null } : {}) })
              setSugerida(null)
              setRepetidaOk(false)
              if (v.length === 4) {
                refTotal.current?.focus()
                sugerirArea(v)
              }
            }}
          />
        </label>
        <CampoReais rotulo="Total" valor={f.total} onChange={(t) => mudar({ total: t })} ref={refTotal} />
      </div>
      {repetida && (
        <p className="aviso">
          Já tem a {repetida.codigo} nesta noite ({STATUS[repetida.status]}).
          {repetidaOk ? ' Toque de novo para lançar mesmo assim.' : ''}
        </p>
      )}
      <ChipsArea
        areas={ativas}
        selecionada={f.areaId}
        onChange={(id) => mudar({ areaId: id })}
        dica={sugerida !== null && f.areaId === sugerida ? 'a do último pedido' : undefined}
      />
      <EditorPagamento
        estado={f.pagamento}
        onChange={(p) => mudar({ pagamento: p })}
        total={lerReais(f.total)}
        aoTocarForma={lancar}
      />
      {f.pagamento.dividido && (
        <button type="button" className={`primario ${repetidaOk ? 'armado' : ''}`} onClick={() => lancar(f.pagamento)}>
          {repetidaOk ? 'Lançar mesmo assim' : 'Lançar'}
        </button>
      )}
      {erro && <p className="erro">{erro}</p>}
    </section>
  )
}
