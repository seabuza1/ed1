// Dinheiro sempre em centavos (inteiro). Exibição: "R$ 1.234,56", com espaço não separável
// (\u00a0) para o valor não quebrar de linha longe do "R$".

export function formatarReais(centavos: number): string {
  const sinal = centavos < 0 ? '-' : ''
  const abs = Math.abs(Math.round(centavos))
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const cents = (abs % 100).toString().padStart(2, '0')
  return `${sinal}R$\u00a0${reais},${cents}`
}

/** Lê o que foi digitado ("80", "80,50", "1.234,56", "R$ 12.5") em centavos; null se inválido. */
export function lerReais(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, '')
  if (t === '') return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/\.\d{3}$/.test(t)) t = t.replace(/\./g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  return Math.round(Number(t) * 100)
}

/** Valor para preencher um campo: "80" ou "80,50". */
export function paraCampo(centavos: number): string {
  const reais = Math.floor(centavos / 100)
  const cents = centavos % 100
  return cents === 0 ? `${reais}` : `${reais},${cents.toString().padStart(2, '0')}`
}
