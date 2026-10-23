// Integração do supabase-js com um banco de verdade (001 a 010) servido pelo PostgREST,
// sem o resto do Supabase (sem login e sem realtime). Só roda com PGRST_URL e PGRST_JWT_SECRET;
// veja supabase/teste/README.md.
import 'fake-indexeddb/auto'
import { createHmac } from 'node:crypto'
import { createServer, request, type Server } from 'node:http'
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarComanda, marcarEntregue } from '../../domain/comanda'
import { abrirNoite } from '../../domain/noite'
import { ErroRemoto, criarRemotoSupabase } from './remoto'
import { criarRepoNuvem } from './repoNuvem'

const URL_PGRST = process.env.PGRST_URL
const SEGREDO = process.env.PGRST_JWT_SECRET ?? ''
const JOAO = '00000000-0000-0000-0000-00000000000a'
const MARIA = '00000000-0000-0000-0000-00000000000b'
const LUAN = '00000000-0000-0000-0000-00000000000c'

const b64 = (x: string | Buffer) => Buffer.from(x).toString('base64url')
function jwt(sub: string) {
  const corpo = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub, role: 'authenticated', exp: 4102444800 }))}`
  return `${corpo}.${createHmac('sha256', SEGREDO).update(corpo).digest('base64url')}`
}

// O supabase-js chama <url>/rest/v1/...; o PostgREST sozinho responde na raiz.
let proxy: Server
let base = ''
const cliente = (sub: string, url = base) =>
  createClient(url, 'anon', { accessToken: async () => jwt(sub), auth: { persistSession: false } })

describe.skipIf(!URL_PGRST)('supabase-js contra o banco de verdade', () => {
  beforeAll(async () => {
    const destino = new URL(URL_PGRST!)
    proxy = createServer((req, res) => {
      const p = request(
        { host: destino.hostname, port: destino.port, method: req.method, path: req.url!.replace(/^\/rest\/v1/, ''), headers: req.headers },
        (r) => {
          res.writeHead(r.statusCode!, r.headers)
          r.pipe(res)
        },
      )
      req.pipe(p)
    })
    await new Promise<void>((ok) => proxy.listen(0, ok))
    base = `http://localhost:${(proxy.address() as { port: number }).port}`
  })
  afterAll(() => proxy?.close())

  it('lê, grava e respeita as regras de acesso', async () => {
    const joao = criarRemotoSupabase(cliente(JOAO))
    const maria = criarRemotoSupabase(cliente(MARIA))
    const luan = cliente(LUAN)

    expect((await joao.perfis()).map((p) => p.nome).sort()).toEqual(['João', 'Luan'])
    const areas = await joao.areas()
    const barra = areas.find((a) => a.nome === 'Barra do Garças')!

    const caixa = { id: crypto.randomUUID(), motoboy_id: JOAO, data: '2026-10-16', caixa_inicial: 8000, diaria: 3000, dinheiro_contado: null, fechado_em: null, obs: '' }
    await joao.inserir('caixas', caixa)
    await joao.inserir('caixas', caixa) // reenvio: não duplica nem dá erro
    expect(await joao.caixas(JOAO)).toMatchObject([{ id: caixa.id, ordem_chegada: 1 }])

    const comanda = {
      id: crypto.randomUUID(), caixa_id: caixa.id, codigo: '3557', total: 11300, area_id: barra.id, taxa: 1200,
      status: 'em_rota', pagamentos: [{ forma: 'dinheiro', valor: 11300 }], troco: 0, papel_conferido: false,
      pix_confirmado: false, finalizada_em: null, criado_em: '2026-10-16T21:00:00Z',
    }
    await joao.inserir('comandas', comanda)
    const [lida] = await joao.comandas(JOAO, null)
    expect(lida).toMatchObject({ codigo: '3557', status: 'em_rota' })
    expect(lida).not.toHaveProperty('caixas')

    await joao.atualizar('comandas', comanda.id, { status: 'entregue', finalizada_em: '2026-10-16T21:30:00Z' })
    expect(await joao.comandas(JOAO, lida.atualizado_em)).toMatchObject([{ status: 'entregue' }])
    expect(await joao.idsComandas([caixa.id])).toEqual([comanda.id])

    // Maria não vê nem mexe no do João, mas a área sugerida vem do histórico da pizzaria.
    expect(await maria.caixas(JOAO)).toEqual([])
    await expect(maria.atualizar('comandas', comanda.id, { status: 'voltou' })).rejects.toMatchObject({ permanente: true })
    expect(await maria.areaDoCodigo('3557')).toBe(barra.id)

    // Luan marca o Pix e confirma o acerto: o caixa trava para o João.
    expect((await luan.from('comandas').update({ pix_confirmado: true }).eq('id', comanda.id)).error).toBeNull()
    const acerto = { caixa_id: caixa.id, dinheiro_contado: 19300, pago_ao_motoboy: 4200, pago_do_caixa_dele: 4200, retirado_caixa_empresa: 0, vai_para_empresa: 15100 }
    expect((await luan.from('acertos').insert(acerto)).error).toBeNull()
    expect(await joao.acertos(JOAO)).toMatchObject([{ caixa_id: caixa.id, confirmado_por: LUAN }])
    expect((await joao.acertos(JOAO))[0]).not.toHaveProperty('caixas')

    for (const tentativa of [
      () => joao.atualizar('comandas', comanda.id, { status: 'voltou' }),
      () => joao.atualizar('caixas', caixa.id, { dinheiro_contado: 1 }),
      () => joao.excluir('comandas', comanda.id),
      () => joao.inserir('comandas', { ...comanda, id: crypto.randomUUID(), codigo: '9999' }),
    ])
      await expect(tentativa()).rejects.toMatchObject({ permanente: true })

    // Sem resposta do servidor: é falta de internet, não recusa.
    const fora = criarRemotoSupabase(cliente(JOAO, 'http://localhost:9'))
    const erro = await fora.areas().catch((e) => e)
    expect(erro).toBeInstanceOf(ErroRemoto)
    expect(erro.permanente).toBe(false)
  }, 20_000) // o supabase-js tenta 3 vezes antes de desistir

  it('o app inteiro: modo avião, volta a internet e tudo sobe', async () => {
    let online = true
    const repo = criarRepoNuvem({
      nome: 'integracao',
      usuarioId: MARIA,
      remoto: criarRemotoSupabase(cliente(MARIA)),
      online: () => online,
      automatico: false,
    })
    await repo.sincronizar()
    const areas = await repo.listarAreas()
    expect(areas).toHaveLength(4)

    online = false
    const r = abrirNoite({ data: '2026-10-16', caixaInicial: 8000, diaria: 3000 }, [], crypto.randomUUID())
    if (!r.ok) throw new Error(r.erro)
    await repo.salvarNoite(r.valor)
    const c = criarComanda({ codigo: '0017', total: 6000, pagamentos: [{ forma: 'pix_antecipado', valor: 6000 }], troco: 0 }, areas[0], {
      id: crypto.randomUUID(),
      noiteId: r.valor.id,
      agora: new Date().toISOString(),
    })
    if (!c.ok) throw new Error(c.erro)
    await repo.salvarComanda(c.valor)
    await repo.salvarComanda(marcarEntregue(c.valor, new Date().toISOString()))
    await repo.sincronizar()
    expect(repo.sync!.obter().pendentes).toBe(2)

    online = true
    await repo.sincronizar()
    expect(repo.sync!.obter()).toMatchObject({ pendentes: 0, recusa: null })
    const naNuvem = await cliente(MARIA).from('comandas').select('codigo, status').eq('caixa_id', r.valor.id)
    expect(naNuvem.data).toEqual([{ codigo: '0017', status: 'entregue' }])
    // O caixa recebeu a ordem de chegada (segundo da data, depois do João).
    expect((await repo.listarNoites())[0]).toMatchObject({ id: r.valor.id, data: '2026-10-16' })
    const caixa = await cliente(MARIA).from('caixas').select('ordem_chegada').eq('id', r.valor.id).single()
    expect(caixa.data).toEqual({ ordem_chegada: 2 })
  })
  it('descida pela chave: mais de 1000 comandas com a mesma hora, nenhuma falta nem repete', async () => {
    const sb = cliente(MARIA)
    const maria = criarRemotoSupabase(sb)
    const [area] = await maria.areas()
    const caixa = { id: crypto.randomUUID(), motoboy_id: MARIA, data: '2026-09-01', caixa_inicial: 8000, diaria: 3000, dinheiro_contado: null, fechado_em: null, obs: '' }
    await maria.inserir('caixas', caixa)
    // Um insert só: todas com o mesmo atualizado_em, o desempate é pelo id.
    const linhas = Array.from({ length: 1005 }, (_, i) => ({
      id: crypto.randomUUID(), caixa_id: caixa.id, codigo: String(i).padStart(4, '0'), total: 5000, area_id: area.id, taxa: area.taxa,
      status: 'entregue', pagamentos: [{ forma: 'dinheiro', valor: 5000 }], troco: 0, criado_em: '2026-09-01T21:00:00Z',
    }))
    expect((await sb.from('comandas').insert(linhas)).error?.message ?? null).toBeNull()
    const ids = (await maria.comandas(MARIA, null)).filter((c) => c.caixa_id === caixa.id).map((c) => c.id)
    expect(ids).toHaveLength(1005)
    expect(new Set(ids)).toEqual(new Set(linhas.map((l) => l.id)))
  })
})
