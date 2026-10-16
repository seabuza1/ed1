import Dexie from 'dexie'
import { useEffect, useState } from 'react'
import type { Dados } from '../domain/backup'
import { NOME_BANCO_LOCAL } from '../data/repo'
import { criarRepoLocal } from '../data/repoLocal'
import { useSessao } from '../data/sessao'
import { useAviso } from '../ui/desfazer'
import { mensagemDeErro } from '../ui/erro'

const chave = (usuarioId: string) => `historico-local:${usuarioId}`

function lerMarca(usuarioId: string): string | null {
  try {
    return localStorage.getItem(chave(usuarioId))
  } catch {
    return null
  }
}

function marcarEnviado(usuarioId: string) {
  try {
    localStorage.setItem(chave(usuarioId), 'enviado')
  } catch {
    // sem localStorage: o cartão volta a aparecer
  }
}

/** Primeiro login: oferece subir as noites da versão sem nuvem (o banco antigo continua no aparelho). */
export function EnviarHistorico() {
  const sessao = useSessao()
  const usuarioId = sessao.fase === 'dentro' ? sessao.usuario.id : null
  const [legado, setLegado] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const aviso = useAviso()

  useEffect(() => {
    if (!usuarioId || lerMarca(usuarioId)) return
    let ativo = true
    Dexie.exists(NOME_BANCO_LOCAL)
      .then((existe) => (existe ? criarRepoLocal(NOME_BANCO_LOCAL).lerTudo() : null))
      .then((dados) => ativo && dados && dados.noites.length > 0 && setLegado(dados))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [usuarioId])

  if (sessao.fase !== 'dentro' || !legado) return null

  async function enviar(dados: Dados) {
    if (sessao.fase !== 'dentro') return
    setEnviando(true)
    try {
      if ((await sessao.repo.listarAreas()).length === 0)
        return setErro('Ainda não baixou as áreas da nuvem. Tente de novo com internet.')
      const r = await sessao.repo.enviarHistorico(dados)
      if (!r.ok) return setErro(r.erro)
      marcarEnviado(sessao.usuario.id)
      setLegado(null)
      const { noites, comandas, puladas } = r.valor
      // No aviso rápido: a tela pode recarregar com as noites novas.
      aviso(
        `Histórico enviado: ${noites.length} ${noites.length === 1 ? 'noite' : 'noites'} e ${comandas.length} comandas.` +
          (puladas.length ? ` ${puladas.length} já estavam na nuvem.` : ''),
      )
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="bloco">
      <h2>Histórico deste celular</h2>
      <p className="discreto">
        {legado.noites.length} {legado.noites.length === 1 ? 'noite salva' : 'noites salvas'} só neste celular, da versão
        sem nuvem.
      </p>
      <button type="button" className="primario" disabled={enviando} onClick={() => enviar(legado)}>
        Enviar meu histórico para a nuvem
      </button>
      {/* "Agora não" vale até abrir o app de novo. */}
      <button type="button" className="link alinha-inicio" onClick={() => setLegado(null)}>
        Agora não
      </button>
      {erro && <p className="erro">{erro}</p>}
    </section>
  )
}
