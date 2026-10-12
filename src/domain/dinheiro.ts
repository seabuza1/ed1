// Dinheiro sempre em centavos (inteiro). Exibição: "R$ 1.234,56".

export function formatarReais(centavos: number): string {
  const sinal = centavos < 0 ? '-' : ''
  const abs = Math.abs(Math.round(centavos))
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const cents = (abs % 100).toString().padStart(2, '0')
  return `${sinal}R$ ${reais},${cents}`
}
