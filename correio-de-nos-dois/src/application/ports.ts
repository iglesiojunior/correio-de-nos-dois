/**
 * Portas: o que os casos de uso precisam do mundo externo.
 * As implementações reais ficam em src/infrastructure; as falsas, em src/test.
 */
import type { EnvelopeId } from '../domain'
import type { SealedLetter } from './sealed-letter'

/** Resultado de uma cifragem simétrica. O IV não é segredo e viaja junto. */
export interface Encrypted {
  readonly iv: Uint8Array
  readonly data: Uint8Array
}

/** Cifra simétrica autenticada (na prática, AES-256-GCM). */
export interface SymmetricCipher {
  /** Gera 32 bytes aleatórios para usar como chave. */
  generateKey(): Promise<Uint8Array>
  encrypt(key: Uint8Array, plain: Uint8Array): Promise<Encrypted>
  /** Deve lançar erro se a chave estiver errada ou o conteúdo adulterado. */
  decrypt(key: Uint8Array, enc: Encrypted): Promise<Uint8Array>
}

/** Caixa trancada pela fechadura do tempo. */
export interface LockedBox {
  /** Rodada da drand que libera a caixa. */
  readonly round: number
  /** Texto cifrado (formato da biblioteca de timelock, ex.: armored age). */
  readonly ciphertext: string
}

/** Fechadura do tempo (na prática, timelock sobre a drand quicknet). */
export interface TimeLock {
  lock(data: Uint8Array, opensAt: Date): Promise<LockedBox>
  /** Deve lançar TooEarlyError antes da rodada ser publicada. */
  unlock(box: LockedBox): Promise<Uint8Array>
}

/** Onde as cartas lacradas ficam guardadas. */
export interface SealedLetterReader {
  find(id: EnvelopeId): Promise<SealedLetter | null>
}

export interface SealedLetterWriter {
  save(letter: SealedLetter): Promise<void>
}

export interface Clock {
  now(): Date
}
