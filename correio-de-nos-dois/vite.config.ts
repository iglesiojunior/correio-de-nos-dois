import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Painel admin para escrever e lacrar cartas: http://localhost:5173/admin.html
 * `apply: 'serve'` = só no `npm run dev`. O build e a Vercel não têm a API nem o admin.html.
 */
function adminPanel(): Plugin {
  return {
    name: 'correio-admin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__admin', (req, res) => {
        // ssrLoadModule: o Vite transpila o TS dos scripts (e recarrega quando você edita).
        // Caminho em variável para o tsc do vite.config não seguir os imports dos scripts.
        const api = '/scripts/admin/api.ts'
        server
          .ssrLoadModule(api)
          .then((m) => (m.handleAdmin as (q: IncomingMessage, s: ServerResponse) => Promise<void>)(req, res))
          .catch((e: unknown) => {
            res.statusCode = 500
            res.end(String(e))
          })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), adminPanel()],
  build: {
    // admin.html fica de fora de propósito: só index.html vai para produção
    rolldownOptions: { input: 'index.html' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
