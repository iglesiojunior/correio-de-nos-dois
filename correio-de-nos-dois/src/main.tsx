import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles.css'
import { createContainer } from './app/container'
import { App } from './ui/App'

const container = createContainer()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App container={container} />
  </StrictMode>,
)

// Só em produção: no dev o service worker cachearia arquivos e atrapalharia o recarregamento do Vite.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e: unknown) => console.warn('Service worker falhou', e))
  })
}
