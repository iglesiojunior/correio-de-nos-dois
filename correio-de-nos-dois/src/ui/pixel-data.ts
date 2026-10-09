/** Paleta e desenhos em pixel art (originais). */
export const PAL: Record<string, string> = {
  O: '#4e2d22', R: '#d9434f', L: '#ff9aa2', W: '#fff4e0', C: '#fbe6c8', K: '#e9c79f', Y: '#f2bf4b', D: '#c98f2a',
  T: '#a0643a', t: '#d98a5a', G: '#5e9a4c', g: '#8cc06a', h: '#b7ec86', U: '#9fd3e0', N: '#b85a48', M: '#ec9c7c',
  E: '#f0d2b4', e: '#e3b991',
}

export const ICONS = {
  heart: ['.OO...OO.', 'OLRO.ORRO', 'OLRRORRRO', 'ORRRRRRRO', '.ORRRRRO.', '..ORRRO..', '...ORO...', '....O....'],
  env: ['OOOOOOOOOOO', 'OWOCCCCCOWO', 'OWWOCCCOWWO', 'OWWWOROWWWO', 'OWWWWWWWWWO', 'OWWWWWWWWWO', 'OOOOOOOOOOO'],
  envOpen: ['.....O.....', '....OCO....', '...OCCCO...', '..OCCCCCO..', 'OOOOOOOOOOO', 'OWOWWWWWOWO', 'OWWOWWWOWWO', 'OWWWOOOWWWO', 'OWWWWWWWWWO', 'OOOOOOOOOOO'],
  envBig: ['OOOOOOOOOOOOOOOOOOOOOO', 'OEOeeeeeeeeeeeeeeeeOEO', 'OEEOeeeeeeeeeeeeeeOEEO', 'OEEEOeeeeeeeeeeeeOEEEO', 'OEEEEOeeeeeeeeeeOEEEEO', 'OEEEEEOeeeeeeeeOEEEEEO', 'OEEEEEEOeeeeeeOEEEEEEO', 'OEEEEEEEOOOOOOEEEEEEEO', 'OEEEEEEEEEEEEEEEEEEEEO', 'OEEEEEEEEEEEEEEEEEEEEO', 'OEEEEEEEEEEEEEEEEEEEEO', 'OEEEEEEEEEEEEEEEEEEEEO', 'OEEEEEEEEEEEEEEEEEEEEO', 'OeeeeeeeeeeeeeeeeeeeeO', 'OOOOOOOOOOOOOOOOOOOOOO'],
  lock: ['..OOOOO..', '.OO...OO.', '.O.....O.', 'OOOOOOOOO', 'OYYYYYYYO', 'OYYYOYYDO', 'OYYYOYYDO', 'OYYYYYYDO', 'OOOOOOOOO'],
  check: ['......OO', '.....OGO', 'O...OGO.', 'OO.OGO..', 'OGOGO...', '.OGO....', '..O.....'],
  camera: ['..OOOO.....', 'OOOOOOOOOOO', 'OWWWOOOWWRO', 'OWWOWWWOWWO', 'OWWOWUWOWWO', 'OWWOWWWOWWO', 'OWWWOOOWWWO', 'OOOOOOOOOOO'],
  cal: ['OOOOOOOOO', 'ORORORORO', 'OOOOOOOOO', 'OWWWWWWWO', 'OWOWOWOWO', 'OWWWWWWWO', 'OWOWORWWO', 'OOOOOOOOO'],
  chat: ['.OOOOOOOO.', 'OWWWWWWWWO', 'OWOWWOWWOO', 'OWWWWWWWWO', '.OOOOOOOO.', '..OO......', '..O.......'],
  bell: ['...OOO...', '..OYYYO..', '.OYYYYYO.', '.OYYYYYO.', '.OYYYYYO.', 'OYYYYYYYO', 'OOOOOOOOO', '...OOO...'],
  hourglass: ['OOOOOOO', 'OYYYYYO', '.OYYYO.', '..OYO..', '.OWYWO.', 'OWYYYWO', 'OOOOOOO'],
  pen: ['.......OO', '......OYO', '.....OYO.', '....OYO..', '...OYO...', '..OYO....', '.OOO.....', 'OOO......'],
  x: ['OO...OO', '.OO.OO.', '..OOO..', '..OOO..', '.OO.OO.', 'OO...OO'],
  corner: ['OOOOOO..', 'OMMMMOO.', 'OMNNMMO.', 'OMNOOMO.', 'OMMOO...', 'OOMO....', '.OOO....', '........'],
} as const

export type IconName = keyof typeof ICONS

/** Ladrilho de ramas da moldura, gerado uma vez como data URI. */
export const VINE_TILE = (() => {
  const tile = ['........', '.NN.....', 'NNN.....', '.N.N....', '....NN..', '....NNN.', '.....NN.', '........']
  let r = ''
  tile.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'N') r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL.N}"/>` }))
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">${r}</svg>`)}")`
})()
