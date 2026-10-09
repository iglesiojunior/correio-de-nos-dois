import { describe, expect, it } from 'vitest'
import { concat, equalBytes, fromB64url, fromUtf8, toB64url, utf8 } from './bytes'

describe('bytes', () => {
  it('base64url vai e volta para todos os tamanhos', () => {
    for (let n = 0; n < 70; n++) {
      const b = crypto.getRandomValues(new Uint8Array(n))
      const s = toB64url(b)
      expect(s).not.toMatch(/[+/=]/)
      expect(equalBytes(fromB64url(s), b)).toBe(true)
    }
  })

  it('UTF-8 com acentos', () => {
    expect(utf8('não')).toHaveLength(4)
    expect(fromUtf8(utf8('saudade ♥'))).toBe('saudade ♥')
  })

  it('concat', () => {
    expect([...concat(new Uint8Array([1]), new Uint8Array([2, 3]))]).toEqual([1, 2, 3])
  })
})
