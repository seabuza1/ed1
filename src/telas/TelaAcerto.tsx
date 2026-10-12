import { useState } from 'react'
import { calcularAcerto } from '../domain/acerto'
import { formatarData, formatarHora } from '../domain/datas'
import { avisoAoFechar, fecharNoite, reabrirNoite } from '../domain/noite'
import type { Comanda, Noite } from '../domain/tipos'
import { repo } from '../data/repo'
import { BarraTotais } from '../ui/BarraTotais'
import { BotaoConfirmar } from '../ui/BotaoConfirmar'
import { mensagemDeErro } from '../ui/erro'

/** Noite em foco: a aberta ou, sem ela, a última fechada (só leitura). */
export function TelaAcerto(props: { noite: Noite | undefined; noites: Noite[]; comandas: Comanda[] }) {
  const { noite, comandas } = props
  const [erro, setErro] = useState<string | null>(null)

  if (!noite)
    return (
      <main className="app">
        <h1>Acerto</h1>
        <p className="discreto">Nenhuma noite ainda.</p>
      </main>
    )

  async function salvar(n: Noite) {
    try {
      await repo.salvarNoite(n)
    } catch (e) {
      setErro(mensagemDeErro(e))
    }
  }

  const aviso = noite.fechadaEm === null ? avisoAoFechar(comandas) : null

  return (
    <>
      <BarraTotais acerto={calcularAcerto(noite, comandas)} />
      <main className="app pilha">
        <h1>Noite de {formatarData(noite.data)}</h1>
        {noite.fechadaEm === null ? (
          <>
            {aviso && <p className="aviso">{aviso}</p>}
            <BotaoConfirmar
              className="primario"
              confirmacao="Toque de novo para fechar"
              onConfirmar={() => salvar(fecharNoite(noite, new Date().toISOString()))}
            >
              Fechar a noite
            </BotaoConfirmar>
          </>
        ) : (
          <>
            <p className="discreto">Fechada às {formatarHora(noite.fechadaEm)}. Só leitura.</p>
            <button
              type="button"
              className="secundario"
              onClick={() => {
                const r = reabrirNoite(noite, props.noites)
                if (!r.ok) return setErro(r.erro)
                salvar(r.valor)
              }}
            >
              Reabrir
            </button>
          </>
        )}
        {erro && <p className="erro">{erro}</p>}
      </main>
    </>
  )
}
