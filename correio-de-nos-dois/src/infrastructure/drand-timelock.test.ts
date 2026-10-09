/**
 * Testes de verdade contra a drand quicknet (precisam de internet).
 *   npm run test:net
 */
import { describe, expect, it } from 'vitest'
import { DrandTimeLock } from './drand-timelock'
import { TooEarlyError } from '../domain'
import { fromUtf8, utf8 } from '../shared/bytes'

describe.skipIf(import.meta.env.MODE !== 'net')('DrandTimeLock (rede)', () => {
  const lock = new DrandTimeLock()

  it('abre na hora para uma data no passado', async () => {
    const box = await lock.lock(utf8('te amo'), new Date(Date.now() - 60_000))
    expect(fromUtf8(await lock.unlock(box))).toBe('te amo')
  }, 20_000)

  it('não abre antes da hora e abre depois', async () => {
    const box = await lock.lock(utf8('daqui a pouco'), new Date(Date.now() + 9_000))
    await expect(lock.unlock(box)).rejects.toBeInstanceOf(TooEarlyError)
    await new Promise((r) => setTimeout(r, 13_000))
    expect(fromUtf8(await lock.unlock(box))).toBe('daqui a pouco')
  }, 40_000)
})
