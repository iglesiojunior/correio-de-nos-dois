/**
 * Lacra a carta de um envelope e grava public/letters/NN.json.
 *
 *   npm run seal -- 9                 (lê secrets/cartas/09.txt e, se existir, 09.webp ou 09.jpg)
 *
 * O mesmo lacre está no painel admin: `npm run dev` → http://localhost:5173/admin.html
 */
import { TRIP } from '../src/config/trip'
import { opensAt } from '../src/domain'
import { sealEnvelope } from './letters'

const id = Number(process.argv[2])
if (!Number.isInteger(id)) {
  console.error('Uso: npm run seal -- <número do envelope>')
  process.exit(1)
}

const sealed = await sealEnvelope(id)
console.log(`Envelope ${id} lacrado até ${opensAt(TRIP, id).toLocaleString('pt-BR')} (rodada ${sealed.round})`)
