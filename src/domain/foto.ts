// Foto da comanda antes de enviar (docs/SPEC-leitura.md, Front): tamanho e nitidez.

/** Maior lado da foto enviada. */
export const LADO_MAXIMO = 1600

/** Lado da cópia pequena usada só para medir a nitidez (mais rápido e menos sensível a ruído). */
export const LADO_NITIDEZ = 800

/**
 * Abaixo disto a foto é "tremida". Ponto de partida, a calibrar com as fotos da noite de teste: na
 * cópia de 800 px, a 3557 (foto ruim, mas legível) dá ~1850; borrada 1 px, ~46; 2 px, ~5.
 */
export const NITIDEZ_MINIMA = 20

/** Tamanho com o maior lado até `maximo`, mantendo a proporção; nunca aumenta. */
export function reduzir(largura: number, altura: number, maximo: number): { largura: number; altura: number } {
  const escala = Math.min(1, maximo / Math.max(largura, altura))
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) }
}

/** Tons de cinza (luminância) a partir de RGBA. */
export function emCinza(rgba: ArrayLike<number>): Float32Array {
  const cinza = new Float32Array(rgba.length / 4)
  for (let i = 0; i < cinza.length; i++) cinza[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
  return cinza
}

/** Variância do Laplaciano (4 vizinhos): foto tremida ou desfocada tem pouca borda e dá valor baixo. */
export function nitidez(cinza: ArrayLike<number>, largura: number, altura: number): number {
  if (largura < 3 || altura < 3) return 0
  let soma = 0
  let somaQuadrados = 0
  let n = 0
  for (let y = 1; y < altura - 1; y++)
    for (let x = 1; x < largura - 1; x++) {
      const i = y * largura + x
      const l = cinza[i - largura] + cinza[i + largura] + cinza[i - 1] + cinza[i + 1] - 4 * cinza[i]
      soma += l
      somaQuadrados += l * l
      n++
    }
  const media = soma / n
  return somaQuadrados / n - media * media
}
