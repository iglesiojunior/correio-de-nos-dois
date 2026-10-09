import type { EnvelopeId } from './envelope'
import { UnknownEnvelopeError } from './errors'

/**
 * Trip: a viagem dela e o calendário dos envelopes.
 *
 * Envelope 1 abre em `firstDay` às `openingTime`, o 2 no dia seguinte, e assim por diante.
 * O envelope 0 é o de teste, entregue antes da viagem, e abre em `testEnvelopeOpensAt`.
 *
 * Observação: somamos 24h por dia. Funciona porque o Brasil não tem horário de verão
 * desde 2019; se um dia voltar, troque por uma biblioteca de datas com fuso.
 */
export interface Trip {
  /** AAAA-MM-DD, dia do envelope 1. */
  readonly firstDay: string
  readonly envelopeCount: number
  /** HH:MM no fuso de `utcOffset`. */
  readonly openingTime: string
  /** Ex.: "-03:00" (Teresina). */
  readonly utcOffset: string
  /** ISO 8601 com fuso. Momento em que o envelope 0 (teste) libera. */
  readonly testEnvelopeOpensAt: string
}

const DAY_MS = 24 * 60 * 60 * 1000

export function isValidEnvelope(trip: Trip, id: EnvelopeId): boolean {
  return Number.isInteger(id) && id >= 0 && id <= trip.envelopeCount
}

export function envelopeIds(trip: Trip, { includeTest = true } = {}): EnvelopeId[] {
  const ids = Array.from({ length: trip.envelopeCount }, (_, i) => i + 1)
  return includeTest ? [0, ...ids] : ids
}

export function opensAt(trip: Trip, id: EnvelopeId): Date {
  if (!isValidEnvelope(trip, id)) throw new UnknownEnvelopeError(id)
  if (id === 0) return new Date(trip.testEnvelopeOpensAt)
  const first = new Date(`${trip.firstDay}T${trip.openingTime}:00${trip.utcOffset}`)
  return new Date(first.getTime() + (id - 1) * DAY_MS)
}

/**
 * Qual envelope é "o de hoje" num dado instante: o último que já liberou.
 * Antes do envelope 1 liberar, devolve null.
 */
export function currentEnvelope(trip: Trip, now: Date): EnvelopeId | null {
  let current: EnvelopeId | null = null
  for (const id of envelopeIds(trip, { includeTest: false })) {
    if (opensAt(trip, id).getTime() <= now.getTime()) current = id
    else break
  }
  return current
}

/** Fração da viagem já percorrida (0..1), para o pombo e a barra de progresso. */
export function tripProgress(trip: Trip, now: Date): number {
  const start = opensAt(trip, 1).getTime()
  const end = opensAt(trip, trip.envelopeCount).getTime()
  if (end === start) return now.getTime() >= end ? 1 : 0
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)))
}
