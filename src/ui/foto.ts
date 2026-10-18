// Foto da comanda no aparelho: reduz para 1600 px em JPEG 0,8 e mede a nitidez antes de enviar.
import { paraBase64 } from '../data/nuvem/base64'
import { emCinza, LADO_MAXIMO, LADO_NITIDEZ, nitidez, reduzir } from '../domain/foto'

export interface FotoPronta {
  blob: Blob
  /** JPEG em base64, sem o prefixo data: (o formato da Edge Function). */
  base64: string
  nitidez: number
}

function desenhar(origem: ImageBitmap, maximo: number) {
  const { largura, altura } = reduzir(origem.width, origem.height, maximo)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Este aparelho não conseguiu abrir a foto.')
  ctx.drawImage(origem, 0, 0, largura, altura)
  return { canvas, ctx, largura, altura }
}

export async function prepararFoto(arquivo: Blob): Promise<FotoPronta> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  try {
    const grande = desenhar(bitmap, LADO_MAXIMO)
    const blob = await new Promise<Blob>((ok, erro) =>
      grande.canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Não deu para preparar a foto.'))), 'image/jpeg', 0.8),
    )
    const pequena = desenhar(bitmap, LADO_NITIDEZ)
    const px = pequena.ctx.getImageData(0, 0, pequena.largura, pequena.altura).data
    return { blob, base64: await paraBase64(blob), nitidez: nitidez(emCinza(px), pequena.largura, pequena.altura) }
  } finally {
    bitmap.close()
  }
}
