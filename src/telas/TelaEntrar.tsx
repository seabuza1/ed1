import { useState } from 'react'
import { cadastrar, entrar } from '../data/sessao'

/** Entrar com e-mail e senha; a conta nova vira motoboy. */
export function TelaEntrar() {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setErro(null)
    setAviso(null)
    setEnviando(true)
    try {
      if (modo === 'entrar') setErro(await entrar(email, senha))
      else {
        const r = await cadastrar(nome, email, senha)
        setErro(r.erro)
        if (r.confirmarEmail) {
          setAviso('Conta criada. Confirme pelo link que chegou no seu e-mail e depois entre.')
          setModo('entrar')
        }
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="app pilha entrar">
      <div className="boas-vindas">
        <h1>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</h1>
        <p className="discreto">
          {modo === 'entrar' ? 'Acerto dos motoboys. Depois de entrar, funciona sem internet.' : 'A conta nova entra como motoboy.'}
        </p>
      </div>
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault()
          if (!enviando) enviar()
        }}
      >
        {modo === 'cadastrar' && (
          <label className="campo">
            <span>Nome</span>
            <input autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
        )}
        <label className="campo">
          <span>E-mail</span>
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="campo">
          <span>Senha</span>
          <input
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        <button type="submit" className="primario" disabled={enviando}>
          {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
        {erro && <p className="erro">{erro}</p>}
        {aviso && <p className="aviso">{aviso}</p>}
      </form>
      <button
        type="button"
        className="link"
        onClick={() => {
          setModo(modo === 'entrar' ? 'cadastrar' : 'entrar')
          setErro(null)
        }}
      >
        {modo === 'entrar' ? 'Não tenho conta' : 'Já tenho conta'}
      </button>
    </main>
  )
}
