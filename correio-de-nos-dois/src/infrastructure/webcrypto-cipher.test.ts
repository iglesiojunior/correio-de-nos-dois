import { describe, expect, it } from 'vitest'
import { WebCryptoCipher } from './webcrypto-cipher'
import { utf8, fromUtf8, toB64url } from '../shared/bytes'

const cipher = new WebCryptoCipher()

describe('WebCryptoCipher', () => {
  it('generateKey devolve 32 bytes diferentes a cada chamada', async () => {
    const a = await cipher.generateKey()
    const b = await cipher.generateKey()
    expect(a).toHaveLength(32)
    expect(toB64url(a) === toB64url(b)).toBe(false)
  })

  it('encrypt usa um IV novo de 12 bytes a cada chamada', async () => {
    const key = await cipher.generateKey()
    const a = await cipher.encrypt(key, utf8('oi'))
    const b = await cipher.encrypt(key, utf8('oi'))
    expect(a.iv).toHaveLength(12)
    expect(toB64url(a.iv) === toB64url(b.iv)).toBe(false)
  })

  it('o texto cifrado tem 16 bytes a mais que o original (tag do GCM)', async () => {
    const enc = await cipher.encrypt(await cipher.generateKey(), utf8('te amo'))
    expect(enc.data).toHaveLength(6 + 16)
  })

  it('decrypt devolve o original com a mesma chave', async () => {
    const key = await cipher.generateKey()
    const enc = await cipher.encrypt(key, utf8('saudade ♥'))
    expect(fromUtf8(await cipher.decrypt(key, enc))).toBe('saudade ♥')
  })

  it('decrypt lança erro com a chave errada', async () => {
    const enc = await cipher.encrypt(await cipher.generateKey(), utf8('x'))
    await expect(cipher.decrypt(await cipher.generateKey(), enc)).rejects.toBeInstanceOf(Error)
  })

  it('decrypt lança erro se um byte do texto cifrado mudar', async () => {
    const key = await cipher.generateKey()
    const enc = await cipher.encrypt(key, utf8('x'))
    enc.data[0] ^= 1
    await expect(cipher.decrypt(key, enc)).rejects.toBeInstanceOf(Error)
  })
})
