import { describe, expect, it } from 'vitest'
import { emCinza, nitidez, reduzir } from './foto'

const imagem = (largura: number, altura: number, f: (x: number, y: number) => number) => {
  const px: number[] = []
  for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) px.push(f(x, y))
  return px
}

describe('foto da comanda', () => {
  it('reduz até 1600 no maior lado, sem aumentar', () => {
    expect(reduzir(3000, 4000, 1600)).toEqual({ largura: 1200, altura: 1600 })
    expect(reduzir(4000, 3000, 1600)).toEqual({ largura: 1600, altura: 1200 })
    expect(reduzir(901, 1600, 1600)).toEqual({ largura: 901, altura: 1600 })
    expect(reduzir(800, 600, 1600)).toEqual({ largura: 800, altura: 600 })
  })

  it('cinza pela luminância', () => {
    expect([...emCinza([255, 255, 255, 255, 0, 0, 0, 255])].map(Math.round)).toEqual([255, 0])
  })

  it('nitidez: lisa dá zero; bordas nítidas dão mais que as borradas', () => {
    expect(nitidez(imagem(20, 20, () => 128), 20, 20)).toBe(0)
    // Listras de 1 px (nítidas) contra a mesma listra borrada numa rampa de 8 px.
    const nitida = imagem(64, 64, (x) => (Math.floor(x / 8) % 2 ? 255 : 0))
    const borrada = imagem(64, 64, (x) => {
      const fase = (x % 16) / 16
      return 127.5 - 127.5 * Math.cos(fase * 2 * Math.PI)
    })
    expect(nitidez(nitida, 64, 64)).toBeGreaterThan(10 * nitidez(borrada, 64, 64))
  })
})
