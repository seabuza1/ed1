/** Só o texto do erro (para ler, ver foto, exportar). */
export const textoDoErro = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const mensagemDeErro = (e: unknown) => `Não foi possível salvar: ${textoDoErro(e)}`
