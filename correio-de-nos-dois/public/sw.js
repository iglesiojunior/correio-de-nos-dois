/**
 * Service worker mínimo: deixa o app instalável e abre a tela sem internet.
 *
 * Rede primeiro para tudo que muda (index.html, cartas em /letters/), com o cache só de reserva.
 * /assets/ têm hash no nome (nunca mudam), então podem vir direto do cache.
 * A drand e as fontes são de outro domínio e passam direto, sem cache.
 * Para forçar todo mundo a descartar o cache antigo, suba a versão abaixo.
 */
const CACHE = 'correio-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function remember(key, res) {
  if (res.ok) {
    const copy = res.clone()
    caches.open(CACHE).then((c) => c.put(key, copy))
  }
  return res
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => remember(req, res))))
    return
  }

  // Toda navegação (/, /abrir) é o mesmo index.html: guarda numa chave só.
  // O #k=... do QR nunca chega aqui (fragmento não faz parte da requisição).
  const key = req.mode === 'navigate' ? '/' : req
  event.respondWith(
    fetch(req)
      .then((res) => remember(key, res))
      .catch(() => caches.match(key).then((hit) => hit || Response.error())),
  )
})

// ---------- notificações push (enviadas por api/push.ts) ----------

self.addEventListener('push', (event) => {
  let data = { title: 'Correio de Nós Dois', body: '💌 Chegou carta nova!', url: '/' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {
    /* payload vazio ou texto: usa a mensagem padrão */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      tag: 'correio-envelope', // um aviso novo substitui o anterior em vez de empilhar
      renotify: true,
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin)
      return open ? open.focus() : self.clients.openWindow(url)
    }),
  )
})
