import { describe, expect, it } from 'vitest'
import { opensAt } from '../domain'
import { PUBLIC_ORIGIN, TRIP } from './trip'

describe('calendário real', () => {
  it('vai de 14/10 a 07/11', () => {
    expect(opensAt(TRIP, 1).toISOString()).toBe('2026-10-14T11:00:00.000Z')
    expect(opensAt(TRIP, TRIP.envelopeCount).toISOString()).toBe('2026-11-07T11:00:00.000Z')
  })
  it('o envelope de teste já vem aberto (antecipado para testar antes da entrega)', () => {
    expect(opensAt(TRIP, 0).toISOString()).toBe('2026-10-09T03:00:00.000Z')
  })
  it('o endereço do QR é https sem barra no fim', () => {
    expect(PUBLIC_ORIGIN).toMatch(/^https:\/\/[^/]+$/)
  })
})
