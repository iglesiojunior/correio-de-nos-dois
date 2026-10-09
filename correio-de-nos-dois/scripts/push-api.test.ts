import { describe, expect, it } from 'vitest'
import { PUBLIC_ORIGIN as APP_ORIGIN, PUSH_PUBLIC_KEY as APP_PUSH_KEY, TRIP } from '../src/config/trip'
import { opensAt } from '../src/domain'
import { PUBLIC_ORIGIN, PUSH_PUBLIC_KEY, SCHEDULE, envelopeJustOpened, envelopeOpensAt, messageFor } from '../api/push'

describe('api/push: cópia do calendário', () => {
  // se falhar: você mudou src/config/trip.ts e esqueceu de copiar para api/push.ts
  // (o teste fica fora de api/ porque a Vercel transforma todo arquivo de lá em endpoint)
  it('bate com src/config/trip.ts', () => {
    expect(SCHEDULE).toEqual({
      firstDay: TRIP.firstDay,
      envelopeCount: TRIP.envelopeCount,
      openingTime: TRIP.openingTime,
      utcOffset: TRIP.utcOffset,
    })
    expect(PUBLIC_ORIGIN).toBe(APP_ORIGIN)
    expect(PUSH_PUBLIC_KEY).toBe(APP_PUSH_KEY)
  })

  it('calcula as mesmas datas que o domínio', () => {
    for (let id = 1; id <= TRIP.envelopeCount; id++) {
      expect(envelopeOpensAt(id).toISOString()).toBe(opensAt(TRIP, id).toISOString())
    }
  })
})

describe('envelopeJustOpened', () => {
  it('acha o envelope logo depois das 08:00', () => {
    expect(envelopeJustOpened(new Date('2026-10-14T08:00:00-03:00'))).toBe(1)
    expect(envelopeJustOpened(new Date('2026-10-20T08:40:00-03:00'))).toBe(7)
    expect(envelopeJustOpened(new Date('2026-11-07T11:59:00-03:00'))).toBe(25)
  })

  it('não avisa fora da janela nem fora da viagem', () => {
    expect(envelopeJustOpened(new Date('2026-10-14T07:59:00-03:00'))).toBeNull()
    expect(envelopeJustOpened(new Date('2026-10-14T12:00:00-03:00'))).toBeNull()
    expect(envelopeJustOpened(new Date('2026-10-10T08:00:00-03:00'))).toBeNull()
    expect(envelopeJustOpened(new Date('2026-11-08T08:00:00-03:00'))).toBeNull()
  })

  it('o último envelope tem mensagem própria', () => {
    expect(messageFor(25).body).toContain('o último')
    expect(messageFor(3).body).toContain('envelope 3')
  })
})
