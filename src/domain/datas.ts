const doisDig = (n: number) => n.toString().padStart(2, '0')

const iso = (d: Date) => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`

/** R13: o turno vai das 18h à meia-noite; entre 00h e 06h a data é a do dia anterior. */
export function dataDaNoite(agora: Date): string {
  const d = new Date(agora)
  if (d.getHours() < 6) d.setDate(d.getDate() - 1)
  return iso(d)
}

/** "2026-10-12" → "12/10/2026" */
export function formatarData(data: string): string {
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

/** ISO → "23:40" no horário do aparelho. */
export function formatarHora(instante: string): string {
  const d = new Date(instante)
  return `${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`
}
