export function CampoReais(props: {
  rotulo: string
  valor: string
  onChange: (texto: string) => void
}) {
  return (
    <label className="campo">
      <span>{props.rotulo}</span>
      <span className="reais">
        <span aria-hidden>R$</span>
        <input
          inputMode="decimal"
          autoComplete="off"
          value={props.valor}
          onChange={(e) => props.onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </span>
    </label>
  )
}
