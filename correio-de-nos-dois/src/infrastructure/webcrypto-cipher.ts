/**
 * Cifra simétrica com a Web Crypto API: AES-256-GCM.
 * Funciona igual no navegador e no Node 20+ (globalThis.crypto.subtle).
 *
 * - A chave são 32 bytes crus (é o que vai no QR).
 * - Cada cifragem usa um IV novo de 12 bytes; nunca repetir IV com a mesma chave.
 * - O GCM acrescenta 16 bytes de tag: se a chave estiver errada ou alguém mexer
 *   num byte, decrypt lança erro em vez de devolver lixo.
 */
import type { Encrypted, SymmetricCipher } from '../application'

const KEY_BYTES = 32
const IV_BYTES = 12

/** O TS do DOM exige ArrayBuffer "puro"; esta cópia garante isso. */
function buf(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes)
}

async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== KEY_BYTES) throw new Error(`a chave deve ter ${KEY_BYTES} bytes`)
  return crypto.subtle.importKey('raw', buf(raw), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export class WebCryptoCipher implements SymmetricCipher {
  async generateKey(): Promise<Uint8Array> {
    return crypto.getRandomValues(new Uint8Array(KEY_BYTES))
  }

  async encrypt(key: Uint8Array, plain: Uint8Array): Promise<Encrypted> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importKey(key), buf(plain))
    return { iv, data: new Uint8Array(data) }
  }

  async decrypt(key: Uint8Array, enc: Encrypted): Promise<Uint8Array> {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buf(enc.iv) },
      await importKey(key),
      buf(enc.data),
    )
    return new Uint8Array(plain)
  }
}
