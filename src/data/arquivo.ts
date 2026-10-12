import { nomeArquivoBackup, type Backup } from '../domain/backup'

/** Baixa o backup como arquivo .json (fica na pasta de downloads do celular). */
export function baixarBackup(backup: Backup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivoBackup(new Date(backup.exportadoEm))
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
