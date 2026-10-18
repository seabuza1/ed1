import type { Ref } from 'react'

export function CampoReais({
  ref,
  ...props
}: {
  ref?: Ref<HTMLInputElement>
  rotulo: string
  ocultarRotulo?: boolean
  valor: string
  onChange: (texto: string) => void
  placeholder?: string
  desabilitado?: boolean
  /** Ao sair do campo (ou Enter): para gravar uma vez só, e não a cada dígito. */
  aoSair?: () => void
}) {
  return (
    <label className="campo">
      <span className={props.ocultarRotulo ? 'so-leitor' : undefined}>{props.rotulo}</span>
      <span className="reais">
        <span aria-hidden>R$</span>
        <input
          ref={ref}
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          placeholder={props.placeholder}
          disabled={props.desabilitado}
          value={props.valor}
          onChange={(e) => props.onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onFocus={(e) => e.target.select()}
          onBlur={props.aoSair}
        />
      </span>
    </label>
  )
}
