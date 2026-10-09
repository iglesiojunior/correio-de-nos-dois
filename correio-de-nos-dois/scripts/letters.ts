/**
 * Rascunhos e lacre das cartas, no disco do SEU computador.
 * Usado pelo `npm run seal` e pelo painel admin (`npm run dev` → /admin.html).
 */
import { readFile, stat, unlink, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { makeSealLetter, parseSealedLetter, type SealedLetter } from '../src/application'
import { TRIP } from '../src/config/trip'
import { envelopeIds, isValidEnvelope, opensAt, type LetterContent } from '../src/domain'
import { DrandTimeLock, WebCryptoCipher } from '../src/infrastructure'
import { letterFileName } from '../src/infrastructure/fetch-letter-reader'
import { FsLetterWriter } from './adapters/fs-letter-writer'
import { readPaperKeys } from './paper-keys'

export const DRAFTS_DIR = join(process.cwd(), 'secrets', 'cartas')
export const LETTERS_DIR = join(process.cwd(), 'public', 'letters')

export const PHOTO_TYPES = [
  { ext: 'webp', mime: 'image/webp' },
  { ext: 'jpg', mime: 'image/jpeg' },
] as const

const nn = (id: number) => String(id).padStart(2, '0')
const textPath = (id: number) => join(DRAFTS_DIR, `${nn(id)}.txt`)
const photoPath = (id: number, ext: string) => join(DRAFTS_DIR, `${nn(id)}.${ext}`)
const sealedPath = (id: number) => join(LETTERS_DIR, letterFileName(id))

export function assertEnvelope(id: number): void {
  if (!isValidEnvelope(TRIP, id)) throw new Error(`Envelope inválido: ${id}`)
}

async function mtime(path: string): Promise<number | null> {
  try {
    return (await stat(path)).mtimeMs
  } catch {
    return null
  }
}

export async function readDraftText(id: number): Promise<string | null> {
  assertEnvelope(id)
  return existsSync(textPath(id)) ? readFile(textPath(id), 'utf8') : null
}

export async function writeDraftText(id: number, text: string): Promise<void> {
  assertEnvelope(id)
  await mkdir(DRAFTS_DIR, { recursive: true })
  await writeFile(textPath(id), text, 'utf8')
}

export async function readDraftPhoto(id: number): Promise<{ mime: string; data: Uint8Array } | null> {
  assertEnvelope(id)
  for (const { ext, mime } of PHOTO_TYPES) {
    const p = photoPath(id, ext)
    if (existsSync(p)) return { mime, data: new Uint8Array(await readFile(p)) }
  }
  return null
}

/** Grava a foto e apaga a de outro formato, para nunca ter 09.webp e 09.jpg ao mesmo tempo. */
export async function writeDraftPhoto(id: number, mime: string, data: Uint8Array): Promise<void> {
  assertEnvelope(id)
  const type = PHOTO_TYPES.find((t) => t.mime === mime)
  if (!type) throw new Error(`Formato de foto não suportado: ${mime}`)
  await deleteDraftPhoto(id)
  await mkdir(DRAFTS_DIR, { recursive: true })
  await writeFile(photoPath(id, type.ext), data)
}

export async function deleteDraftPhoto(id: number): Promise<void> {
  assertEnvelope(id)
  for (const { ext } of PHOTO_TYPES) {
    if (existsSync(photoPath(id, ext))) await unlink(photoPath(id, ext))
  }
}

export interface EnvelopeStatus {
  readonly id: number
  readonly opensAt: string
  readonly hasText: boolean
  readonly photoBytes: number | null
  /** Quando o rascunho (texto ou foto) mudou por último. */
  readonly draftChangedAt: number | null
  readonly sealed: { readonly round: number; readonly at: number } | null
}

export async function envelopeStatus(id: number): Promise<EnvelopeStatus> {
  const photo = await readDraftPhoto(id)
  const draftTimes = [
    await mtime(textPath(id)),
    ...(await Promise.all(PHOTO_TYPES.map((t) => mtime(photoPath(id, t.ext))))),
  ].filter((t): t is number => t !== null)

  let sealed: EnvelopeStatus['sealed'] = null
  const sealedAt = await mtime(sealedPath(id))
  if (sealedAt !== null) {
    const letter = parseSealedLetter(JSON.parse(await readFile(sealedPath(id), 'utf8')))
    sealed = { round: letter.round, at: sealedAt }
  }

  return {
    id,
    opensAt: opensAt(TRIP, id).toISOString(),
    hasText: existsSync(textPath(id)),
    photoBytes: photo?.data.length ?? null,
    draftChangedAt: draftTimes.length ? Math.max(...draftTimes) : null,
    sealed,
  }
}

export function allEnvelopeStatus(): Promise<EnvelopeStatus[]> {
  return Promise.all(envelopeIds(TRIP).map(envelopeStatus))
}

/** Lacra o rascunho do envelope em public/letters/NN.json. Relacrar sobrescreve (chave da carta nova). */
export async function sealEnvelope(id: number): Promise<SealedLetter> {
  assertEnvelope(id)
  const text = (await readDraftText(id))?.trim()
  if (!text) throw new Error(`Sem texto em secrets/cartas/${nn(id)}.txt`)
  const photo = await readDraftPhoto(id)
  const content: LetterContent = photo ? { text, photo } : { text }

  const paperKey = (await readPaperKeys()).get(id)
  if (!paperKey) throw new Error(`Sem chave do papel para o envelope ${id}`)

  const seal = makeSealLetter({
    trip: TRIP,
    cipher: new WebCryptoCipher(),
    timeLock: new DrandTimeLock(),
    writer: new FsLetterWriter(LETTERS_DIR),
  })
  return seal(id, paperKey, content)
}
