/** Caso de uso: lacrar uma carta para um envelope (roda só no SEU computador). */
import type { EnvelopeId, LetterContent, Trip } from '../domain'
import { DomainError, MAX_PHOTO_BYTES, opensAt } from '../domain'
import { concat, toB64url } from '../shared/bytes'
import { encodeLetter } from './letter-codec'
import type { SealedLetterWriter, SymmetricCipher, TimeLock } from './ports'
import type { SealedLetter } from './sealed-letter'

export interface SealLetterDeps {
  readonly trip: Trip
  readonly cipher: SymmetricCipher
  readonly timeLock: TimeLock
  readonly writer: SealedLetterWriter
}

export function makeSealLetter({ trip, cipher, timeLock, writer }: SealLetterDeps) {
  return async function sealLetter(
    envelopeId: EnvelopeId,
    paperKey: Uint8Array,
    content: LetterContent,
  ): Promise<SealedLetter> {
    if (content.photo && content.photo.data.length > MAX_PHOTO_BYTES) {
      throw new DomainError(`Foto maior que ${MAX_PHOTO_BYTES / 1024} KB; comprima antes`)
    }
    const when = opensAt(trip, envelopeId)

    // 1. corpo com uma chave nova, só desta carta
    const letterKey = await cipher.generateKey()
    const body = await cipher.encrypt(letterKey, encodeLetter(content))

    // 2. a chave da carta, protegida pela chave do papel
    const wrapped = await cipher.encrypt(paperKey, letterKey)

    // 3. tudo isso trancado no tempo
    const box = await timeLock.lock(concat(wrapped.iv, wrapped.data), when)

    const sealed: SealedLetter = {
      v: 1,
      envelopeId,
      round: box.round,
      lockedKey: box.ciphertext,
      iv: toB64url(body.iv),
      body: toB64url(body.data),
    }
    await writer.save(sealed)
    return sealed
  }
}
