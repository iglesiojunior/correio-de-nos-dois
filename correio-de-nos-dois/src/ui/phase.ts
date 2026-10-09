import type { Phase } from './scene/scene3d'

/** Momento do dia para o céu da cena (horário do aparelho). */
export function phaseOf(date: Date): Phase {
  const h = date.getHours()
  if (h >= 5 && h < 11) return 'manha'
  if (h >= 11 && h < 16) return 'tarde'
  if (h >= 16 && h < 19) return 'entardecer'
  return 'noite'
}
