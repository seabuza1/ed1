import { useEffect, useState } from 'react'
import { textoDoErro } from './erro'
import { Icone } from './Icone'

/**
 * Foto da comanda em tela cheia. `carregar` devolve o endereço (blob: do aparelho ou link
 * temporário da nuvem); o blob: é revogado ao fechar. Tocar na foto alterna o zoom.
 */
export function VerFoto(props: { titulo: string; carregar: () => Promise<string>; fechar: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [zoom, setZoom] = useState(false)
  const { carregar } = props

  useEffect(() => {
    let ativo = true
    let criada: string | null = null
    carregar().then(
      (u) => {
        criada = u
        if (ativo) setUrl(u)
        else if (u.startsWith('blob:')) URL.revokeObjectURL(u)
      },
      (e) => ativo && setErro(textoDoErro(e)),
    )
    return () => {
      ativo = false
      if (criada?.startsWith('blob:')) URL.revokeObjectURL(criada)
    }
  }, [carregar])

  return (
    <div className="ver-foto" role="dialog" aria-modal="true" aria-label={`Foto da ${props.titulo}`}>
      <div className="ver-foto-topo">
        <strong className="codigo">{props.titulo}</strong>
        {url && !url.startsWith('blob:') && (
          <a className="link" href={url} target="_blank" rel="noreferrer">
            Abrir
          </a>
        )}
        <button type="button" className="secundario so-icone" aria-label="Fechar" onClick={props.fechar}>
          <Icone nome="fechar" tamanho={20} />
        </button>
      </div>
      <div className={`ver-foto-corpo ${zoom ? 'ampliada' : ''}`}>
        {erro ? (
          <p className="erro">{erro}</p>
        ) : url ? (
          <img src={url} alt={`Comanda ${props.titulo}`} onClick={() => setZoom(!zoom)} />
        ) : (
          <p className="carregando">Carregando foto…</p>
        )}
      </div>
    </div>
  )
}
