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
