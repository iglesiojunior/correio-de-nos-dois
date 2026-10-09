/** Carta: o conteúdo que vai dentro do envelope. */
export interface Photo {
  readonly mime: string
  readonly data: Uint8Array
}

/**
 * Figura que aparece em AR sobre o QR quando a carta abre. Vai DENTRO da carta cifrada:
 * ninguém vê a surpresa antes do dia.
 *
 * - voxels: pixel art pequena (até 32x32) que vira um objeto 3D de cubinhos; pixels com alfa < 128 ficam vazios.
 * - card: imagem maior, mostrada como um cartão plano flutuando.
 */
export type ArFigure =
  | { readonly kind: 'voxels'; readonly width: number; readonly height: number; readonly rgba: Uint8Array }
  | { readonly kind: 'card'; readonly mime: string; readonly data: Uint8Array }

export interface LetterContent {
  readonly text: string
  readonly photo?: Photo
  readonly ar?: ArFigure
}

/** Limite para não pesar no 4G dela. Comprima a foto antes de lacrar. */
export const MAX_PHOTO_BYTES = 600 * 1024

/** Maior lado da pixel art em voxels (32x32 = até 1024 cubinhos, leve até em celular simples). */
export const MAX_VOXEL_SIDE = 32
export const MAX_AR_CARD_BYTES = 200 * 1024

/** Mensagem de erro se a figura for inválida, ou null se estiver ok. */
export function arFigureProblem(fig: ArFigure): string | null {
  if (fig.kind === 'card') {
    return fig.data.length > MAX_AR_CARD_BYTES ? `Imagem do AR maior que ${MAX_AR_CARD_BYTES / 1024} KB` : null
  }
  const { width, height, rgba } = fig
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return 'Pixel art sem tamanho'
  if (width > MAX_VOXEL_SIDE || height > MAX_VOXEL_SIDE) return `Pixel art maior que ${MAX_VOXEL_SIDE}x${MAX_VOXEL_SIDE}`
  if (rgba.length !== width * height * 4) return 'Pixel art com bytes faltando'
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] >= 128) return null
  return 'Pixel art toda transparente'
}
