/**
 * Instalação do PWA na tela inicial.
 *
 * Chrome/Edge/Samsung no Android disparam `beforeinstallprompt` quando o app é instalável;
 * guardando o evento dá para mostrar um botão nosso em vez de depender do menu ⋮.
 * O evento pode chegar antes do React montar, por isso o listener fica no nível do módulo.
 * iPhone não tem esse evento: lá só dá para ensinar o caminho pelo botão Compartilhar.
 */
import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState =
  | { kind: 'installed' }
  | { kind: 'prompt'; install: () => Promise<void> }
  | { kind: 'ios' }
  | { kind: 'manual' }

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // segura o mini-banner automático: o botão do app faz o papel dele
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    notify()
  })
}

async function install(): Promise<void> {
  if (!deferred) return
  const ev = deferred
  deferred = null // o evento só pode ser usado uma vez
  await ev.prompt()
  if ((await ev.userChoice).outcome === 'accepted') installed = true
  notify()
}

// useSyncExternalStore exige o mesmo objeto enquanto nada mudou: um por estado
const STATES: Record<InstallState['kind'], InstallState> = {
  installed: { kind: 'installed' },
  prompt: { kind: 'prompt', install },
  ios: { kind: 'ios' },
  manual: { kind: 'manual' },
}

function getSnapshot(): InstallState {
  return STATES[installed || isStandalone() ? 'installed' : deferred ? 'prompt' : isIos() ? 'ios' : 'manual']
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstall(): InstallState {
  return useSyncExternalStore(subscribe, getSnapshot)
}
