import { describe, expect, it } from 'vitest'
import { stateOf, timeUntilOpen, type Envelope } from './envelope'

const base: Envelope = { id: 9, opensAt: new Date('2026-10-22T11:00:00Z'), sealed: true }
const before = new Date('2026-10-22T10:00:00Z')
const after = new Date('2026-10-22T12:00:00Z')

describe('Envelope', () => {
  it('segue o ciclo vazio → lacrado → liberado → aberto', () => {
    expect(stateOf({ ...base, sealed: false }, after)).toBe('vazio')
    expect(stateOf(base, before)).toBe('lacrado')
    expect(stateOf(base, after)).toBe('liberado')
    expect(stateOf({ ...base, openedAt: after }, after)).toBe('aberto')
  })

  it('calcula quanto falta para abrir', () => {
    expect(timeUntilOpen(base, before)).toBe(60 * 60 * 1000)
    expect(timeUntilOpen(base, after)).toBe(0)
  })
})
