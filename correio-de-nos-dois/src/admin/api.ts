/** Cliente da API local do painel (scripts/admin/api.ts). */
import { MAX_AR_CARD_BYTES, MAX_PHOTO_BYTES, MAX_VOXEL_SIDE, arFigureProblem, type ArFigure } from '../domain'
import { fromB64url, toB64url } from '../shared/bytes'

/** Espelho de EnvelopeStatus em scripts/letters.ts (o app não importa scripts/). */
export interface EnvelopeStatus {
  readonly id: number
  readonly opensAt: string
  readonly hasText: boolean
  readonly photoBytes: number | null
  readonly arKind: ArFigure['kind'] | null
  readonly draftChangedAt: number | null
  readonly sealed: { readonly round: number; readonly at: number } | null
}

const BASE = '/__admin/api'

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  return body as T
}

export const adminApi = {
  envelopes: () => call<EnvelopeStatus[]>('/envelopes'),
  draft: (id: number) => call<{ text: string }>(`/draft/${id}`),
  saveDraft: (id: number, text: string) =>
    call<EnvelopeStatus>(`/draft/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  photoUrl: (id: number, version: number) => `${BASE}/photo/${id}?v=${version}`,
  savePhoto: (id: number, photo: Blob) =>
    call<EnvelopeStatus>(`/photo/${id}`, { method: 'PUT', headers: { 'content-type': photo.type }, body: photo }),
  deletePhoto: (id: number) => call<EnvelopeStatus>(`/photo/${id}`, { method: 'DELETE' }),
  ar: async (id: number): Promise<ArFigure | null> => {
    const w = await call<Record<string, string | number> | null>(`/ar/${id}`)
    if (!w) return null
    return w.kind === 'voxels'
      ? { kind: 'voxels', width: Number(w.width), height: Number(w.height), rgba: fromB64url(String(w.rgba)) }
      : { kind: 'card', mime: String(w.mime), data: fromB64url(String(w.data)) }
  },
  saveAr: (id: number, fig: ArFigure) =>
    call<EnvelopeStatus>(`/ar/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        fig.kind === 'voxels'
          ? { kind: 'voxels', width: fig.width, height: fig.height, rgba: toB64url(fig.rgba) }
          : { kind: 'card', mime: fig.mime, data: toB64url(fig.data) },
      ),
    }),
  deleteAr: (id: number) => call<EnvelopeStatus>(`/ar/${id}`, { method: 'DELETE' }),
  seal: (id: number) => call<EnvelopeStatus>(`/seal/${id}`, { method: 'POST' }),
}

/**
 * Reduz qualquer foto (até as de 8 MB do celular) para WebP dentro do limite da carta.
 * Tenta qualidade alta primeiro e vai diminuindo tamanho/qualidade até caber.
 */
export async function compressPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    for (const maxSide of [1600, 1280, 1024, 800]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.85, 0.75, 0.65, 0.5]) {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', quality))
        if (blob && blob.type === 'image/webp' && blob.size <= MAX_PHOTO_BYTES) return blob
      }
    }
  } finally {
    bitmap.close()
  }
  throw new Error('Não consegui deixar a foto abaixo de 600 KB')
}

async function webpUnder(bitmap: ImageBitmap, sides: number[], limit: number): Promise<Blob | null> {
  for (const maxSide of sides) {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', quality))
      if (blob && blob.type === 'image/webp' && blob.size <= limit) return blob
    }
  }
  return null
}

/**
 * Imagem → figura de AR. Até 32x32 é tratada como pixel art (cada pixel vira um cubinho);
 * maior que isso vira um cartão WebP (a transparência do PNG é mantida).
 */
export async function imageToArFigure(file: Blob): Promise<ArFigure> {
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width <= MAX_VOXEL_SIDE && bitmap.height <= MAX_VOXEL_SIDE) {
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(bitmap, 0, 0)
      const rgba = new Uint8Array(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data.buffer.slice(0))
      const fig: ArFigure = { kind: 'voxels', width: bitmap.width, height: bitmap.height, rgba }
      const problem = arFigureProblem(fig)
      if (problem) throw new Error(problem)
      return fig
    }
    const blob = await webpUnder(bitmap, [512, 384, 256], MAX_AR_CARD_BYTES)
    if (!blob) throw new Error('Não consegui deixar a imagem abaixo de 200 KB')
    return { kind: 'card', mime: 'image/webp', data: new Uint8Array(await blob.arrayBuffer()) }
  } finally {
    bitmap.close()
  }
}

/** Pré-visualização da figura como URL de imagem (pixel art ampliada sem borrar). */
export function arPreviewUrl(fig: ArFigure): string {
  if (fig.kind === 'card') return URL.createObjectURL(new Blob([new Uint8Array(fig.data)], { type: fig.mime }))
  const canvas = document.createElement('canvas')
  canvas.width = fig.width
  canvas.height = fig.height
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(fig.rgba), fig.width, fig.height), 0, 0)
  return canvas.toDataURL('image/png')
}
