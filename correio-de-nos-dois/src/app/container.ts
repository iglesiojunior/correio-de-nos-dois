/**
 * Composition root: o ÚNICO lugar que conhece as implementações concretas.
 * Para testar, troque os adaptadores por fakes (veja src/test/fakes.ts).
 */
import { makeOpenEnvelope } from '../application'
import { SIGNATURE, TRIP, WHATSAPP_NUMBER } from '../config/trip'
import { DrandTimeLock, FetchLetterReader, LocalEnvelopeStore, WebCryptoCipher, systemClock } from '../infrastructure'

export function createContainer() {
  const cipher = new WebCryptoCipher()
  const timeLock = new DrandTimeLock()
  const reader = new FetchLetterReader(`${import.meta.env.BASE_URL}letters/`)

  return {
    trip: TRIP,
    signature: SIGNATURE,
    whatsapp: WHATSAPP_NUMBER,
    clock: systemClock,
    store: new LocalEnvelopeStore(),
    openEnvelope: makeOpenEnvelope({ trip: TRIP, cipher, timeLock, reader, clock: systemClock }),
  }
}

export type Container = ReturnType<typeof createContainer>
