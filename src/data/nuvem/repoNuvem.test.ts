import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { calcularAcerto } from '../../domain/acerto'
import { criarComanda, marcarEntregue, marcarPapel } from '../../domain/comanda'
import { abrirNoite } from '../../domain/noite'
import type { Area, Comanda, Noite } from '../../domain/tipos'
import { criarRepoLocal } from '../repoLocal'
import { ErroRemoto } from './remoto'
import { criarRemotoFalso } from './remotoFalso'
import { criarRepoNuvem, type RepoNuvem } from './repoNuvem'

const JOAO = '00000000-0000-0000-0000-00000000000a'
const LUAN = '00000000-0000-0000-0000-00000000000c'

let n = 0
const abertos: RepoNuvem[] = []
afterEach(() => abertos.splice(0).forEach((r) => r.parar()))

function montar(opcoes: { esperaExcluir?: number } = {}) {
  const nuvem = criarRemotoFalso()
  nuvem.perfis.set(JOAO, { id: JOAO, nome: 'João', papel: 'motoboy', ativo: true })
  nuvem.perfis.set(LUAN, { id: LUAN, nome: 'Luan', papel: 'expedicao', ativo: true })
  for (const [id, nome, taxa] of [
    ['a1', 'Aragarças', 500],
    ['a2', 'Pontal do Araguaia', 1000],
    ['a3', 'Barra do Garças', 1200],
  ] as const)
    nuvem.areas.set(id, { id, nome, taxa, ativa: true })
  let online = true
  const repo = criarRepoNuvem({
    nome: `nuvem-${++n}`,
    usuarioId: JOAO,
    remoto: nuvem.remoto,
    online: () => online && !nuvem.estado.offline,
    automatico: false,
    esperaExcluir: opcoes.esperaExcluir ?? 0,
  })
  abertos.push(repo)
  const modoAviao = (ligado: boolean) => {
    online = !ligado
    nuvem.estado.offline = ligado
  }
  return { nuvem, repo, modoAviao }
}

let seq = 0
async function lancar(repo: RepoNuvem, noite: Noite, codigo: string, total: number, areaId: string, forma: Comanda['pagamentos'][number]['forma']) {
  const area = (await repo.listarAreas()).find((a) => a.id === areaId) as Area
  const r = criarComanda({ codigo, total, pagamentos: [{ forma, valor: total }], troco: 0 }, area, {
    id: `c${++seq}`,
    noiteId: noite.id,
    agora: new Date(Date.parse('2026-10-16T20:00:00Z') + seq * 1000).toISOString(),
  })
  if (!r.ok) throw new Error(r.erro)
  await repo.salvarComanda(r.valor)
  return r.valor
}

async function abrir(repo: RepoNuvem, data = '2026-10-16') {
  const r = abrirNoite({ data, caixaInicial: 8000, diaria: 3000 }, await repo.listarNoites(), `n-${data}-${++seq}`)
  if (!r.ok) throw new Error(r.erro)
  await repo.salvarNoite(r.valor)
  return r.valor
}

describe('nuvem com fila offline', () => {
  it('em modo avião lança e marca entregas; quando a internet volta, tudo sobe', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar() // primeiro login: baixa as áreas
    modoAviao(true)

    const noite = await abrir(repo)
    const a = await lancar(repo, noite, '3557', 11300, 'a3', 'dinheiro')
    await lancar(repo, noite, '0017', 6000, 'a1', 'pix_antecipado')
    await repo.salvarComanda(marcarEntregue(a, '2026-10-16T21:30:00Z'))
    await repo.sincronizar()
    expect(repo.sync!.obter()).toMatchObject({ pendentes: 3, online: false })
    expect(nuvem.caixas.size).toBe(0)

    modoAviao(false)
    await repo.sincronizar()
    expect(repo.sync!.obter().pendentes).toBe(0)
    expect([...nuvem.caixas.values()]).toMatchObject([{ id: noite.id, motoboy_id: JOAO, data: '2026-10-16', ordem_chegada: 1 }])
    expect([...nuvem.comandas.values()].map((c) => [c.codigo, c.status, c.finalizada_em])).toEqual([
      ['3557', 'entregue', '2026-10-16T21:30:00Z'],
      ['0017', 'em_rota', null],
    ])
  })

  it('o Pix confirmado pelo Luan não some quando o motoboy marca entregue sem internet', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar()
    const noite = await abrir(repo)
    const c = await lancar(repo, noite, '0017', 6000, 'a1', 'pix_antecipado')
    await repo.sincronizar()

    modoAviao(true)
    nuvem.equipe.marcar(c.id, { pix_confirmado: true, papel_conferido: true })
    await repo.salvarComanda(marcarEntregue(c, '2026-10-16T21:40:00Z'))
    modoAviao(false)
    await repo.sincronizar()

    expect(nuvem.comandas.get(c.id)).toMatchObject({ status: 'entregue', pix_confirmado: true, papel_conferido: true })
    expect((await repo.listarComandas(noite.id))[0]).toMatchObject({ status: 'entregue', pixConfirmado: true, papelConferido: true })
  })

  it('o que ainda está na fila vale sobre o que desce da nuvem', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar()
    const noite = await abrir(repo)
    const c = await lancar(repo, noite, '2672', 9000, 'a2', 'cartao')
    await repo.sincronizar()

    // Desce a marcação do Luan enquanto a troca de total ainda não subiu.
    modoAviao(true)
    await repo.salvarComanda({ ...c, total: 9500, pagamentos: [{ forma: 'cartao', valor: 9500 }] })
    nuvem.equipe.marcar(c.id, { papel_conferido: true })
    modoAviao(false)
    await repo.sincronizar()
    expect(nuvem.comandas.get(c.id)).toMatchObject({ total: 9500, papel_conferido: true })
    expect((await repo.listarComandas(noite.id))[0]).toMatchObject({ total: 9500, papelConferido: true })
  })

  it('edição feita enquanto a mesma linha sobe não se perde', async () => {
    const { nuvem, repo } = montar()
    await repo.sincronizar()
    const noite = await abrir(repo)
    const c = await lancar(repo, noite, '2672', 9000, 'a2', 'cartao')
    // Durante o envio do inserir, o motoboy marca entregue.
    const inserir = nuvem.remoto.inserir
    let uma = true
    nuvem.remoto.inserir = async (tabela, linha) => {
      await inserir(tabela, linha)
      if (tabela === 'comandas' && uma) {
        uma = false
        await repo.salvarComanda(marcarEntregue(c, '2026-10-16T22:00:00Z'))
      }
    }
    await repo.sincronizar()
    expect(nuvem.comandas.get(c.id)?.status).toBe('entregue')
    expect(repo.sync!.obter().pendentes).toBe(0)
  })

  it('marcar e desmarcar sem internet não sobe por cima da marca do Luan', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar()
    const noite = await abrir(repo)
    const c = await lancar(repo, noite, '2672', 9000, 'a2', 'cartao')
    await repo.sincronizar()
    modoAviao(true)
    await repo.salvarComanda(marcarPapel(c, true, '2026-10-16T23:30:00Z'))
    await repo.salvarComanda(marcarPapel(c, false, '2026-10-16T23:31:00Z'))
    await repo.sincronizar()
    expect(repo.sync!.obter().pendentes).toBe(0)
    // O Luan marca no painel; quando a internet volta, a marca dele fica.
    nuvem.comandas.set(c.id, { ...nuvem.comandas.get(c.id)!, papel_conferido: true })
    modoAviao(false)
    await repo.sincronizar()
    expect(nuvem.comandas.get(c.id)?.papel_conferido).toBe(true)
  })

  it('desmarcar enquanto a marca sobe: o desmarcado chega na nuvem', async () => {
    const { nuvem, repo } = montar()
    await repo.sincronizar()
    const noite = await abrir(repo)
    const c = await lancar(repo, noite, '2672', 9000, 'a2', 'cartao')
    await repo.sincronizar()
    const atualizar = nuvem.remoto.atualizar
    let uma = true
    nuvem.remoto.atualizar = async (tabela, id, campos) => {
      await atualizar(tabela, id, campos)
      if (tabela === 'comandas' && uma) {
        uma = false
        await repo.salvarComanda(marcarPapel(c, false, '2026-10-16T23:31:00Z'))
      }
    }
    await repo.salvarComanda(marcarPapel(c, true, '2026-10-16T23:30:00Z'))
    await repo.sincronizar()
    expect(nuvem.comandas.get(c.id)?.papel_conferido).toBe(false)
    expect(repo.sync!.obter().pendentes).toBe(0)
  })

  it('depois do acerto confirmado a nuvem recusa; o app avisa e volta ao que vale', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar()
    const noite = await abrir(repo)
    const c = await lancar(repo, noite, '3557', 11300, 'a3', 'dinheiro')
    await repo.sincronizar()

    modoAviao(true)
    nuvem.equipe.confirmar(noite.id, LUAN)
    await repo.salvarComanda({ ...c, status: 'voltou' })
    await lancar(repo, noite, '9999', 5000, 'a1', 'dinheiro')
    modoAviao(false)
    await repo.sincronizar()

    expect(repo.sync!.obter().recusa).toMatch(/recusada pela nuvem: sem permissão/)
    expect((await repo.listarComandas(noite.id)).map((x) => [x.codigo, x.status])).toEqual([['3557', 'em_rota']])
    expect(await repo.obterAcerto(noite.id)).toMatchObject({ caixaId: noite.id, confirmadoPorNome: 'Luan' })
    repo.sync!.limparRecusa()
    expect(repo.sync!.obter().recusa).toBeNull()
  })

  it('realtime: o Pix confirmado e o acerto chegam sozinhos', async () => {
    const { nuvem, repo } = montar()
    await repo.sincronizar()
    const noite = await abrir(repo)
    const c = await lancar(repo, noite, '0017', 6000, 'a1', 'pix_antecipado')
    await repo.sincronizar()
    repo.iniciar()
    await repo.sincronizar()
    const chamadas = nuvem.estado.chamadas

    nuvem.equipe.marcar(c.id, { pix_confirmado: true })
    nuvem.equipe.confirmar(noite.id, LUAN)
    await new Promise((r) => setTimeout(r, 50))
    expect((await repo.listarComandas(noite.id))[0].pixConfirmado).toBe(true)
    expect(await repo.obterAcerto(noite.id)).not.toBeNull()
    expect(nuvem.estado.chamadas).toBe(chamadas) // veio pelo realtime, sem pedir

    nuvem.equipe.reabrir(noite.id)
    await new Promise((r) => setTimeout(r, 50))
    expect(await repo.obterAcerto(noite.id)).toBeNull()
  })

  it('comanda apagada pelo Luan sem o motoboy ver some na próxima sincronização', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar()
    const noite = await abrir(repo)
    const c = await lancar(repo, noite, '3557', 11300, 'a3', 'dinheiro')
    await lancar(repo, noite, '0017', 6000, 'a1', 'pix_antecipado')
    await repo.sincronizar()
    modoAviao(true)
    nuvem.equipe.apagarComanda(c.id)
    modoAviao(false)
    await repo.sincronizar()
    expect((await repo.listarComandas(noite.id)).map((x) => x.codigo)).toEqual(['0017'])
  })

  it('Desfazer da exclusão: a comanda não é apagada na nuvem e o Pix "caiu" fica', async () => {
    const { nuvem, repo } = montar({ esperaExcluir: 60_000 })
    await repo.sincronizar()
    const noite = await abrir(repo)
    const c = await lancar(repo, noite, '0017', 6000, 'a1', 'pix_antecipado')
    await repo.sincronizar()
    nuvem.comandas.set(c.id, { ...nuvem.comandas.get(c.id)!, pix_confirmado: true })
    const excluir = vi.spyOn(nuvem.remoto, 'excluir')
    await repo.excluirComanda(c.id)
    await repo.sincronizar()
    expect(nuvem.comandas.has(c.id)).toBe(true) // ainda no tempo do Desfazer
    await repo.salvarComanda(c) // Desfazer
    await repo.sincronizar()
    expect(excluir).not.toHaveBeenCalled()
    expect(nuvem.comandas.get(c.id)?.pix_confirmado).toBe(true)
    expect(repo.sync!.obter().pendentes).toBe(0)
  })

  it('lançar e excluir sem internet não deixa nada na nuvem', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar()
    const noite = await abrir(repo)
    await repo.sincronizar()
    modoAviao(true)
    const c = await lancar(repo, noite, '3557', 11300, 'a3', 'dinheiro')
    await repo.excluirComanda(c.id)
    modoAviao(false)
    await repo.sincronizar()
    expect(nuvem.comandas.size).toBe(0)
    expect(repo.sync!.obter().pendentes).toBe(0)
  })

  it('noite que já estava na nuvem com a mesma data: as comandas daqui vão para ela', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar()
    // Outro aparelho já abriu a noite; este abre a dele sem internet e lança.
    nuvem.caixas.set('outro', {
      id: 'outro', motoboy_id: JOAO, data: '2026-10-16', caixa_inicial: 8000, diaria: 3000, ordem_chegada: 1,
      dinheiro_contado: null, fechado_em: null, obs: '', criado_em: '2026-10-16T19:00:00Z', atualizado_em: '2026-10-16T19:00:00Z',
    })
    modoAviao(true)
    const noite = await abrir(repo)
    const c = await lancar(repo, noite, '3557', 11300, 'a3', 'dinheiro')
    modoAviao(false)
    await repo.sincronizar()

    expect((await repo.listarNoites()).map((n) => n.id)).toEqual(['outro'])
    expect(nuvem.comandas.get(c.id)).toMatchObject({ caixa_id: 'outro' })
    expect((await repo.listarComandas('outro')).map((x) => x.codigo)).toEqual(['3557'])
    expect(repo.sync!.obter()).toMatchObject({ pendentes: 0, recusa: expect.stringContaining('já estava na nuvem') })
  })

  it('com a sessão de outra conta no aparelho, não sincroniza e a fila fica', async () => {
    const { nuvem } = montar()
    let dono: string | null = JOAO
    const repo = criarRepoNuvem({
      nome: `nuvem-${++n}`,
      usuarioId: JOAO,
      remoto: nuvem.remoto,
      online: () => true,
      automatico: false,
      usuarioDaSessao: async () => dono,
    })
    abertos.push(repo)
    await repo.sincronizar()
    dono = LUAN // outra conta entrou numa aba do mesmo navegador
    const noite = await abrir(repo)
    await lancar(repo, noite, '3557', 11300, 'a3', 'dinheiro')
    await repo.sincronizar()
    expect(nuvem.caixas.size).toBe(0)
    expect(repo.sync!.obter()).toMatchObject({ pendentes: 2, recusa: null })
    dono = JOAO
    await repo.sincronizar()
    expect(nuvem.caixas.size).toBe(1)
    expect(repo.sync!.obter().pendentes).toBe(0)
  })

  it('a conta é a mesma depois de ir e voltar da nuvem', async () => {
    const { repo } = montar()
    await repo.sincronizar()
    const noite = await abrir(repo)
    await lancar(repo, noite, '3557', 11300, 'a3', 'dinheiro')
    await lancar(repo, noite, '2672', 9000, 'a2', 'cartao')
    const conta = async () => {
      const { papelFaltando, ...numeros } = calcularAcerto(noite, await repo.listarComandas(noite.id))
      return { ...numeros, papelFaltando: papelFaltando.map((c) => c.codigo) }
    }
    const antes = await conta()
    await repo.sincronizar()
    await repo.sincronizar()
    expect(await conta()).toEqual(antes)
  })

  it('envia o histórico da versão local, com as áreas trocadas pelas da nuvem', async () => {
    const legado = criarRepoLocal(`legado-${++n}`)
    const r = abrirNoite({ data: '2026-10-12', caixaInicial: 8000, diaria: 3000 }, [], 'noite-antiga')
    if (!r.ok) throw new Error(r.erro)
    await legado.salvarNoite({ ...r.valor, fechadaEm: '2026-10-13T03:00:00Z', luanPagou: 8600 })
    const barra = (await legado.listarAreas()).find((a) => a.nome === 'Barra')!
    const c = criarComanda({ codigo: '3557', total: 11300, pagamentos: [{ forma: 'dinheiro', valor: 11300 }], troco: 0 }, barra, {
      id: 'comanda-antiga',
      noiteId: 'noite-antiga',
      agora: '2026-10-12T21:00:00Z',
    })
    if (!c.ok) throw new Error(c.erro)
    await legado.salvarComanda(c.valor)

    const { nuvem, repo } = montar()
    await repo.sincronizar()
    const envio = await repo.enviarHistorico(await legado.lerTudo())
    expect(envio.ok).toBe(true)
    await repo.sincronizar()
    expect(nuvem.caixas.get('noite-antiga')).toMatchObject({ data: '2026-10-12', obs: expect.stringContaining('Luan pagou') })
    expect(nuvem.comandas.get('comanda-antiga')).toMatchObject({ area_id: 'a3', taxa: 1200, caixa_id: 'noite-antiga' })
  })

  it('área sugerida: primeiro o histórico do aparelho, depois o da pizzaria', async () => {
    const { nuvem, repo } = montar()
    await repo.sincronizar()
    nuvem.caixas.set('outro', { id: 'outro', motoboy_id: 'maria' } as never)
    nuvem.comandas.set('x', { id: 'x', caixa_id: 'outro', codigo: '4444', area_id: 'a2', criado_em: '2026-10-01T20:00:00Z' } as never)
    expect(await repo.sugerirArea('4444')).toBe('a2')
    const noite = await abrir(repo)
    await lancar(repo, noite, '4444', 5000, 'a1', 'dinheiro')
    expect(await repo.sugerirArea('4444')).toBe('a1')
  })
})

describe('fotos das comandas (leitura)', () => {
  const exemplo = {
    leitura: {
      telefone_final: '3557',
      promocao: false,
      local_escrito: 'Arag.',
      itens: [
        { lido: 'refri 2l', tipo: 'bebida' as const, quantidade: 1, tamanho: null, sabores: [], item: 'Refrigerante 2L', casou_pelo_cardapio: true, opcoes: [] },
      ],
      pagamento: [{ forma_escrita: 'din', forma: 'dinheiro' as const, valor_escrito: null }],
      total_escrito: '20,00',
      transcricao: [],
      ilegiveis: [],
    },
    conferencia: { telefone_digitos: ['3', '5', '5', '7'], total_digitos: ['2', '0'], forma_escrita: 'din', local_escrito: 'Arag.', promocao: false },
    modelo: 'teste',
    ms: 10,
  }
  const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 1, 2, 3])], { type: 'image/jpeg' })

  async function comFoto(repo: RepoNuvem, noite: Noite, pendente: boolean, total = 2000) {
    const area = (await repo.listarAreas()).find((a) => a.id === 'a1') as Area
    const id = `f${++seq}`
    const r = criarComanda({ codigo: '3557', total, pagamentos: [{ forma: 'dinheiro', valor: total }], troco: 0 }, area, {
      id,
      noiteId: noite.id,
      agora: '2026-10-16T21:00:00.000Z',
    })
    if (!r.ok) throw new Error(r.erro)
    const c = { ...r.valor, fotoPath: `${noite.id}/${id}.jpg`, areaOrigem: 'escrito' as const }
    await repo.fotos!.lancar(c, jpeg(), { pendente })
    return c
  }

  it('a foto sobe ao Storage depois da comanda, numa fila própria', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar()
    modoAviao(true)
    const noite = await abrir(repo)
    const c = await comFoto(repo, noite, false)
    await repo.sincronizar()
    expect(repo.sync!.obter()).toMatchObject({ pendentes: 2 })
    expect(nuvem.fotos.has(c.fotoPath)).toBe(false)

    modoAviao(false)
    await repo.sincronizar()
    expect(nuvem.comandas.get(c.id)).toMatchObject({ foto_path: c.fotoPath, area_origem: 'escrito' })
    expect(nuvem.fotos.has(c.fotoPath)).toBe(true)
    expect(repo.sync!.obter()).toMatchObject({ pendentes: 0 })
    // A foto continua no aparelho por um tempo: vê sem precisar da nuvem.
    expect(await repo.fotos!.url(c)).toMatch(/^blob:/)
  })

  it('R28: tirada sem internet, é lida quando a internet volta; só registra, não muda a comanda', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar()
    modoAviao(true)
    const noite = await abrir(repo)
    const c = await comFoto(repo, noite, true, 2500) // lançou 25 à mão; a comanda diz 20
    nuvem.estado.ia = { ...exemplo, provedor: 'google', tokens: { entrada: 1200, cache: 5000, saida: 900 } }
    await repo.sincronizar()
    expect(nuvem.estado.leiturasIA).toBe(0)

    modoAviao(false)
    await repo.sincronizar()
    await repo.lerFotos()
    await repo.sincronizar() // sobe a leitura
    expect(nuvem.estado.leiturasIA).toBe(1)
    const [registro] = await repo.fotos!.leituras(noite.id)
    expect(registro).toMatchObject({ comandaId: c.id, resultado: { posterior: true }, lancado: { total: 2500 } })
    expect(nuvem.leituras.get(registro.id)).toMatchObject({
      comanda_id: c.id,
      caixa_id: noite.id,
      provedor: 'google',
      tokens_entrada: 1200,
      tokens_cache: 5000,
      tokens_saida: 900,
    })
    expect((await repo.listarComandas(noite.id))[0].total).toBe(2500)

    await repo.sincronizar()
    await repo.lerFotos()
    expect(nuvem.estado.leiturasIA).toBe(1) // não lê de novo
  })

  it('IA fora do ar não segura a fila: a comanda e a foto sobem, a leitura espera e volta depois', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const { nuvem, repo, modoAviao } = montar()
      await repo.sincronizar()
      modoAviao(true) // fotos da R28: tiradas sem internet
      const noite = await abrir(repo)
      const c = await comFoto(repo, noite, true)
      await comFoto(repo, noite, true)
      modoAviao(false)
      nuvem.estado.ia = { erro: 'IA fora do ar', fora: true }
      await repo.sincronizar()
      await repo.lerFotos()
      expect(nuvem.comandas.has(c.id)).toBe(true)
      expect(nuvem.fotos.has(c.fotoPath)).toBe(true)
      expect(nuvem.estado.leiturasIA).toBe(2) // uma foto adiada não para a outra
      await repo.lerFotos()
      expect(nuvem.estado.leiturasIA).toBe(2) // espera antes de tentar de novo

      vi.setSystemTime(Date.now() + 3 * 60_000)
      nuvem.estado.ia = exemplo
      await repo.lerFotos()
      await repo.sincronizar()
      expect(nuvem.leituras.size).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('sem resposta com internet (demorou, a conexão caiu): a foto espera, sem reenviar a cada sincronização', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar()
    modoAviao(true)
    const noite = await abrir(repo)
    await comFoto(repo, noite, true)
    modoAviao(false)
    let chamadas = 0
    nuvem.remoto.lerComanda = async () => {
      chamadas++
      throw new ErroRemoto('Failed to fetch', false)
    }
    await repo.sincronizar()
    await repo.lerFotos()
    await repo.sincronizar()
    await repo.lerFotos()
    expect(chamadas).toBe(1)
  })

  it('leitura ao vivo que não veio: a fila espera 2 min antes de mandar a foto de novo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const { nuvem, repo } = montar()
      await repo.sincronizar()
      await comFoto(repo, await abrir(repo), true) // com internet: a IA não respondeu na hora
      nuvem.estado.ia = exemplo
      await repo.sincronizar()
      await repo.lerFotos()
      expect(nuvem.estado.leiturasIA).toBe(0)
      vi.setSystemTime(Date.now() + 3 * 60_000)
      await repo.lerFotos()
      expect(nuvem.estado.leiturasIA).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('caixa com acerto confirmado: a foto adiada não vai mais para a IA (a nuvem recusaria a leitura)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const { nuvem, repo, modoAviao } = montar()
      await repo.sincronizar()
      modoAviao(true)
      const noite = await abrir(repo)
      await comFoto(repo, noite, true)
      modoAviao(false)
      nuvem.estado.ia = { erro: 'IA fora do ar', fora: true }
      await repo.sincronizar()
      await repo.lerFotos() // adiada
      expect(nuvem.estado.leiturasIA).toBe(1)

      nuvem.equipe.confirmar(noite.id, LUAN)
      nuvem.estado.ia = exemplo
      await repo.sincronizar()
      vi.setSystemTime(Date.now() + 3 * 60_000)
      await repo.lerFotos()
      expect(nuvem.estado.leiturasIA).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('IA fora do ar por horas: a foto desiste depois de 8 adiamentos', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const { nuvem, repo } = montar()
      await repo.sincronizar()
      await comFoto(repo, await abrir(repo), true)
      nuvem.estado.ia = { erro: 'IA fora do ar', fora: true }
      for (let i = 0; i < 10; i++) {
        await repo.lerFotos()
        vi.setSystemTime(Date.now() + 61 * 60_000)
      }
      expect(nuvem.estado.leiturasIA).toBe(8)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a IA não leu: tenta 3 vezes e desiste; leitura de comanda excluída não sobe', async () => {
    const { nuvem, repo, modoAviao } = montar()
    await repo.sincronizar()
    modoAviao(true)
    const noite = await abrir(repo)
    await comFoto(repo, noite, true)
    modoAviao(false)
    nuvem.estado.ia = { erro: 'ilegível' }
    for (let i = 0; i < 5; i++) {
      await repo.sincronizar()
      await repo.lerFotos()
    }
    expect(nuvem.estado.leiturasIA).toBe(3)

    modoAviao(true)
    const outra = await comFoto(repo, noite, true)
    modoAviao(false)
    nuvem.estado.ia = exemplo
    await repo.excluirComanda(outra.id)
    await repo.sincronizar()
    await repo.lerFotos()
    await repo.sincronizar()
    expect(nuvem.leituras.size).toBe(0)
    expect(nuvem.fotos.has(outra.fotoPath)).toBe(false)
  })
})
