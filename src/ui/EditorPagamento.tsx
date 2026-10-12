import { FORMAS, NOMES_FORMA } from '../domain/comanda'
import { paraCampo } from '../domain/dinheiro'
import type { Forma } from '../domain/tipos'
import { CampoReais } from './CampoReais'
import { restoPrevisto, temDinheiroNoEstado, type EstadoPagamento } from './pagamento'

const outraForma = (f: Forma | null): Forma => (f === 'dinheiro' ? 'cartao' : 'dinheiro')

/** Forma prevista (chips) ou divisão em linhas; troco por Pix só com dinheiro. */
export function EditorPagamento(props: {
  estado: EstadoPagamento
  onChange: (e: EstadoPagamento) => void
  total: number | null
}) {
  const { estado } = props
  const set = (parcial: Partial<EstadoPagamento>) => props.onChange({ ...estado, ...parcial })
  const setLinha = (i: number, parcial: Partial<EstadoPagamento['linhas'][number]>) =>
    set({ linhas: estado.linhas.map((l, j) => (j === i ? { ...l, ...parcial } : l)) })
  const resto = restoPrevisto(estado, props.total)

  return (
    <div className="pilha-curta">
      <span className="rotulo-grupo">{estado.dividido ? 'Pagou de mais de um jeito' : 'Forma de pagamento'}</span>
      {!estado.dividido ? (
        <>
          <div className="chips" role="group" aria-label="Forma de pagamento">
            {FORMAS.map((f) => (
              <button
                key={f}
                type="button"
                className="chip"
                aria-pressed={estado.forma === f}
                onClick={() => set({ forma: f })}
              >
                {NOMES_FORMA[f]}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="link"
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
        </>
      ) : (
        <>
          {estado.linhas.map((l, i) => (
            <div className="linha-pagamento" key={i}>
              <select
                aria-label="Forma"
                value={l.forma}
                onChange={(e) => setLinha(i, { forma: e.target.value as Forma })}
              >
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
        </>
      )}
      {temDinheiroNoEstado(estado) && (
        <CampoReais
          rotulo="Troco por Pix"
          valor={estado.troco}
          placeholder="0"
          onChange={(t) => set({ troco: t })}
        />
      )}
    </div>
  )
}
