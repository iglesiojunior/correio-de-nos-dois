import { describe, expect, it } from 'vitest'
import { buildEnvelopeLink, parseEnvelopeLink } from './qr-link'
import { UnsupportedFormatError } from '../domain'

const key = Uint8Array.from({ length: 32 }, (_, i) => i * 7)

describe('link do QR', () => {
  it('vai e volta sem perder nada', () => {
    const url = buildEnvelopeLink('https://exemplo.dev/', { envelopeId: 9, paperKey: key })
    expect(url.startsWith('https://exemplo.dev/abrir#v=1&e=9&k=')).toBe(true)
    const parsed = parseEnvelopeLink(url)
    expect(parsed.envelopeId).toBe(9)
    expect([...parsed.paperKey]).toEqual([...key])
  })

  it('a chave fica só no fragmento', () => {
    const url = new URL(buildEnvelopeLink('https://exemplo.dev', { envelopeId: 1, paperKey: key }))
    expect(url.search).toBe('')
    expect(url.hash).toContain('k=')
  })

  it('aceita só o fragmento (location.hash)', () => {
    const url = buildEnvelopeLink('https://exemplo.dev', { envelopeId: 3, paperKey: key })
    expect(parseEnvelopeLink(new URL(url).hash).envelopeId).toBe(3)
  })

  it('cabe num QR pequeno', () => {
    const url = buildEnvelopeLink('https://correio-de-nos-dois.pages.dev', { envelopeId: 27, paperKey: key })
    expect(url.length).toBeLessThan(110)
  })

  it('rejeita versão ou chave inválidas', () => {
    expect(() => parseEnvelopeLink('#v=2&e=1&k=abc')).toThrow(UnsupportedFormatError)
    expect(() => parseEnvelopeLink('#v=1&e=1&k=abc')).toThrow(UnsupportedFormatError)
    expect(() => parseEnvelopeLink('#v=1&e=-1&k=abc')).toThrow(UnsupportedFormatError)
  })
})
