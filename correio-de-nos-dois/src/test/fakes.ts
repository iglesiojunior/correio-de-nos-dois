/**
 * Adaptadores falsos para testar casos de uso sem rede e sem esperar o tempo passar.
 * NÃO são seguros. Só imitam o comportamento observável dos reais.
 */
import type {
  Clock,
  Encrypted,
  LockedBox,
  SealedLetter,
  SealedLetterReader,
  SealedLetterWriter,
  SymmetricCipher,
  TimeLock,
} from '../application'
import { TooEarlyError, type EnvelopeId } from '../domain'
import { concat, equalBytes, fromB64url, toB64url, utf8, fromUtf8 } from '../shared/bytes'

/** Relógio controlado pelo teste. */
export class FakeClock implements Clock {
  private current: Date
  constructor(start: Date | string) {
    this.current = new Date(start)
  }
  now(): Date {
    return new Date(this.current)
  }
  set(to: Date | string): void {
    this.current = new Date(to)
  }
}

/** "Cifra" XOR com marcador da chave: falha com chave errada, como o AES-GCM. */
export class FakeCipher implements SymmetricCipher {
  async generateKey(): Promise<Uint8Array> {
    return crypto.getRandomValues(new Uint8Array(32))
  }
  async encrypt(key: Uint8Array, plain: Uint8Array): Promise<Encrypted> {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const body = plain.map((b, i) => b ^ key[i % key.length] ^ iv[i % iv.length])
    return { iv, data: concat(key.subarray(0, 4), body) }
  }
  async decrypt(key: Uint8Array, enc: Encrypted): Promise<Uint8Array> {
    if (!equalBytes(enc.data.subarray(0, 4), key.subarray(0, 4))) throw new Error('OperationError')
    return enc.data.subarray(4).map((b, i) => b ^ key[i % key.length] ^ enc.iv[i % enc.iv.length])
  }
}

/** Fechadura do tempo que consulta o relógio falso. */
export class FakeTimeLock implements TimeLock {
  private readonly clock: Clock
  constructor(clock: Clock) {
    this.clock = clock
  }
  async lock(data: Uint8Array, opensAt: Date): Promise<LockedBox> {
    const ciphertext = toB64url(utf8(JSON.stringify({ at: opensAt.toISOString(), d: toB64url(data) })))
    return { round: Math.floor(opensAt.getTime() / 3000), ciphertext }
  }
  async unlock(box: LockedBox): Promise<Uint8Array> {
    const { at, d } = JSON.parse(fromUtf8(fromB64url(box.ciphertext))) as { at: string; d: string }
    if (this.clock.now() < new Date(at)) throw new TooEarlyError(new Date(at))
    return fromB64url(d)
  }
}

/** Repositório em memória (faz o papel do public/letters). */
export class MemoryLetters implements SealedLetterReader, SealedLetterWriter {
  readonly items = new Map<EnvelopeId, SealedLetter>()
  async find(id: EnvelopeId): Promise<SealedLetter | null> {
    return this.items.get(id) ?? null
  }
  async save(letter: SealedLetter): Promise<void> {
    this.items.set(letter.envelopeId, letter)
  }
}
