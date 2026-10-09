/**
 * Notificações push "chegou o envelope N" (função da Vercel em /api/push).
 *
 *   POST /api/push              { subscription }  o app inscreve o aparelho
 *   GET  /api/push              dispara o aviso do envelope que liberou agora (cron das 08:00)
 *   GET  /api/push?teste=1      manda uma notificação de teste para todos os inscritos
 *
 * O GET exige `Authorization: Bearer <CRON_SECRET>` (a Vercel Cron manda sozinha; no cron-job.org
 * é um header configurado). Cada envelope é avisado uma vez só, mesmo com dois crons disparando.
 *
 * Variáveis de ambiente: VAPID_PRIVATE_KEY, CRON_SECRET e as do Upstash Redis
 * (KV_REST_API_URL/KV_REST_API_TOKEN ou UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN).
 *
 * Sem imports de ../src: no runtime ESM da Vercel imports relativos sem extensão quebram.
 * O calendário abaixo é uma cópia de src/config/trip.ts; o teste api/push.test.ts garante que batem.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import webpush, { type PushSubscription } from 'web-push'

export const SCHEDULE = {
  firstDay: '2026-10-14',
  envelopeCount: 25,
  openingTime: '08:00',
  utcOffset: '-03:00',
} as const

export const PUBLIC_ORIGIN = 'https://correio-de-nos-dois.vercel.app'
export const PUSH_PUBLIC_KEY =
  'BDBXTUmSN6373pB137zJoX5isoPRg-lpMtqaxdqggfVSB_JgEfuINkhFEEHCpb1Eq48NdF1JLPqXPJ50AliDOig'

const DAY_MS = 24 * 60 * 60 * 1000
/** Até quanto tempo depois das 08:00 ainda vale avisar (cron atrasado, nova tentativa). */
const WINDOW_MS = 4 * 60 * 60 * 1000
const MAX_SUBSCRIPTIONS = 20
const SUBS_KEY = 'push:subs'

export function envelopeOpensAt(id: number): Date {
  const first = new Date(`${SCHEDULE.firstDay}T${SCHEDULE.openingTime}:00${SCHEDULE.utcOffset}`)
  return new Date(first.getTime() + (id - 1) * DAY_MS)
}

/** Envelope que liberou nas últimas horas, ou null (fora da viagem ou longe das 08:00). */
export function envelopeJustOpened(now: Date): number | null {
  for (let id = 1; id <= SCHEDULE.envelopeCount; id++) {
    const t = envelopeOpensAt(id).getTime()
    if (now.getTime() >= t && now.getTime() < t + WINDOW_MS) return id
  }
  return null
}

export function messageFor(id: number): { title: string; body: string } {
  if (id === SCHEDULE.envelopeCount) {
    return { title: 'Correio de Nós Dois', body: `💌 Chegou o envelope ${id}, o último! Pega ele na mala.` }
  }
  return { title: 'Correio de Nós Dois', body: `💌 O envelope ${id} chegou! Pega ele na mala.` }
}

// ---------- Upstash Redis via REST (sem SDK: é só um POST com o comando) ----------

async function redis<T = unknown>(...command: (string | number)[]): Promise<T> {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Redis não configurado (variáveis KV_REST_API_URL/TOKEN)')
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
  })
  const data = (await res.json()) as { result?: T; error?: string }
  if (!res.ok || data.error) throw new Error(`Redis: ${data.error ?? res.status}`)
  return data.result as T
}

// ---------- helpers HTTP ----------

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

function isSubscription(x: unknown): x is PushSubscription {
  const s = x as PushSubscription | null
  return (
    !!s &&
    typeof s.endpoint === 'string' &&
    s.endpoint.startsWith('https://') &&
    s.endpoint.length < 1024 &&
    typeof s.keys?.p256dh === 'string' &&
    typeof s.keys?.auth === 'string' &&
    s.keys.p256dh.length < 256 &&
    s.keys.auth.length < 64
  )
}

const subId = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 32)

// ---------- rotas ----------

/** Inscreve o aparelho. Aberto (o app chama sem segredo); o pior abuso é alguém receber os avisos. */
export async function POST(req: Request): Promise<Response> {
  let body: { subscription?: unknown }
  try {
    body = (await req.json()) as { subscription?: unknown }
  } catch {
    return json(400, { error: 'JSON inválido' })
  }
  if (!isSubscription(body.subscription)) return json(400, { error: 'Inscrição inválida' })
  const sub = body.subscription
  const id = subId(sub.endpoint)

  const exists = await redis<number>('HEXISTS', SUBS_KEY, id)
  if (!exists && (await redis<number>('HLEN', SUBS_KEY)) >= MAX_SUBSCRIPTIONS) {
    return json(429, { error: 'Limite de aparelhos atingido' })
  }
  const clean = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }
  await redis('HSET', SUBS_KEY, id, JSON.stringify(clean))
  return json(200, { ok: true })
}

/** Dispara o aviso (cron) ou um teste. */
export async function GET(req: Request): Promise<Response> {
  if (!authorized(req)) return json(401, { error: 'Não autorizado' })
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!privateKey) return json(500, { error: 'VAPID_PRIVATE_KEY ausente' })
  // antes da trava "uma vez por envelope": chave inválida não pode queimar o aviso do dia
  try {
    webpush.setVapidDetails(PUBLIC_ORIGIN, PUSH_PUBLIC_KEY, privateKey)
  } catch (e) {
    return json(500, { error: `VAPID inválida: ${(e as Error).message}` })
  }

  const test = new URL(req.url).searchParams.has('teste')
  let message: { title: string; body: string }
  if (test) {
    message = { title: 'Correio de Nós Dois', body: '🔔 Teste: as notificações estão funcionando.' }
  } else {
    const id = envelopeJustOpened(new Date())
    if (id === null) return json(200, { sent: 0, reason: 'nenhum envelope liberou agora' })
    // trava "uma vez por envelope": o primeiro cron que chegar leva, o outro sai aqui
    const first = await redis<string | null>('SET', `push:sent:${id}`, '1', 'NX', 'EX', 3 * 86400)
    if (first !== 'OK') return json(200, { sent: 0, reason: `envelope ${id} já avisado` })
    message = messageFor(id)
  }

  const subs = (await redis<string[]>('HGETALL', SUBS_KEY)) ?? []
  const payload = JSON.stringify({ ...message, url: '/' })
  let sent = 0
  let removed = 0
  const errors: string[] = []

  // HGETALL devolve [campo, valor, campo, valor, ...]
  for (let i = 0; i < subs.length; i += 2) {
    const field = subs[i]
    try {
      // TTL: se o celular estiver sem sinal, o aviso ainda vale por 12 h
      await webpush.sendNotification(JSON.parse(subs[i + 1]) as PushSubscription, payload, {
        TTL: 12 * 3600,
        urgency: 'high',
      })
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        // inscrição morta (app desinstalado, permissão revogada): limpa
        await redis('HDEL', SUBS_KEY, field)
        removed++
      } else {
        errors.push(String(status ?? (e as Error).message))
      }
    }
  }
  return json(200, { sent, removed, errors, test })
}
