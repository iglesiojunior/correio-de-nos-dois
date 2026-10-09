/**
 * Formato do link impresso no QR de cada envelope (v1):
 *
 *   https://<site>/abrir#v=1&e=9&k=<chave do papel em base64url>
 *
 * A chave vai no FRAGMENTO (#...): o navegador nunca envia o fragmento para servidor
 * nenhum, nem aparece em logs de hospedagem.
 *
 * ATENÇÃO: este formato é IRREVERSÍVEL depois de imprimir as etiquetas.
 */
import type { EnvelopeId } from '../domain'
import { UnsupportedFormatError } from '../domain'
import { fromB64url, toB64url } from '../shared/bytes'

export const PAPER_KEY_BYTES = 32
export const OPEN_PATH = '/abrir'

export interface EnvelopeLink {
  readonly envelopeId: EnvelopeId
  readonly paperKey: Uint8Array
}

export function buildEnvelopeLink(origin: string, link: EnvelopeLink): string {
  if (link.paperKey.length !== PAPER_KEY_BYTES) throw new Error('chave do papel deve ter 32 bytes')
  const params = new URLSearchParams({ v: '1', e: String(link.envelopeId), k: toB64url(link.paperKey) })
  return `${origin.replace(/\/$/, '')}${OPEN_PATH}#${params.toString()}`
}

/** Aceita a URL completa (vinda do QR) ou só o fragmento (location.hash). */
export function parseEnvelopeLink(input: string): EnvelopeLink {
  const hash = input.includes('#') ? input.slice(input.indexOf('#') + 1) : input
  const params = new URLSearchParams(hash)
  if (params.get('v') !== '1') throw new UnsupportedFormatError(`link v${params.get('v') ?? '?'}`)

  const envelopeId = Number(params.get('e'))
  if (!Number.isInteger(envelopeId) || envelopeId < 0) throw new UnsupportedFormatError('número do envelope')

  const k = params.get('k')
  if (!k) throw new UnsupportedFormatError('chave ausente')
  const paperKey = fromB64url(k)
  if (paperKey.length !== PAPER_KEY_BYTES) throw new UnsupportedFormatError('tamanho da chave')

  return { envelopeId, paperKey }
}
