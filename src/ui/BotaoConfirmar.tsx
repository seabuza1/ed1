import { useEffect, useState, type ReactNode } from 'react'

/** Confirmação com dois toques: o primeiro arma, o segundo (em até 4 s) executa. */
export function BotaoConfirmar(props: {
  children: ReactNode
  confirmacao: ReactNode
  onConfirmar: () => void
  className?: string
}) {
  const [armado, setArmado] = useState(false)

  useEffect(() => {
    if (!armado) return
    const t = setTimeout(() => setArmado(false), 4000)
    return () => clearTimeout(t)
  }, [armado])

  return (
    <button
      type="button"
      className={`${props.className ?? ''} ${armado ? 'armado' : ''}`}
      onClick={() => {
        if (!armado) return setArmado(true)
        setArmado(false)
        props.onConfirmar()
      }}
    >
      {armado ? props.confirmacao : props.children}
    </button>
  )
}
