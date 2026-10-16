import { useState } from 'react'
import { detalharAcerto, entregasPorCidade, papeisParaConferir, resumoMaquininha, type Acerto } from '../domain/acerto'
import { nomesFormas } from '../domain/comanda'
import { formatarData, formatarHora } from '../domain/datas'
import { formatarReais } from '../domain/dinheiro'
import type { AcertoConfirmado, Area, Comanda } from '../domain/tipos'
import { mensagemDeErro } from './erro'
import { Icone } from './Icone'

// Blocos da conta do acerto, usados na tela de Acerto do motoboy e no painel do Luan.

/** O que o Luan gravou ao confirmar (vale mesmo se a conta mudar depois). */
export function AcertoDoLuan({ confirmado: a, painel = false }: { confirmado: AcertoConfirmado; painel?: boolean }) {
  return (
    <section className="bloco">
      <h2>Acerto confirmado</h2>
      <p className="discreto pequeno">
        {a.confirmadoPorNome ? `Por ${a.confirmadoPorNome}` : 'Pela expedição'} em {formatarData(a.confirmadoEm.slice(0, 10))} às{' '}
        {formatarHora(a.confirmadoEm)}. {painel ? 'O caixa fica travado para o motoboy.' : 'A noite fica travada; só o admin reabre.'}
      </p>
      <dl className="liquidacao">
        <div>
          <dt>Dinheiro contado</dt>
          <dd>{formatarReais(a.dinheiroContado)}</dd>
        </div>
        {a.falta > 0 && (
          <div>
            <dt>Faltou</dt>
            <dd>{formatarReais(a.falta)}</dd>
          </div>
        )}
        {a.sobra > 0 && (
          <div>
            <dt>Sobrou</dt>
            <dd>{formatarReais(a.sobra)}</dd>
          </div>
        )}
        <div>
          <dt>{painel ? 'Pago ao motoboy' : 'Você recebeu'}</dt>
          <dd>{formatarReais(a.pagoAoMotoboy)}</dd>
        </div>
        <div>
          <dt>{painel ? 'Do caixa dele' : 'Do seu caixa'}</dt>
          <dd>{formatarReais(a.pagoDoCaixaDele)}</dd>
        </div>
        <div>
          <dt>Do caixa da empresa</dt>
          <dd>{formatarReais(a.retiradoCaixaEmpresa)}</dd>
        </div>
        <div>
          <dt>Foi para a empresa</dt>
          <dd>{formatarReais(a.vaiParaEmpresa)}</dd>
        </div>
        {a.completadoDoBolso > 0 && (
          <div>
            <dt>Completou do bolso</dt>
            <dd>{formatarReais(a.completadoDoBolso)}</dd>
          </div>
        )}
      </dl>
      {a.obs && <p className="discreto">{a.obs}</p>}
    </section>
  )
}

const CLASSE_LINHA: Record<string, string> = { Devolver: 'devolver', Maquininha: 'maquininha', Receber: 'receber' }

export function Conta({ acerto }: { acerto: Acerto }) {
  return (
    <section className="bloco">
      <h2>Conta</h2>
      {detalharAcerto(acerto).map((l) => (
        <div key={l.rotulo} className={`linha-conta ${CLASSE_LINHA[l.rotulo] ?? ''}`}>
          <div className="linha-conta-topo">
            <span>{l.rotulo}</span>
            <strong>{formatarReais(l.valor)}</strong>
          </div>
          <p className="discreto pequeno">{l.origem}</p>
        </div>
      ))}
    </section>
  )
}

/** R17: entregues, que voltaram e taxas por área. */
export function EntregasPorCidade({ porArea, areas }: { porArea: Acerto['porArea']; areas: Area[] }) {
  if (Object.keys(porArea).length === 0) return null
  return (
    <section className="bloco">
      <h2>Entregas por cidade</h2>
      <TabelaCidades porArea={porArea} areas={areas} />
    </section>
  )
}

export function TabelaCidades({ porArea, areas }: { porArea: Acerto['porArea']; areas: Area[] }) {
  const { linhas, total } = entregasPorCidade(porArea, areas)
  if (linhas.length === 0) return null
  return (
    <table className="tabela">
      <thead>
        <tr>
          <th>Área</th>
          <th>Entregues</th>
          <th>Voltou</th>
          <th>Taxas</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => (
          <tr key={l.areaId}>
            <td>{l.nome}</td>
            <td>{l.entregues}</td>
            <td>{l.voltaram}</td>
            <td>{formatarReais(l.taxas)}</td>
          </tr>
        ))}
      </tbody>
      {linhas.length > 1 && (
        <tfoot>
          <tr>
            <td>Total</td>
            <td>{total.entregues}</td>
            <td>{total.voltaram}</td>
            <td>{formatarReais(total.taxas)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

/** R16: tocar marca a comanda de papel como entregue ao Luan; as que faltam ficam no topo. */
export function Papeis(props: {
  comandas: Comanda[]
  areas: Area[]
  leitura: boolean
  aoAlternar: (c: Comanda) => Promise<void>
  dica: string
}) {
  const { comandas, areas, leitura } = props
  const { lista, faltando } = papeisParaConferir(comandas)
  const [erro, setErro] = useState<string | null>(null)
  if (lista.length === 0) return null

  async function alternar(c: Comanda) {
    try {
      await props.aoAlternar(c)
      setErro(null)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  return (
    <section className="bloco">
      <h2>Papéis</h2>
      <p className={faltando === 0 ? 'sucesso' : 'discreto pequeno'}>
        {faltando === 0
          ? 'Todos os papéis conferidos.'
          : `${faltando} ${faltando === 1 ? 'papel ainda não conferido' : 'papéis ainda não conferidos'}. ${props.dica}`}
      </p>
      {lista.map((c) => (
        <button
          key={c.id}
          type="button"
          className="item-papel"
          aria-pressed={c.papelConferido === true}
          disabled={leitura}
          onClick={() => alternar(c)}
        >
          <span className="marca" aria-hidden>
            {c.papelConferido && <Icone nome="check" tamanho={16} />}
          </span>
          <span className="papel-meio">
            <strong className="codigo">{c.codigo}</strong>
            {/* Dados para refazer a comanda se o papel sumiu. */}
            <span className="detalhe">
              {areas.find((a) => a.id === c.areaId)?.nome ?? '—'} · {nomesFormas(c.pagamentos)}
              {c.troco > 0 && <> · troco Pix {formatarReais(c.troco)}</>} ·{' '}
              {c.status === 'em_rota' ? 'lançada' : c.status === 'voltou' ? 'voltou' : 'entregue'}{' '}
              {formatarHora(c.finalizadaEm ?? c.criadaEm)}
            </span>
          </span>
          <strong className="valor">{formatarReais(c.total)}</strong>
        </button>
      ))}
      {erro && <p className="erro">{erro}</p>}
    </section>
  )
}

/** O que o relatório da maquininha deve mostrar; tocar numa linha marca o comprovante como conferido. */
export function Maquininha(props: {
  comandas: Comanda[]
  leitura: boolean
  aoAlternar?: (c: Comanda, indice: number, conferido: boolean) => Promise<void>
}) {
  const { comandas } = props
  const leitura = props.leitura || !props.aoAlternar
  const { grupos, faltamConferir } = resumoMaquininha(comandas)
  const [erro, setErro] = useState<string | null>(null)

  async function alternar(comandaId: string, indice: number, conferido: boolean) {
    const c = comandas.find((x) => x.id === comandaId)
    if (!c || !props.aoAlternar) return
    try {
      await props.aoAlternar(c, indice, !conferido)
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
                <span>{g.nome}</span>
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
