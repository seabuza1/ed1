import { useState } from 'react'
import { resumirNoites } from '../domain/acerto'
import { lerBackup, montarBackup, resumoBackup, type Backup } from '../domain/backup'
import { formatarData, formatarDataHora, partesData } from '../domain/datas'
import { formatarReais } from '../domain/dinheiro'
import type { Area, Noite } from '../domain/tipos'
import { baixarBackup } from '../data/arquivo'
import { agora } from '../data/id'
import { repo } from '../data/repo'
import { useConsulta } from '../data/useConsulta'
import { BotaoConfirmar } from '../ui/BotaoConfirmar'
import { mensagemDeErro } from '../ui/erro'
import { Icone } from '../ui/Icone'
import { TelaAcerto } from './TelaAcerto'

export function TelaHistorico(props: { noites: Noite[]; onAbrir: (id: string) => void }) {
  const comandas = useConsulta(() => repo.listarTodasComandas(), [])
  if (!comandas) return <p className="carregando">Carregando…</p>
  const resumo = resumirNoites(props.noites, comandas)

  return (
    <main className="app pilha">
      <h1>Histórico</h1>
      {resumo.length === 0 && (
        <div className="vazio">
          <span className="icone-grande">
            <Icone nome="historico" tamanho={28} />
          </span>
          <strong>Nenhuma noite ainda</strong>
        </div>
      )}
      {resumo.map((r) => {
        const d = partesData(r.noite.data)
        return (
          <button
            key={r.noite.id}
            type="button"
            className="item-historico"
            onClick={() => props.onAbrir(r.noite.id)}
          >
            <span className="data-bloco" aria-hidden>
              <strong>{d.dia}</strong>
              <span>{d.mes}</span>
              <span>{d.semana}</span>
            </span>
            <span className="conteudo-historico">
              <span className="linha-conta-topo">
                <strong>{formatarData(r.noite.data)}</strong>
                <span className="discreto pequeno">
                  {r.qtdComandas} {r.qtdComandas === 1 ? 'comanda' : 'comandas'}
                </span>
              </span>
              <span className="numeros-historico">
                <span>
                  Devolver <strong>{formatarReais(r.devolver)}</strong>
                </span>
                <span>
                  Receber <strong>{formatarReais(r.receber)}</strong>
                </span>
                <span>
                  Pago <strong>{r.pago === null ? '—' : formatarReais(r.pago)}</strong>
                </span>
              </span>
              <span className="selos">
                {r.noite.fechadaEm === null && <span className="selo neutro">Aberta</span>}
                <span className={`selo ${r.bateu === null ? 'neutro' : r.bateu ? 'bateu' : 'diferenca'}`}>
                  {r.selo ?? 'Sem acerto do Luan'}
                </span>
              </span>
            </span>
          </button>
        )
      })}
      <BackupDados />
    </main>
  )
}

/** Noite antiga aberta pelo histórico: acerto e comandas. */
export function NoiteDoHistorico(props: { noite: Noite; noites: Noite[]; areas: Area[]; voltar: () => void }) {
  const comandas = useConsulta(() => repo.listarComandas(props.noite.id), [props.noite.id])
  if (!comandas) return <p className="carregando">Carregando…</p>
  return <TelaAcerto noite={props.noite} noites={props.noites} comandas={comandas} areas={props.areas} voltar={props.voltar} />
}

function BackupDados() {
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendente, setPendente] = useState<Backup | null>(null)

  async function exportar() {
    try {
      const backup = montarBackup(await repo.lerTudo(), agora())
      baixarBackup(backup)
      setMsg({ ok: true, texto: `Backup exportado: ${resumoBackup(backup)}.` })
    } catch (e) {
      setMsg({ ok: false, texto: `Não foi possível exportar: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  async function escolher(arquivo: File) {
    setPendente(null)
    const r = lerBackup(await arquivo.text())
    if (!r.ok) return setMsg({ ok: false, texto: r.erro })
    setMsg(null)
    setPendente(r.valor)
  }

  async function importar(backup: Backup) {
    try {
      await repo.substituirTudo(backup)
      setPendente(null)
      setMsg({ ok: true, texto: `Backup importado: ${resumoBackup(backup)}.` })
    } catch (e) {
      setMsg({ ok: false, texto: mensagemDeErro(e) })
    }
  }

  return (
    <section className="bloco pilha-curta">
      <h2>
        <span className="icone-titulo">
          <Icone nome="baixar" tamanho={18} />
        </span>
        Backup
      </h2>
      <p className="discreto pequeno">Os dados ficam só neste celular. Exporte de vez em quando e guarde o arquivo.</p>
      <button type="button" className="secundario" onClick={exportar}>
        <Icone nome="baixar" tamanho={18} />
        Exportar backup
      </button>
      <label className="botao secundario">
        <Icone nome="subir" tamanho={18} />
        Importar backup
        <input
          type="file"
          accept=".json,application/json"
          className="so-leitor"
          onChange={(e) => {
            const arquivo = e.target.files?.[0]
            e.target.value = ''
            if (arquivo) escolher(arquivo)
          }}
        />
      </label>
      {pendente && (
        <div className="aviso pilha-curta">
          <p>
            Backup de {formatarDataHora(pendente.exportadoEm)}: {resumoBackup(pendente)}.{' '}
            Importar apaga tudo o que está no celular e põe isso no lugar.
          </p>
          <BotaoConfirmar className="perigo" confirmacao="Toque de novo para substituir tudo" onConfirmar={() => importar(pendente)}>
            Substituir tudo
          </BotaoConfirmar>
          <button type="button" className="secundario" onClick={() => setPendente(null)}>
            Cancelar
          </button>
        </div>
      )}
      {msg && <p className={msg.ok ? 'sucesso' : 'erro'}>{msg.texto}</p>}
    </section>
  )
}
