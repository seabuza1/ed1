/** UUID v4. crypto.randomUUID só existe em https/localhost; o fallback cobre o teste pela rede local. */
export function novoId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Instante atual em ISO, para criadaEm/atualizadaEm/fechadaEm. */
export const agora = () => new Date().toISOString()

/** Segundos inteiros desde o instante (ms), para medir o tempo da foto ao lançamento. */
export const segundosDesde = (inicio: number) => Math.round((Date.now() - inicio) / 1000)
