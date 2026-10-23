import { describe, expect, it } from 'vitest'
import exemplo3557 from '../../supabase/functions/_shared/exemplos/3557.json'
import { comandaDaLeitura, conferirLeitura, registroLeitura, type LeituraCompleta, type LeituraConferencia } from './leitura'
import { deCsv, linhasMedicao, nomeArquivoLeituras, paraCsv, resumirMedicao, verdeErrada, type LeituraMedida } from './medicao'
import type { Area, Comanda } from './tipos'

const AREAS: Area[] = [
  { id: 'a', nome: 'Aragarças', taxa: 500, ativa: true },
  { id: 'b', nome: 'Barra do Garças', taxa: 1200, ativa: true },
]
const lida = exemplo3557 as unknown as { leitura: LeituraCompleta; conferencia: LeituraConferencia }

function medida(
  extra: {
    corrigido?: boolean
    forcado?: boolean
    mudar?: Partial<Comanda>
    apagada?: boolean
    /** Leitura feita depois (R28) de uma comanda lançada à mão assim. */
    lancadaAMao?: Partial<Comanda>
  } = {},
): LeituraMedida {
  const r = conferirLeitura({ ...lida, areas: AREAS, promoDesconto: null })
  const c = comandaDaLeitura(r, AREAS, 0, { id: 'c1', noiteId: 'n1', agora: '2026-10-16T21:00:00.000Z', fotoPath: 'n1/c1.jpg' })
  if (!c.ok) throw new Error(c.erro)
  const tokens = { entrada: 1200, cache: 5000, saida: 900 }
  const registro = registroLeitura({ ...lida, provedor: 'google', modelo: 'm', ms: 1500, tokens }, r, {
    id: 'c1',
    noiteId: 'n1',
    fotoPath: 'n1/c1.jpg',
    comanda: { ...c.valor, ...extra.lancadaAMao },
    estadoFinal: r.estado,
    segundos: 9,
    corrigido: extra.corrigido ?? false,
    forcado: extra.forcado ?? false,
    posterior: extra.lancadaAMao !== undefined,
    agora: '2026-10-16T21:00:00.000Z',
  })
  return {
    registro,
    data: '2026-10-16',
    motoboy: 'Felipe',
    atual: extra.apagada ? null : { ...c.valor, ...extra.lancadaAMao, ...extra.mudar },
  }
}

describe('medição da leitura', () => {
  it('verde errada: verde que foi corrigida ou mudou depois; apagada não conta', () => {
    expect(verdeErrada(medida())).toBe(false)
    expect(verdeErrada(medida({ corrigido: true }))).toBe(true)
    expect(verdeErrada(medida({ mudar: { total: 11800 } }))).toBe(true)
    expect(verdeErrada(medida({ apagada: true }))).toBe(false)
    // Só o valor de uma parte ou o troco mudou: também conta.
    expect(verdeErrada(medida({ mudar: { troco: 300 } }))).toBe(true)
  })

  it('verde lida depois que discorda do lançado à mão também é errada (R28)', () => {
    expect(verdeErrada(medida({ lancadaAMao: {} }))).toBe(false)
    expect(verdeErrada(medida({ lancadaAMao: { total: 11800 } }))).toBe(true)
    expect(verdeErrada(medida({ lancadaAMao: { areaId: 'b' } }))).toBe(true)
    expect(verdeErrada(medida({ lancadaAMao: { pagamentos: [{ forma: 'dinheiro', valor: 11300 }] } }))).toBe(true)
  })

  it('uma linha por leitura, com o lido e o lançado lado a lado', () => {
    const [cabecalho, linha] = linhasMedicao([medida()], AREAS)
    const celula = (nome: string) => linha[cabecalho.indexOf(nome)]
    expect(celula('codigo_lido')).toBe('3557')
    expect(celula('total_lido')).toBe('113,00')
    expect(celula('total_lancado')).toBe('113,00')
    expect(celula('area_sugerida')).toBe('Aragarças')
    expect(celula('origem_area')).toBe('escrito')
    expect(celula('pagamento_lancado')).toBe('cartão')
    expect([celula('estado'), celula('verde_errada'), celula('segundos'), celula('ms_ia')]).toEqual(['verde', 'não', '9', '1500'])
    expect([celula('provedor'), celula('modelo'), celula('tokens_entrada'), celula('tokens_cache'), celula('tokens_saida')]).toEqual(['google', 'm', '1200', '5000', '900'])
  })

  it('lê o CSV de volta: BOM do Excel, aspas, ";" ou "," e o \' da fórmula', () => {
    const linhas = [['foto', 'codigo', 'obs'], ['a.jpg', '3557', 'b;c "d"'], ['b.jpg', '-3', '=SOMA(1)']]
    expect(deCsv(`\uFEFF${paraCsv(linhas)}\r\n`)).toEqual(linhas)
    expect(deCsv('nome,taxa\nAragarças,"5,00"\n')).toEqual([['nome', 'taxa'], ['Aragarças', '5,00']])
  })

  it('CSV com ";", aspas quando precisa e sem virar fórmula', () => {
    expect(paraCsv([['a', 'b;c', 'diz "oi"', '=SOMA(1)', '-3']])).toBe('a;"b;c";"diz ""oi""";\'=SOMA(1);\'-3\r\n')
    expect(nomeArquivoLeituras('2026-10-16', '2026-10-16')).toBe('leituras-2026-10-16.csv')
    expect(nomeArquivoLeituras('2026-09-17', '2026-10-16')).toBe('leituras-2026-09-17-a-2026-10-16.csv')
  })

  it('resumo: verdes, erradas, forçadas e o tempo médio', () => {
    expect(resumirMedicao([medida(), medida({ corrigido: true }), medida({ forcado: true })])).toEqual({
      total: 3,
      verdes: 3,
      verdesErradas: 1,
      amarelas: 0,
      vermelhas: 0,
      forcadas: 1,
      segundosMedio: 9,
    })
  })
})
