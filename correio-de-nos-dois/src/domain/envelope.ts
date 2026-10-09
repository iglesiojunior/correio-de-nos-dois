/**
 * Envelope: o objeto físico numerado que ela leva na mala.
 *
 * Ciclo de vida:
 *   vazio ──(você lacra a carta)──▶ lacrado ──(chega a data)──▶ liberado ──(ela escaneia)──▶ aberto
 *
 * Importante: `stateOf` serve para a INTERFACE (mostrar cadeado, contagem etc.).
 * A garantia de que ninguém lê antes da hora NÃO está aqui: está na fechadura do tempo.
 */
export type EnvelopeId = number

export type EnvelopeState = 'vazio' | 'lacrado' | 'liberado' | 'aberto'

export interface Envelope {
  readonly id: EnvelopeId
  /** Momento em que a fechadura do tempo libera. */
  readonly opensAt: Date
  /** Já existe carta lacrada publicada para este envelope? */
  readonly sealed: boolean
  /** Quando ela abriu (registrado no aparelho dela). */
  readonly openedAt?: Date
}

export function stateOf(env: Envelope, now: Date): EnvelopeState {
  if (env.openedAt) return 'aberto'
  if (!env.sealed) return 'vazio'
  return now.getTime() >= env.opensAt.getTime() ? 'liberado' : 'lacrado'
}

/** Milissegundos até liberar (0 se já liberou). Útil para a contagem regressiva. */
export function timeUntilOpen(env: Envelope, now: Date): number {
  return Math.max(0, env.opensAt.getTime() - now.getTime())
}
