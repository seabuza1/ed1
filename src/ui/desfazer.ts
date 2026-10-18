import { createContext, useContext } from 'react'

/** Mostra um aviso por 5 segundos, com "Desfazer" se houver como desfazer. */
export type MostrarAviso = (texto: string, desfazer?: () => Promise<void> | void) => void

export const ContextoAviso = createContext<MostrarAviso>(() => {})

export const useAviso = () => useContext(ContextoAviso)
