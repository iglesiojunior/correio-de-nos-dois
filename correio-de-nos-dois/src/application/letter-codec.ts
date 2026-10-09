/** Converte o conteúdo da carta em bytes e de volta. */
import type { ArFigure, LetterContent } from '../domain'
import { UnsupportedFormatError, arFigureProblem } from '../domain'
import { fromB64url, fromUtf8, toB64url, utf8 } from '../shared/bytes'

/**
 * JSON curto dentro do corpo cifrado. Campos novos são opcionais, então cartas lacradas antes
 * deles continuam abrindo (a carta 0 não tem `a` e mostra o coração padrão).
 */
interface Wire {
  t: string
  p?: { m: string; d: string }
  /** figura de AR: voxels (k=v, largura, altura, RGBA) ou cartão (k=c, mime, bytes) */
  a?: { k: 'v'; w: number; h: number; d: string } | { k: 'c'; m: string; d: string }
}

function encodeAr(fig: ArFigure): NonNullable<Wire['a']> {
  return fig.kind === 'voxels'
    ? { k: 'v', w: fig.width, h: fig.height, d: toB64url(fig.rgba) }
    : { k: 'c', m: fig.mime, d: toB64url(fig.data) }
}

function decodeAr(a: NonNullable<Wire['a']>): ArFigure {
  const fig: ArFigure =
    a.k === 'v'
      ? { kind: 'voxels', width: a.w, height: a.h, rgba: fromB64url(a.d) }
      : { kind: 'card', mime: a.m, data: fromB64url(a.d) }
  const problem = arFigureProblem(fig)
  if (problem) throw new UnsupportedFormatError(problem)
  return fig
}

export function encodeLetter(content: LetterContent): Uint8Array {
  const wire: Wire = { t: content.text }
  if (content.photo) wire.p = { m: content.photo.mime, d: toB64url(content.photo.data) }
  if (content.ar) wire.a = encodeAr(content.ar)
  return utf8(JSON.stringify(wire))
}

export function decodeLetter(bytes: Uint8Array): LetterContent {
  let wire: Wire
  try {
    wire = JSON.parse(fromUtf8(bytes)) as Wire
  } catch {
    throw new UnsupportedFormatError('conteúdo da carta')
  }
  if (typeof wire.t !== 'string') throw new UnsupportedFormatError('texto da carta')
  return {
    text: wire.t,
    ...(wire.p && { photo: { mime: wire.p.m, data: fromB64url(wire.p.d) } }),
    ...(wire.a && { ar: decodeAr(wire.a) }),
  }
}
