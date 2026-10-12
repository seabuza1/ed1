import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { pedirPersistencia } from './data/persistir'
import { ErroGeral } from './ui/ErroGeral'

pedirPersistencia()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErroGeral>
      <App />
    </ErroGeral>
  </StrictMode>,
)
