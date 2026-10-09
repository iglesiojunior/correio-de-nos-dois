/** Caso de uso: abrir um envelope escaneado (roda no celular DELA). */
import type { EnvelopeId, LetterContent, Trip } from '../domain'
import {
  EmptyEnvelopeError,
  TooEarlyError,
  UnknownEnvelopeError,
  WrongPaperKeyError,
  isValidEnvelope,
  opensAt,
} from '../domain'
import { fromB64url } from '../shared/bytes'
import { decodeLetter } from './letter-codec'
import type { Clock, SealedLetterReader, SymmetricCipher, TimeLock } from './ports'

/** Tamanho do IV do AES-GCM. Precisa bater com o adaptador de cifra. */
export const IV_BYTES = 12

export interface OpenEnvelopeDeps {
  readonly trip: Trip
  readonly cipher: SymmetricCipher
  readonly timeLock: TimeLock
  readonly reader: SealedLetterReader
  readonly clock: Clock
}

export function makeOpenEnvelope({ trip, cipher, timeLock, reader, clock }: OpenEnvelopeDeps) {
  return async function openEnvelope(
    envelopeId: EnvelopeId,
    paperKey: Uint8Array,
  ): Promise<LetterContent> {
    if (!isValidEnvelope(trip, envelopeId)) throw new UnknownEnvelopeError(envelopeId)

    // Atalho de UX: evita ir à rede só para descobrir que é cedo.
    // Não é segurança: quem garante é a fechadura do tempo logo abaixo.
    const when = opensAt(trip, envelopeId)
    if (clock.now() < when) throw new TooEarlyError(when)

    const sealed = await reader.find(envelopeId)
    if (!sealed) throw new EmptyEnvelopeError(envelopeId)

    // camada 1: o tempo
    const wrapped = await timeLock.unlock({ round: sealed.round, ciphertext: sealed.lockedKey })

    // camada 2: o papel
    let letterKey: Uint8Array
    try {
      letterKey = await cipher.decrypt(paperKey, {
        iv: wrapped.subarray(0, IV_BYTES),
        data: wrapped.subarray(IV_BYTES),
      })
    } catch {
      throw new WrongPaperKeyError()
    }

    // o corpo
    const plain = await cipher.decrypt(letterKey, {
      iv: fromB64url(sealed.iv),
      data: fromB64url(sealed.body),
    })
    return decodeLetter(plain)
  }
}
