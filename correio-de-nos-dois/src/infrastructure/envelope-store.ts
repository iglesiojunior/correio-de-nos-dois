/**
 * Guarda, no aparelho dela, a chave do papel de cada envelope já escaneado
 * e quando ela abriu. Assim ela relê qualquer carta sem precisar do papel.
 */
import type { EnvelopeId } from '../domain'
import { fromB64url, toB64url } from '../shared/bytes'

export interface EnvelopeRecord {
  readonly paperKey: Uint8Array
  readonly openedAt?: Date
}

interface Stored {
  k: string
  o?: string
}

const STORAGE_KEY = 'correio.envelopes.v1'

export class LocalEnvelopeStore {
  private read(): Record<string, Stored> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Stored>
    } catch {
      return {}
    }
  }

  private write(data: Record<string, Stored>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* armazenamento indisponível: segue sem lembrar */
    }
  }

  all(): Map<EnvelopeId, EnvelopeRecord> {
    const out = new Map<EnvelopeId, EnvelopeRecord>()
    for (const [id, s] of Object.entries(this.read())) {
      out.set(Number(id), { paperKey: fromB64url(s.k), openedAt: s.o ? new Date(s.o) : undefined })
    }
    return out
  }

  rememberKey(id: EnvelopeId, paperKey: Uint8Array): void {
    const data = this.read()
    data[id] = { ...data[id], k: toB64url(paperKey) }
    this.write(data)
  }

  markOpened(id: EnvelopeId, when: Date): void {
    const data = this.read()
    if (!data[id] || data[id].o) return
    data[id] = { ...data[id], o: when.toISOString() }
    this.write(data)
  }
}
