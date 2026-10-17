import { useSyncExternalStore } from 'react'
import type { EstadoSync, FonteSync } from '../data/repo'
import { repo } from '../data/repo'
import { Icone } from './Icone'

const PARADO: EstadoSync = { pendentes: 0, fotos: 0, enviando: false, online: true, recusa: null }
const nada = () => () => {}

function useEstadoSync(fonte: FonteSync | undefined): EstadoSync {
  return useSyncExternalStore(fonte ? fonte.aoMudar : nada, fonte ? fonte.obter : () => PARADO)
}

const alteracoes = (n: number) => `${n} ${n === 1 ? 'alteração' : 'alterações'}`

/** "Salvo na nuvem" ou "3 alterações esperando internet". Nada sem nuvem. */
export function IndicadorNuvem() {
  const fonte = repo.sync
  const e = useEstadoSync(fonte)
  if (!fonte) return null
  const texto =
    e.pendentes === 0
      ? 'Salvo na nuvem'
      : e.online
        ? `Enviando ${alteracoes(e.pendentes)}…`
        : `${alteracoes(e.pendentes)} esperando internet`
  return (
    <>
      <p className={`indicador-nuvem ${e.pendentes ? 'pendente' : ''}`} role="status">
        <Icone nome={e.pendentes && !e.online ? 'semNuvem' : 'nuvem'} tamanho={15} />
        {texto}
      </p>
      {e.recusa && (
        <div className="aviso">
          <p>{e.recusa}</p>
          <button type="button" className="link alinha-inicio" onClick={fonte.limparRecusa}>
            Entendi
          </button>
        </div>
      )}
    </>
  )
}
