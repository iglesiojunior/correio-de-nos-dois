/**
 * Inscrição nas notificações push do aparelho dela (o envio é feito por api/push.ts).
 *
 * Só funciona com o service worker ativo, ou seja, no app publicado (no `npm run dev` não há SW).
 * No iPhone o push só existe com o app instalado na tela inicial (iOS 16.4+).
 */
import { useCallback, useEffect, useState } from 'react'
import { PUSH_PUBLIC_KEY } from '../config/trip'
import { fromB64url } from '../shared/bytes'

export type PushState = 'checking' | 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on' | 'busy' | 'error'

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  return navigator.serviceWorker.getRegistration()
}

/** Manda a inscrição para o servidor. Idempotente: reenviar só atualiza. */
async function saveOnServer(sub: PushSubscription): Promise<void> {
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

async function currentState(): Promise<PushState> {
  if (!PUSH_PUBLIC_KEY) return 'unsupported'
  if (!('PushManager' in window) || !('Notification' in window)) return isIos() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  if (!reg) return 'unsupported'
  const sub = await reg.pushManager.getSubscription()
  if (!sub || Notification.permission !== 'granted') return 'off'
  // reenvia em silêncio: se o servidor perdeu a inscrição, ela volta sem ela perceber
  saveOnServer(sub).catch(() => {})
  return 'on'
}

export function usePush(): { state: PushState; enable: () => Promise<void> } {
  const [state, setState] = useState<PushState>('checking')

  useEffect(() => {
    let alive = true
    currentState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState('unsupported'))
    return () => {
      alive = false
    }
  }, [])

  const enable = useCallback(async () => {
    setState('busy')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return setState(permission === 'denied' ? 'denied' : 'off')
      const reg = await registration()
      if (!reg) return setState('unsupported')
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true, // exigência do Chrome: todo push mostra uma notificação
          applicationServerKey: fromB64url(PUSH_PUBLIC_KEY) as BufferSource,
        }))
      await saveOnServer(sub)
      setState('on')
    } catch (e) {
      console.error(e)
      setState('error')
    }
  }, [])

  return { state, enable }
}
