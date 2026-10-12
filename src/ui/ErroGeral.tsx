import { Component, type ReactNode } from 'react'

/** Mostra o erro em vez de tela branca (ex.: IndexedDB indisponível). */
export class ErroGeral extends Component<{ children: ReactNode }, { erro: unknown }> {
  state = { erro: null as unknown }
  static getDerivedStateFromError(erro: unknown) {
    return { erro }
  }
  render() {
    if (this.state.erro === null) return this.props.children
    const msg = this.state.erro instanceof Error ? this.state.erro.message : String(this.state.erro)
    return (
      <main className="app">
        <h1>Erro ao ler os dados</h1>
        <p>{msg}</p>
        <button type="button" className="primario" onClick={() => location.reload()}>
          Tentar de novo
        </button>
      </main>
    )
  }
}
