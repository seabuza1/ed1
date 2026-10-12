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

/** ISO → "12/10/2026 às 23:40" no horário do aparelho. */
export function formatarDataHora(instante: string): string {
  const d = new Date(instante)
  return `${formatarData(iso(d))} às ${formatarHora(instante)}`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "2026-10-12" → { dia: '12', mes: 'out', semana: 'seg' } para o cartão do histórico. */
export function partesData(data: string): { dia: string; mes: string; semana: string } {
  const [a, m, d] = data.split('-').map(Number)
  return {
    dia: String(d).padStart(2, '0'),
    mes: MESES[m - 1],
    semana: SEMANA[new Date(a, m - 1, d).getDay()],
  }
}
