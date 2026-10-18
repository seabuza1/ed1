import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { iniciarAtualizacao } from './data/atualizacao'
import { pedirPersistencia } from './data/persistir'
import { iniciarSessao } from './data/sessao'
import { Raiz } from './Raiz'
import { ProvedorAviso } from './ui/Aviso'
import { ErroGeral } from './ui/ErroGeral'
import { acompanharSistema, aplicarTema } from './ui/tema'

aplicarTema()
acompanharSistema()
pedirPersistencia()
iniciarAtualizacao()
iniciarSessao()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErroGeral>
      <ProvedorAviso>
        <Raiz />
      </ProvedorAviso>
    </ErroGeral>
  </StrictMode>,
)
