/** Centavos → "R$ 1.234,56". */
export function formatarReais(centavos: number): string {
  const sinal = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  const reais = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const cents = String(abs % 100).padStart(2, '0')
  return `${sinal}R$ ${reais},${cents}`
}
