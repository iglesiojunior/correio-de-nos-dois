import { beforeEach, describe, expect, it } from 'vitest'
import { makeOpenEnvelope, makeSealLetter } from '.'
import { EmptyEnvelopeError, TooEarlyError, UnknownEnvelopeError, WrongPaperKeyError, type Trip } from '../domain'
import { FakeCipher, FakeClock, FakeTimeLock, MemoryLetters } from '../test/fakes'

const trip: Trip = {
  firstDay: '2026-10-14',
  envelopeCount: 27,
  openingTime: '08:00',
  utcOffset: '-03:00',
  testEnvelopeOpensAt: '2026-10-12T17:00:00-03:00',
}

describe('lacrar e abrir', () => {
  let clock: FakeClock
  let letters: MemoryLetters
  let seal: ReturnType<typeof makeSealLetter>
  let open: ReturnType<typeof makeOpenEnvelope>
  const paperKey = crypto.getRandomValues(new Uint8Array(32))

  beforeEach(() => {
    clock = new FakeClock('2026-10-10T12:00:00-03:00')
    letters = new MemoryLetters()
    const cipher = new FakeCipher()
    const timeLock = new FakeTimeLock(clock)
    seal = makeSealLetter({ trip, cipher, timeLock, writer: letters })
    open = makeOpenEnvelope({ trip, cipher, timeLock, reader: letters, clock })
  })

  it('abre no dia certo com o papel certo', async () => {
    await seal(9, paperKey, { text: 'Choveu em Teresina.' })
    clock.set('2026-10-22T08:00:00-03:00')
    expect(await open(9, paperKey)).toEqual({ text: 'Choveu em Teresina.' })
  })

  it('guarda a foto junto', async () => {
    const photo = { mime: 'image/webp', data: new Uint8Array([1, 2, 3, 250]) }
    await seal(1, paperKey, { text: 'oi', photo })
    clock.set('2026-10-14T09:00:00-03:00')
    const opened = await open(1, paperKey)
    expect(opened.photo?.mime).toBe('image/webp')
    expect([...opened.photo!.data]).toEqual([1, 2, 3, 250])
  })

  it('guarda a figura de AR (pixel art e cartão) junto, cifrada', async () => {
    const rgba = new Uint8Array(2 * 1 * 4).fill(255)
    await seal(2, paperKey, { text: 'oi', ar: { kind: 'voxels', width: 2, height: 1, rgba } })
    await seal(3, paperKey, { text: 'oi', ar: { kind: 'card', mime: 'image/webp', data: new Uint8Array([7, 8]) } })
    clock.set('2026-10-16T09:00:00-03:00')
    const voxels = (await open(2, paperKey)).ar
    expect(voxels?.kind === 'voxels' && [voxels.width, voxels.height, voxels.rgba.length]).toEqual([2, 1, 8])
    const card = (await open(3, paperKey)).ar
    expect(card?.kind === 'card' && [...card.data]).toEqual([7, 8])
  })

  it('recusa pixel art grande demais ou toda transparente', async () => {
    const big = { kind: 'voxels' as const, width: 33, height: 1, rgba: new Uint8Array(33 * 4).fill(255) }
    await expect(seal(2, paperKey, { text: 'oi', ar: big })).rejects.toThrow(/32x32/)
    const empty = { kind: 'voxels' as const, width: 2, height: 2, rgba: new Uint8Array(16) }
    await expect(seal(2, paperKey, { text: 'oi', ar: empty })).rejects.toThrow(/transparente/)
  })

  it('não abre antes da hora', async () => {
    await seal(9, paperKey, { text: 'x' })
    clock.set('2026-10-22T07:59:59-03:00')
    await expect(open(9, paperKey)).rejects.toBeInstanceOf(TooEarlyError)
  })

  it('não abre com o papel de outro envelope', async () => {
    await seal(9, paperKey, { text: 'x' })
    clock.set('2026-10-23T08:00:00-03:00')
    const outroPapel = crypto.getRandomValues(new Uint8Array(32))
    await expect(open(9, outroPapel)).rejects.toBeInstanceOf(WrongPaperKeyError)
  })

  it('avisa quando a carta ainda não foi lacrada', async () => {
    clock.set('2026-10-23T08:00:00-03:00')
    await expect(open(10, paperKey)).rejects.toBeInstanceOf(EmptyEnvelopeError)
  })

  it('rejeita número fora da viagem', async () => {
    await expect(open(99, paperKey)).rejects.toBeInstanceOf(UnknownEnvelopeError)
  })

  it('o JSON publicado não contém o texto', async () => {
    const sealed = await seal(9, paperKey, { text: 'segredo' })
    expect(JSON.stringify(sealed)).not.toContain('segredo')
  })
})
