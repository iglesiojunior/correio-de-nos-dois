/**
 * Prova de conceito: tranca uma frase para daqui a 30 segundos e tenta abrir antes e depois.
 *   npm run poc:timelock
 */
import { DrandTimeLock } from '../src/infrastructure/drand-timelock'
import { TooEarlyError } from '../src/domain'
import { fromUtf8, utf8 } from '../src/shared/bytes'

const lock = new DrandTimeLock()
const opensAt = new Date(Date.now() + 30_000)
const box = await lock.lock(utf8('te amo, abre só daqui a 30 segundos'), opensAt)
console.log(`Trancado para a rodada ${box.round} (${opensAt.toLocaleTimeString('pt-BR')})`)

try {
  await lock.unlock(box)
  console.log('ERRO: abriu antes da hora!')
} catch (e) {
  console.log(e instanceof TooEarlyError ? 'Antes da hora: não abriu (certo).' : `Erro inesperado: ${e}`)
}

console.log('Esperando 35 s…')
await new Promise((r) => setTimeout(r, 35_000))
console.log('Depois da hora:', fromUtf8(await lock.unlock(box)))
