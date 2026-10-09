/**
 * API do painel admin. Só existe dentro do `npm run dev` (plugin em vite.config.ts),
 * nunca no build nem na Vercel: as chaves do papel não saem do seu computador.
 *
 *   GET    /__admin/api/envelopes        status dos 26 envelopes
 *   GET    /__admin/api/draft/:id        texto do rascunho
 *   PUT    /__admin/api/draft/:id        { text }
 *   GET    /__admin/api/photo/:id        bytes da foto (para pré-visualizar)
 *   PUT    /__admin/api/photo/:id        corpo = imagem (image/webp ou image/jpeg)
 *   DELETE /__admin/api/photo/:id
 *   POST   /__admin/api/seal/:id         lacra → public/letters/NN.json
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { MAX_PHOTO_BYTES } from '../../src/domain'
import {
  allEnvelopeStatus,
  assertEnvelope,
  deleteDraftPhoto,
  envelopeStatus,
  readDraftPhoto,
  readDraftText,
  sealEnvelope,
  writeDraftPhoto,
  writeDraftText,
} from '../letters'

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/**
 * O dev server pode ser exposto sem querer (`--host`) e qualquer site aberto no navegador
 * pode tentar um POST para localhost. Então: só conexões da própria máquina, e escrita só
 * com Origin igual ao Host (bloqueia CSRF e DNS rebinding).
 */
function allowed(req: IncomingMessage): boolean {
  if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) return false
  if (req.method === 'GET') return true
  const origin = req.headers.origin
  return !!origin && new URL(origin).host === req.headers.host
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > limit) throw new HttpError(413, `Arquivo maior que ${Math.round(limit / 1024)} KB`)
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

/** `url` chega sem o prefixo /__admin (o connect remove o ponto de montagem). */
export async function handleAdmin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (!allowed(req)) throw new HttpError(403, 'Só no seu computador')
    const path = new URL(req.url ?? '/', 'http://x').pathname
    const m = path.match(/^\/api\/(envelopes|draft|photo|seal)(?:\/(\d+))?$/)
    if (!m) throw new HttpError(404, 'Rota desconhecida')
    const [, route, idText] = m
    const id = Number(idText)
    if (route !== 'envelopes') {
      try {
        assertEnvelope(id)
      } catch (e) {
        throw new HttpError(400, (e as Error).message)
      }
    }

    switch (`${req.method} ${route}`) {
      case 'GET envelopes':
        return send(res, 200, await allEnvelopeStatus())

      case 'GET draft':
        return send(res, 200, { text: (await readDraftText(id)) ?? '' })

      case 'PUT draft': {
        const { text } = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8')) as { text?: unknown }
        if (typeof text !== 'string') throw new HttpError(400, 'Campo "text" ausente')
        await writeDraftText(id, text)
        return send(res, 200, await envelopeStatus(id))
      }

      case 'GET photo': {
        const photo = await readDraftPhoto(id)
        if (!photo) throw new HttpError(404, 'Sem foto')
        res.setHeader('content-type', photo.mime)
        res.setHeader('cache-control', 'no-store')
        res.end(photo.data)
        return
      }

      case 'PUT photo': {
        const data = await readBody(req, MAX_PHOTO_BYTES)
        await writeDraftPhoto(id, req.headers['content-type'] ?? '', new Uint8Array(data))
        return send(res, 200, await envelopeStatus(id))
      }

      case 'DELETE photo':
        await deleteDraftPhoto(id)
        return send(res, 200, await envelopeStatus(id))

      case 'POST seal': {
        const sealed = await sealEnvelope(id)
        console.log(`[admin] envelope ${id} lacrado (rodada ${sealed.round})`)
        return send(res, 200, await envelopeStatus(id))
      }

      default:
        throw new HttpError(405, 'Método não permitido')
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    send(res, status, { error: (e as Error).message })
  }
}
