import { useCallback, useState, type ReactNode } from 'react'
import {
  comandaRepetida,
  filtrarPorCodigo,
  marcarEntregue,
  marcarVoltou,
  NOMES_STATUS,
  nomesFormas,
  saiuDeNovo,
  separarPorStatus,
} from '../domain/comanda'
import { formatarHora } from '../domain/datas'
import { formatarReais } from '../domain/dinheiro'
import { avisoLeitura } from '../domain/leitura'
import type { Area, Comanda } from '../domain/tipos'
import { agora, novoId } from '../data/id'
import { repo } from '../data/repo'
import { useConsulta } from '../data/useConsulta'
import { BotaoConfirmar } from '../ui/BotaoConfirmar'
import { useAviso } from '../ui/desfazer'
import { mensagemDeErro } from '../ui/erro'
import { Icone, type NomeIcone } from '../ui/Icone'
import { VerFoto } from '../ui/VerFoto'
import { EditarComanda, TrocarForma } from './EditarComanda'

type Aberta = { id: string; modo: 'menu' | 'editar' | 'trocar' } | null

const ICONE_STATUS: Record<Comanda['status'], NomeIcone> = {
  em_rota: 'moto',
  entregue: 'check',
  voltou: 'voltou',
}

/** R1 no "Saiu de novo": já tendo outra com o mesmo código fora de "voltou", pede o segundo toque. */
function SaiuDeNovo(props: { repetida: Comanda | undefined; onSair: () => void }) {
  const rotulo = (
    <>
      <Icone nome="denovo" tamanho={18} />
      Saiu de novo
    </>
  )
  if (!props.repetida)
    return (
      <button type="button" onClick={props.onSair}>
        {rotulo}
      </button>
    )
  const status = NOMES_STATUS[props.repetida.status].toLowerCase()
  return (
    <BotaoConfirmar confirmacao={`${props.repetida.codigo} já ${status}: toque de novo`} onConfirmar={props.onSair}>
      {rotulo}
    </BotaoConfirmar>
  )
}

/** Listas da noite. Sem `somenteLeitura`, com as ações (desfazer no lugar de confirmar) e a edição. */
export function ListasComandas(props: {
  comandas: Comanda[]
  areas: Area[]
  somenteLeitura?: boolean
  /** Promoção da noite, para conferir as leituras que chegaram depois (R28). */
  promoDesconto?: number | null
}) {
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState<Aberta>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [foto, setFoto] = useState<Comanda | null>(null)
  const aviso = useAviso()
  const noiteId = props.comandas[0]?.noiteId
  const leituras = useConsulta(async () => (noiteId && repo.fotos ? repo.fotos.leituras(noiteId) : []), [noiteId])
  /** R28: o que a leitura feita depois diz que não confere com o lançado. */
  const avisos = (c: Comanda) => {
    const reg = leituras?.find((l) => l.comandaId === c.id && l.resultado.posterior)
    return reg ? avisoLeitura(reg, c, props.areas, props.promoDesconto ?? null) : []
  }
  const carregarFoto = useCallback(() => repo.fotos!.url(foto!), [foto])
  const { emRota, entregues, voltaram } = separarPorStatus(filtrarPorCodigo(props.comandas, busca))

  /** Grava e oferece desfazer (volta a comanda como estava, ou apaga a nova). */
  async function gravar(nova: Comanda, texto: string, anterior: Comanda | null) {
    setErro(null)
    setAberta(null)
    try {
      await repo.salvarComanda(nova)
      aviso(texto, () => (anterior ? repo.salvarComanda(anterior) : repo.excluirComanda(nova.id)))
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const linha = (c: Comanda) => {
    const area = props.areas.find((a) => a.id === c.areaId)
    const modo = aberta?.id === c.id ? aberta.modo : null
    const abrir = (m: 'menu' | 'editar' | 'trocar') => setAberta({ id: c.id, modo: m })
    const naoConfere = avisos(c)
    const resumo = <ResumoComanda comanda={c} area={area?.nome ?? '—'} naoConfere={naoConfere.length > 0} />

    return (
      <li key={c.id} className={`linha-comanda status-${c.status} ${modo ? 'aberta' : ''}`}>
        <div className="linha-topo">
          {props.somenteLeitura ? (
            <div className="resumo-botao">{resumo}</div>
          ) : (
            <button
              type="button"
              className="resumo-botao"
              aria-expanded={modo !== null}
              onClick={() => (modo ? setAberta(null) : abrir('menu'))}
            >
              {resumo}
            </button>
          )}
          {!props.somenteLeitura && c.status === 'em_rota' && modo === null && (
            <button
              type="button"
              className="entregue-rapido"
              onClick={() => gravar(marcarEntregue(c, agora()), `${c.codigo} entregue`, c)}
            >
              <Icone nome="check" tamanho={18} />
              Entregue
            </button>
          )}
        </div>
        {modo === 'menu' && (
          <div className="menu-comanda">
            {naoConfere.length > 0 && (
              <p className="aviso">
                A leitura da foto não confere: {naoConfere.join(' ')} Confira e, se for o caso, edite.
              </p>
            )}
            {c.fotoPath && repo.fotos && (
              <button type="button" onClick={() => setFoto(c)}>
                <Icone nome="camera" tamanho={18} />
                Ver foto
              </button>
            )}
            {c.status === 'em_rota' && (
              <>
                <button type="button" onClick={() => abrir('trocar')}>
                  <Icone nome="trocar" tamanho={18} />
                  Trocou a forma
                </button>
                <button type="button" onClick={() => gravar(marcarVoltou(c, agora()), `${c.codigo} voltou`, c)}>
                  <Icone nome="voltou" tamanho={18} />
                  Voltou
                </button>
              </>
            )}
            {c.status === 'voltou' && (
              <SaiuDeNovo
                repetida={comandaRepetida(c.codigo, props.comandas)}
                onSair={() => {
                  const r = saiuDeNovo(c, area, { id: novoId(), agora: agora() })
                  if (!r.ok) return setErro(r.erro)
                  gravar(r.valor, `${c.codigo} saiu de novo`, null)
                }}
              />
            )}
            <button type="button" onClick={() => abrir('editar')}>
              <Icone nome="lapis" tamanho={18} />
              Editar ou excluir
            </button>
          </div>
        )}
        {modo === 'trocar' && <TrocarForma comanda={c} onFechar={() => setAberta(null)} />}
        {modo === 'editar' && (
          <EditarComanda comanda={c} areas={props.areas} comandas={props.comandas} onFechar={() => setAberta(null)} />
        )}
      </li>
    )
  }

  return (
    <>
      {foto && <VerFoto titulo={foto.codigo} carregar={carregarFoto} fechar={() => setFoto(null)} />}
      {erro && <p className="erro">{erro}</p>}
      {props.comandas.length >= 4 && (
        <label className="busca">
          <Icone nome="buscar" tamanho={18} />
          <span className="so-leitor">Buscar código</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="Buscar código"
            maxLength={4}
            value={busca}
            onChange={(e) => setBusca(e.target.value.replace(/\D/g, ''))}
          />
          {busca && (
            <button type="button" className="limpar" aria-label="Limpar busca" onClick={() => setBusca('')}>
              ✕
            </button>
          )}
        </label>
      )}
      <Lista titulo="Em rota" comandas={emRota} linha={linha} />
      <Lista titulo="Entregues" comandas={entregues} linha={linha} />
      <Lista titulo="Voltaram" comandas={voltaram} linha={linha} />
      {busca && emRota.length + entregues.length + voltaram.length === 0 && (
        <p className="discreto">Nenhuma comanda com {busca}.</p>
      )}
      {props.comandas.length === 0 && (
        <div className="vazio">
          <Icone nome="moto" tamanho={28} />
          <strong>Nenhuma comanda ainda</strong>
          {!props.somenteLeitura && <span className="pequeno">Lance a comanda quando sair para a entrega.</span>}
        </div>
      )}
    </>
  )
}

function Lista(props: { titulo: string; comandas: Comanda[]; linha: (c: Comanda) => ReactNode }) {
  if (props.comandas.length === 0) return null
  return (
    <section>
      <h2 className="titulo-secao">
        {props.titulo} <span className="contador">{props.comandas.length}</span>
      </h2>
      <ul className="lista-comandas">{props.comandas.map(props.linha)}</ul>
    </section>
  )
}

/** Código grande à esquerda, área e forma em cinza, valor à direita; status por cor e ícone. */
export function ResumoComanda({
  comanda: c,
  area,
  naoConfere,
}: {
  comanda: Comanda
  area: string
  naoConfere?: boolean
}) {
  const temAntecipado = c.pagamentos.some((p) => p.forma === 'pix_antecipado')
  return (
    <span className="resumo-comanda">
      <span className="icone-status" aria-label={c.status === 'em_rota' ? 'Em rota' : c.status === 'entregue' ? 'Entregue' : 'Voltou'}>
        <Icone nome={ICONE_STATUS[c.status]} tamanho={18} />
      </span>
      <strong className="codigo">{c.codigo}</strong>
      <strong className="valor">{formatarReais(c.total)}</strong>
      <span className="detalhe">
        {area} · {nomesFormas(c.pagamentos)}
        {c.troco > 0 && <> · troco Pix <span className="num">{formatarReais(c.troco)}</span></>}
        {c.finalizadaEm && <> · <span className="num">{formatarHora(c.finalizadaEm)}</span></>}
        {temAntecipado && c.pixConfirmado && <span className="selo-pix">Pix confirmado</span>}
        {c.fotoPath && (
          <span className="tem-foto" aria-label="Com foto">
            <Icone nome="camera" tamanho={14} />
          </span>
        )}
        {naoConfere && <span className="selo-pix selo-leitura">Leitura não confere</span>}
      </span>
    </span>
  )
}
