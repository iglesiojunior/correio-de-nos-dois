/** Cliente da API local do painel (scripts/admin/api.ts). */
import { MAX_PHOTO_BYTES } from '../domain'

/** Espelho de EnvelopeStatus em scripts/letters.ts (o app não importa scripts/). */
export interface EnvelopeStatus {
  readonly id: number
  readonly opensAt: string
  readonly hasText: boolean
  readonly photoBytes: number | null
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
