/** Grava cartas lacradas em public/letters/NN.json (só no seu computador). */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SealedLetter, SealedLetterWriter } from '../../src/application'
import { letterFileName } from '../../src/infrastructure/fetch-letter-reader'

export class FsLetterWriter implements SealedLetterWriter {
  private readonly dir: string
  constructor(dir = join(process.cwd(), 'public', 'letters')) {
    this.dir = dir
  }
  async save(letter: SealedLetter): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    await writeFile(join(this.dir, letterFileName(letter.envelopeId)), JSON.stringify(letter, null, 2) + '\n')
  }
}
