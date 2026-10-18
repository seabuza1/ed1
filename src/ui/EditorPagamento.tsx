import { useState } from 'react'
import { FORMAS, NOMES_FORMA } from '../domain/comanda'
import { paraCampo } from '../domain/dinheiro'
import type { Forma } from '../domain/tipos'
import { CampoReais } from './CampoReais'
import { restoPrevisto, temDinheiroNoEstado, type EstadoPagamento } from './pagamento'

const outraForma = (f: Forma | null): Forma => (f === 'dinheiro' ? 'cartao' : 'dinheiro')

/**
 * Forma de pagamento (chips) ou divisão em linhas; troco por Pix só com dinheiro.
 * Com `aoTocarForma` (lançamento), tocar no chip já lança, e o troco e a divisão
 * ficam em "Mais opções".
 */
export function EditorPagamento(props: {
  estado: EstadoPagamento
  onChange: (e: EstadoPagamento) => void
  total: number | null
  aoTocarForma?: (e: EstadoPagamento) => void
}) {
  const { estado } = props
  const lancamento = props.aoTocarForma !== undefined
  const [mais, setMais] = useState(() => estado.troco !== '' || estado.dividido)
  const set = (parcial: Partial<EstadoPagamento>) => props.onChange({ ...estado, ...parcial })
  const setLinha = (i: number, parcial: Partial<EstadoPagamento['linhas'][number]>) =>
    set({ linhas: estado.linhas.map((l, j) => (j === i ? { ...l, ...parcial } : l)) })
  const resto = restoPrevisto(estado, props.total)

  const campoTroco = (
    <CampoReais rotulo="Troco por Pix" valor={estado.troco} placeholder="0" onChange={(t) => set({ troco: t })} />
  )
  const dividir = (
    <button
      type="button"
      className="link alinha-inicio"
      onClick={() =>
        set({
          dividido: true,
          linhas: [
            { forma: estado.forma ?? 'pix_antecipado', valor: '' },
            { forma: outraForma(estado.forma ?? 'pix_antecipado'), valor: '' },
          ],
        })
      }
    >
      Pagou de mais de um jeito
    </button>
  )

  if (!estado.dividido)
    return (
      <div className="pilha-curta">
        <span className="rotulo-grupo">{lancamento ? 'Forma de pagamento · tocar já lança' : 'Forma de pagamento'}</span>
        <div className="chips" role="group" aria-label="Forma de pagamento">
          {FORMAS.map((f) => (
            <button
              key={f}
              type="button"
              className="chip"
              aria-pressed={estado.forma === f}
              onClick={() => {
                const novo = { ...estado, forma: f }
                props.onChange(novo)
                props.aoTocarForma?.(novo)
              }}
            >
              {NOMES_FORMA[f]}
            </button>
          ))}
        </div>
        {lancamento ? (
          mais ? (
            <div className="pilha-curta mais-opcoes">
              {campoTroco}
              <p className="discreto pequeno">O troco por Pix só conta se tiver parte em dinheiro.</p>
              {dividir}
            </div>
          ) : (
            <button type="button" className="link alinha-inicio" onClick={() => setMais(true)}>
              Mais opções
            </button>
          )
        ) : (
          <>
            {dividir}
            {temDinheiroNoEstado(estado) && campoTroco}
          </>
        )}
      </div>
    )

  return (
    <div className="pilha-curta">
      <span className="rotulo-grupo">Pagou de mais de um jeito</span>
      {estado.linhas.map((l, i) => (
        <div className="linha-pagamento" key={i}>
          <select aria-label="Forma" value={l.forma} onChange={(e) => setLinha(i, { forma: e.target.value as Forma })}>
            {FORMAS.map((f) => (
              <option key={f} value={f}>
                {NOMES_FORMA[f]}
              </option>
            ))}
          </select>
          <CampoReais
            rotulo="Valor"
            ocultarRotulo
            valor={l.valor}
            placeholder={resto !== null && l.valor.trim() === '' ? `resto ${paraCampo(resto)}` : 'resto'}
            onChange={(t) => setLinha(i, { valor: t })}
          />
          <button
            type="button"
            className="remover"
            aria-label={`Remover ${NOMES_FORMA[l.forma]}`}
            disabled={estado.linhas.length <= 1}
            onClick={() => set({ linhas: estado.linhas.filter((_, j) => j !== i) })}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="lado-a-lado">
        <button
          type="button"
          className="secundario"
          onClick={() => set({ linhas: [...estado.linhas, { forma: 'dinheiro', valor: '' }] })}
        >
          + Outra forma
        </button>
        <button
          type="button"
          className="secundario"
          onClick={() => set({ dividido: false, forma: estado.linhas[0]?.forma ?? null })}
        >
          Uma forma só
        </button>
      </div>
      <p className="discreto pequeno">A linha sem valor fica com o resto.</p>
      {temDinheiroNoEstado(estado) && campoTroco}
    </div>
  )
}
