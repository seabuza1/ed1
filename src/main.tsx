import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { iniciarAtualizacao } from './data/atualizacao'
import { pedirPersistencia } from './data/persistir'
import { ProvedorAviso } from './ui/Aviso'
import { ErroGeral } from './ui/ErroGeral'
import { acompanharSistema, aplicarTema } from './ui/tema'

aplicarTema()
acompanharSistema()
pedirPersistencia()
iniciarAtualizacao()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErroGeral>
      <ProvedorAviso>
        <App />
      </ProvedorAviso>
    </ErroGeral>
  </StrictMode>,
)
