/** Leitura e escrita do arquivo de chaves do papel (NUNCA vai para o git). */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fromB64url, toB64url } from '../src/shared/bytes'

export const KEYS_PATH = join(process.cwd(), 'secrets', 'paper-keys.json')

export interface PaperKeysFile {
  readonly createdAt: string
  /** número do envelope → chave em base64url */
  readonly keys: Record<string, string>
}

export async function readPaperKeys(): Promise<Map<number, Uint8Array>> {
  const file = JSON.parse(await readFile(KEYS_PATH, 'utf8')) as PaperKeysFile
  return new Map(Object.entries(file.keys).map(([id, k]) => [Number(id), fromB64url(k)]))
}

export async function writePaperKeys(keys: Map<number, Uint8Array>): Promise<void> {
  const file: PaperKeysFile = {
    createdAt: new Date().toISOString(),
    keys: Object.fromEntries([...keys].map(([id, k]) => [String(id), toB64url(k)])),
  }
  await mkdir(dirname(KEYS_PATH), { recursive: true })
  await writeFile(KEYS_PATH, JSON.stringify(file, null, 2) + '\n', { flag: 'wx' }) // falha se já existir
}
