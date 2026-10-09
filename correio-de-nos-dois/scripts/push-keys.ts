/**
 * Gera as chaves das notificações push (uma vez só) em secrets/push.env.
 *
 *   npm run push:keys
 *
 * VAPID_PUBLIC_KEY vai em src/config/trip.ts (é pública, o navegador precisa dela).
 * VAPID_PRIVATE_KEY e CRON_SECRET vão nas variáveis de ambiente da Vercel, nunca no git.
 * Trocar as chaves depois invalida as inscrições: ela teria que ativar as notificações de novo.
 */
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import webpush from 'web-push'

const path = join(process.cwd(), 'secrets', 'push.env')
const { publicKey, privateKey } = webpush.generateVAPIDKeys()
const cronSecret = randomBytes(24).toString('base64url')

await mkdir(join(process.cwd(), 'secrets'), { recursive: true })
await writeFile(
  path,
  [
    '# Notificações push. NÃO commitar. Copie as duas últimas para Vercel → Settings → Environment Variables.',
    `VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${privateKey}`,
    `CRON_SECRET=${cronSecret}`,
    '',
  ].join('\n'),
  { flag: 'wx' }, // falha se já existir: não sobrescrever chaves em uso
)
console.log(`Chaves em ${path}`)
console.log(`Ponha em src/config/trip.ts → PUSH_PUBLIC_KEY = '${publicKey}'`)
