import { describe, expect, it } from 'vitest'
import { currentEnvelope, envelopeIds, opensAt, tripProgress, type Trip } from './trip'
import { UnknownEnvelopeError } from './errors'

const trip: Trip = {
  firstDay: '2026-10-14',
  envelopeCount: 27,
  openingTime: '08:00',
  utcOffset: '-03:00',
  testEnvelopeOpensAt: '2026-10-12T17:00:00-03:00',
}

describe('Trip', () => {
  it('envelope 1 abre no primeiro dia às 08:00 de Teresina', () => {
    expect(opensAt(trip, 1).toISOString()).toBe('2026-10-14T11:00:00.000Z')
  })

  it('envelope 27 abre 26 dias depois', () => {
    expect(opensAt(trip, 27).toISOString()).toBe('2026-11-09T11:00:00.000Z')
  })

  it('envelope 0 é o de teste', () => {
    expect(opensAt(trip, 0).toISOString()).toBe('2026-10-12T20:00:00.000Z')
  })

  it('rejeita envelopes fora da viagem', () => {
    expect(() => opensAt(trip, 28)).toThrow(UnknownEnvelopeError)
    expect(() => opensAt(trip, 1.5)).toThrow(UnknownEnvelopeError)
  })

  it('lista 0..27 com o de teste e 1..27 sem', () => {
    expect(envelopeIds(trip)).toHaveLength(28)
    expect(envelopeIds(trip, { includeTest: false })[0]).toBe(1)
  })

  it('o envelope de hoje troca às 08:00', () => {
    expect(currentEnvelope(trip, new Date('2026-10-22T07:59:00-03:00'))).toBe(8)
    expect(currentEnvelope(trip, new Date('2026-10-22T08:00:00-03:00'))).toBe(9)
    expect(currentEnvelope(trip, new Date('2026-10-13T12:00:00-03:00'))).toBeNull()
  })

  it('progresso vai de 0 a 1', () => {
    expect(tripProgress(trip, new Date('2026-10-01'))).toBe(0)
    expect(tripProgress(trip, new Date('2026-12-01'))).toBe(1)
    expect(tripProgress(trip, opensAt(trip, 14))).toBeCloseTo(0.5, 5)
  })
})
