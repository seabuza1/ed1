import { useEffect, useRef } from 'react'
import { pixQueCairam, textoPixCaiu } from '../domain/comanda'
import type { Comanda } from '../domain/tipos'
import { useAviso } from './desfazer'

/** "Pix da 0017 caiu" quando a confirmação do Luan chega (pela nuvem). Não avisa o que já estava confirmado ao abrir. */
export function useAvisoPix(comandas: Comanda[] | undefined, noiteId: string | undefined) {
  const aviso = useAviso()
  const vistos = useRef<{ noiteId: string | undefined; ids: Set<string> } | null>(null)
  useEffect(() => {
    if (!comandas) return
    // Trocou de noite: só passa a acompanhar, sem avisar.
    if (vistos.current && vistos.current.noiteId === noiteId) {
      const novos = pixQueCairam(vistos.current.ids, comandas)
      if (novos.length) aviso(textoPixCaiu(novos))
    }
    vistos.current = { noiteId, ids: new Set(comandas.filter((c) => c.pixConfirmado).map((c) => c.id)) }
  }, [comandas, noiteId, aviso])
}
