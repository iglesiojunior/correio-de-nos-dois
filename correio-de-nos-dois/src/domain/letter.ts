/** Carta: o conteúdo que vai dentro do envelope. */
export interface Photo {
  readonly mime: string
  readonly data: Uint8Array
}

export interface LetterContent {
  readonly text: string
  readonly photo?: Photo
}

/** Limite para não pesar no 4G dela. Comprima a foto antes de lacrar. */
export const MAX_PHOTO_BYTES = 600 * 1024
