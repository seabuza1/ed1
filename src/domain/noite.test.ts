import { describe, expect, it } from 'vitest'
import { dataDaNoite, formatarData, formatarDataHora, partesData } from './datas'
import { lerReais, paraCampo } from './dinheiro'
import { abrirNoite, avisoAoFechar, editarValoresNoite, fecharNoite, noiteAberta, reabrirNoite } from './noite'
import type { Comanda, Noite } from './tipos'
import { r$ } from '../teste/r$'

describe('R13 dataDaNoite', () => {
  it('entre 18h e meia-noite é o próprio dia', () => {
    expect(dataDaNoite(new Date(2026, 9, 12, 18, 0))).toBe('2026-10-12')
    expect(dataDaNoite(new Date(2026, 9, 12, 23, 59))).toBe('2026-10-12')
  })
  it('entre 00h e 06h é o dia anterior', () => {
    expect(dataDaNoite(new Date(2026, 9, 13, 0, 10))).toBe('2026-10-12')
    expect(dataDaNoite(new Date(2026, 9, 13, 5, 59))).toBe('2026-10-12')
    expect(dataDaNoite(new Date(2026, 10, 1, 1, 0))).toBe('2026-10-31')
    expect(dataDaNoite(new Date(2027, 0, 1, 2, 0))).toBe('2026-12-31')
  })
  it('a partir das 06h é o dia', () => {
    expect(dataDaNoite(new Date(2026, 9, 13, 6, 0))).toBe('2026-10-13')
  })
  it('formata a data', () => expect(formatarData('2026-10-12')).toBe('12/10/2026'))
  it('partes da data para o histórico', () => {
    expect(partesData('2026-10-12')).toEqual({ dia: '12', mes: 'out', semana: 'seg' })
    expect(partesData('2026-01-03')).toEqual({ dia: '03', mes: 'jan', semana: 'sáb' })
  })
  it('data e hora no horário do aparelho', () =>
    expect(formatarDataHora(new Date(2026, 9, 12, 23, 40).toISOString())).toBe('12/10/2026 às 23:40'))
})

describe('lerReais', () => {
  it('lê o que foi digitado em centavos', () => {
    expect(lerReais('80')).toBe(8000)
    expect(lerReais('80,5')).toBe(8050)
    expect(lerReais('R$ 1.234,56')).toBe(123456)
    expect(lerReais(r$('R$ 1.234,56'))).toBe(123456) // colado da tela
    expect(lerReais('12.5')).toBe(1250)
    expect(lerReais('1.234')).toBe(123400)
    expect(lerReais('0,07')).toBe(7)
  })
  it('rejeita o inválido', () => {
    expect(lerReais('')).toBeNull()
    expect(lerReais('abc')).toBeNull()
    expect(lerReais('-5')).toBeNull()
    expect(lerReais('1,234')).toBeNull()
  })
  it('preenche campos', () => {
    expect(paraCampo(8000)).toBe('80')
    expect(paraCampo(8050)).toBe('80,50')
  })
})

describe('abrir e fechar noite', () => {
  const entrada = { data: '2026-10-12', caixaInicial: 8000, diaria: 3000 }
  const abrir = (noites: Noite[], e = entrada, id = 'n1') => abrirNoite(e, noites, id)

  it('abre com os valores informados e nada conferido', () => {
    const r = abrir([])
    expect(r.ok && r.valor).toMatchObject({ ...entrada, fechadaEm: null, dinheiroContado: null, obs: '' })
  })

  it('uma noite aberta por vez', () => {
    const r1 = abrir([])
    if (!r1.ok) throw new Error()
    const r2 = abrir([r1.valor], { ...entrada, data: '2026-10-13' }, 'n2')
    expect(r2).toEqual({ ok: false, erro: 'A noite de 12/10/2026 ainda está aberta.' })
  })

  it('não repete a data: pede para reabrir', () => {
    const r1 = abrir([])
    if (!r1.ok) throw new Error()
    const fechada = fecharNoite(r1.valor, '2026-10-12T23:50:00Z')
    expect(noiteAberta([fechada])).toBeUndefined()
    expect(abrir([fechada]).ok).toBe(false)
  })

  it('reabre só se não houver outra aberta', () => {
    const a = abrir([])
    const b = abrir([], { ...entrada, data: '2026-10-13' }, 'n2')
    if (!a.ok || !b.ok) throw new Error()
    const fechada = fecharNoite(a.valor, 'x')
    expect(reabrirNoite(fechada, [fechada, b.valor]).ok).toBe(false)
    const r = reabrirNoite(fechada, [fechada])
    expect(r.ok && r.valor.fechadaEm).toBeNull()
  })

  it('edita caixa e diária só com a noite aberta', () => {
    const r = abrir([])
    if (!r.ok) throw new Error()
    const ed = editarValoresNoite(r.valor, { caixaInicial: 10000, diaria: 3500 })
    expect(ed.ok && ed.valor.caixaInicial).toBe(10000)
    expect(editarValoresNoite(fecharNoite(r.valor, 'x'), { caixaInicial: 1, diaria: 1 }).ok).toBe(false)
  })

  it('avisa comanda em rota ao fechar', () => {
    const c = (status: Comanda['status']) => ({ status }) as Comanda
    expect(avisoAoFechar([c('entregue'), c('voltou')])).toBeNull()
    expect(avisoAoFechar([c('em_rota'), c('entregue')])).toBe('1 comanda ainda em rota. Ela vai contar como entregue.')
    expect(avisoAoFechar([c('em_rota'), c('em_rota')])).toMatch(/^2 comandas/)
  })
})
