import { useEffect, useRef, useState } from 'react'
import { repo } from './repo'

/** Roda a consulta e repete a cada gravação no repo. undefined enquanto carrega. */
export function useConsulta<T>(consulta: () => Promise<T>, deps: unknown[]): T | undefined {
  const chave = JSON.stringify(deps)
  const [estado, setEstado] = useState<{ chave: string; valor?: T; erro?: unknown }>()
  const consultaAtual = useRef(consulta)
  useEffect(() => {
    consultaAtual.current = consulta
  })

  useEffect(() => {
    let ativo = true
    let ultima = 0
    const carregar = () => {
      const esta = ++ultima
      consultaAtual.current().then(
        (valor) => ativo && esta === ultima && setEstado({ chave, valor }),
        (erro) => ativo && setEstado({ chave, erro }),
      )
    }
    carregar()
    const parar = repo.aoMudar(carregar)
    return () => {
      ativo = false
      parar()
    }
  }, [chave])

  if (estado?.erro) throw estado.erro
  return estado?.chave === chave ? estado.valor : undefined
}
