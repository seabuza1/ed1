import { nomeArquivoBackup, type Backup } from '../domain/backup'

/** Baixa um texto como arquivo (fica na pasta de downloads). */
export function baixarTexto(conteudo: string, nome: string, tipo: string): void {
  const blob = new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Baixa o backup como arquivo .json (fica na pasta de downloads do celular). */
export function baixarBackup(backup: Backup): void {
  baixarTexto(JSON.stringify(backup, null, 2), nomeArquivoBackup(new Date(backup.exportadoEm)), 'application/json')
}
