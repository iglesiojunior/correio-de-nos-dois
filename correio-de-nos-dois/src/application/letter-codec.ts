/** Converte o conteúdo da carta em bytes e de volta. */
import type { LetterContent } from '../domain'
import { UnsupportedFormatError } from '../domain'
import { fromB64url, fromUtf8, toB64url, utf8 } from '../shared/bytes'

interface Wire {
  t: string
  p?: { m: string; d: string }
}

export function encodeLetter(content: LetterContent): Uint8Array {
  const wire: Wire = { t: content.text }
  if (content.photo) wire.p = { m: content.photo.mime, d: toB64url(content.photo.data) }
  return utf8(JSON.stringify(wire))
}

export function decodeLetter(bytes: Uint8Array): LetterContent {
  let wire: Wire
  try {
    wire = JSON.parse(fromUtf8(bytes)) as Wire
  } catch {
    throw new UnsupportedFormatError('conteúdo da carta')
  }
  if (typeof wire.t !== 'string') throw new UnsupportedFormatError('texto da carta')
  return wire.p
    ? { text: wire.t, photo: { mime: wire.p.m, data: fromB64url(wire.p.d) } }
    : { text: wire.t }
}
