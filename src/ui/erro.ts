export const mensagemDeErro = (e: unknown) =>
  `Não foi possível salvar: ${e instanceof Error ? e.message : String(e)}`
