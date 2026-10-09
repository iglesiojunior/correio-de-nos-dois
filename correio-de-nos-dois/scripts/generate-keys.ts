/**
 * Gera UMA chave do papel por envelope (0 = teste, 1..N) e grava:
 *   secrets/paper-keys.json     chaves (base64url)
 *   secrets/labels-config.json  o que vai em cada etiqueta (link do QR, número, data)
 * Roda uma vez só, antes de imprimir. Recusa sobrescrever as chaves.
 *
 *   npm run keys            (depois: python scripts/make-labels.py)
 */
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { TRIP, PUBLIC_ORIGIN } from '../src/config/trip'
import { envelopeIds, opensAt } from '../src/domain'
import { PAPER_KEY_BYTES, buildEnvelopeLink } from '../src/infrastructure/qr-link'
import { KEYS_PATH, readPaperKeys, writePaperKeys } from './paper-keys'

const keys = new Map<number, Uint8Array>()
for (const id of envelopeIds(TRIP)) keys.set(id, crypto.getRandomValues(new Uint8Array(PAPER_KEY_BYTES)))

try {
  await writePaperKeys(keys)
  console.log(`${keys.size} chaves gravadas em ${KEYS_PATH}`)
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
  console.log(`Já existe ${KEYS_PATH}: mantendo as chaves e só regenerando as etiquetas.`)
}

const saved = await readPaperKeys()
const fmt = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Fortaleza' })
const weekday = (d: Date) => {
  const w = d.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Fortaleza' }).replace('-feira', '')
  return w === 'sábado' || w === 'domingo' ? `no ${w}` : `na ${w}`
}

const labels = envelopeIds(TRIP).map((id) => {
  const paperKey = saved.get(id)
  if (!paperKey) throw new Error(`falta a chave do envelope ${id}`)
  const when = opensAt(TRIP, id)
  return {
    id,
    url: buildEnvelopeLink(PUBLIC_ORIGIN, { envelopeId: id, paperKey }),
    hint: id === 0 ? 'para testar' : `abrir ${weekday(when)}`,
    when: id === 0 ? 'abra já' : fmt(when),
  }
})
await writeFile(join(process.cwd(), 'secrets', 'labels-config.json'), JSON.stringify({ labels }, null, 2) + '\n')
console.log(`${labels.length} etiquetas descritas em secrets/labels-config.json`)
