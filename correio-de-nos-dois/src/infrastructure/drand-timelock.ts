/**
 * Fechadura do tempo: timelock sobre a rede drand "quicknet" (uma rodada a cada 3 s).
 *
 * A drand publica, a cada rodada, uma assinatura que só passa a existir naquele instante.
 * O timelock cifra a carta "para a rodada N": antes de N ser publicada, ninguém
 * (nem você, nem o servidor) consegue decifrar. Não é um `if` no código.
 *
 * Depende de: npm i tlock-js
 */
import { Buffer, mainnetClient, roundAt, roundTime, timelockDecrypt, timelockEncrypt } from 'tlock-js'
import type { LockedBox, TimeLock } from '../application'
import { TooEarlyError } from '../domain'

type Client = ReturnType<typeof mainnetClient>
type ChainInfo = Awaited<ReturnType<ReturnType<Client['chain']>['info']>>

/** Primeira rodada publicada NO momento `ms` ou depois dele (nunca antes). */
export function roundNotBefore(ms: number, info: ChainInfo): number {
  const r = roundAt(ms, info)
  return roundTime(info, r) < ms ? r + 1 : r
}

export class DrandTimeLock implements TimeLock {
  // mainnetClient() do tlock-js aponta para a quicknet (hash 52db9ba7…)
  private readonly client: Client = mainnetClient()
  private infoPromise?: Promise<ChainInfo>

  private info(): Promise<ChainInfo> {
    return (this.infoPromise ??= this.client.chain().info())
  }

  async lock(data: Uint8Array, opensAt: Date): Promise<LockedBox> {
    const info = await this.info()
    const round = roundNotBefore(opensAt.getTime(), info)
    const ciphertext = await timelockEncrypt(round, Buffer.from(data), this.client)
    return { round, ciphertext }
  }

  async unlock(box: LockedBox): Promise<Uint8Array> {
    const info = await this.info()
    const releaseAt = new Date(roundTime(info, box.round))
    // Atalho de UX: o relógio do aparelho já diz que é cedo.
    if (roundAt(Date.now(), info) < box.round) throw new TooEarlyError(releaseAt)
    try {
      return new Uint8Array(await timelockDecrypt(box.ciphertext, this.client))
    } catch (e) {
      // relógio do aparelho adiantado: a rede ainda não publicou a rodada
      if (/too early|not yet|future/i.test(String(e))) throw new TooEarlyError(releaseAt)
      throw e
    }
  }
}
