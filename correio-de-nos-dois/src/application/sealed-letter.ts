/**
 * Formato da carta lacrada publicada em public/letters/NN.json.
 *
 * Cifragem híbrida em duas camadas:
 *   corpo:  AES-GCM(chaveDaCarta, conteúdo)            → pode ser grande (foto)
 *   chave:  AES-GCM(chaveDoPapel, chaveDaCarta)        → 32 bytes + tag
 *   tempo:  timelock(iv || chave cifrada, data)         → pequeno, como o timelock gosta
 *
 * Para ler é preciso o papel (QR) E a hora certa.
 *
 * ATENÇÃO: depois de publicar o envelope 1, nunca mude este formato sem subir `v`.
 */
import type { EnvelopeId } from '../domain'
import { UnsupportedFormatError } from '../domain'

export interface SealedLetterV1 {
  readonly v: 1
  readonly envelopeId: EnvelopeId
  /** Rodada da drand (informativo: a fechadura já carrega a rodada). */
  readonly round: number
  /** iv || AES-GCM(chaveDoPapel, chaveDaCarta), trancado no tempo. */
  readonly lockedKey: string
  /** IV do corpo, base64url. */
  readonly iv: string
  /** Corpo cifrado com a chave da carta, base64url. */
  readonly body: string
}

export type SealedLetter = SealedLetterV1

export function parseSealedLetter(json: unknown): SealedLetter {
  const o = json as Partial<SealedLetterV1> | null
  if (!o || typeof o !== 'object') throw new UnsupportedFormatError('carta não é um objeto')
  if (o.v !== 1) throw new UnsupportedFormatError(`carta v${String(o.v)}`)
  for (const k of ['lockedKey', 'iv', 'body'] as const) {
    if (typeof o[k] !== 'string') throw new UnsupportedFormatError(`campo ${k}`)
  }
  if (typeof o.envelopeId !== 'number' || typeof o.round !== 'number') {
    throw new UnsupportedFormatError('envelopeId/round')
  }
  return o as SealedLetterV1
}
