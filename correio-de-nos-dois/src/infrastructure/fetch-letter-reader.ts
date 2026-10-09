/** Lê as cartas lacradas publicadas como arquivos estáticos (public/letters/NN.json). */
import type { SealedLetterReader } from '../application'
import { parseSealedLetter, type SealedLetter } from '../application'
import type { EnvelopeId } from '../domain'

export function letterFileName(id: EnvelopeId): string {
  return `${String(id).padStart(2, '0')}.json`
}

export class FetchLetterReader implements SealedLetterReader {
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch

  constructor(baseUrl = '/letters/', fetchFn: typeof fetch = (...a) => fetch(...a)) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    this.fetchFn = fetchFn
  }

  async find(id: EnvelopeId): Promise<SealedLetter | null> {
    const res = await this.fetchFn(`${this.baseUrl}${letterFileName(id)}`, { cache: 'no-cache' })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Falha ao buscar a carta ${id}: HTTP ${res.status}`)
    return parseSealedLetter(await res.json())
  }
}
