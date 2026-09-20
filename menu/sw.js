/*
 * Оболочка меню на телефоне гостя.
 *
 * Меню открывают в зале, где интернет бывает плохим, и с экрана телефона,
 * если гость поставил его как приложение. Поэтому саму страницу и её файлы
 * держим на телефоне: открывается сразу и без сети.
 *
 * Данные сюда не кладём — они приходят из Supabase и кэшируются отдельно
 * (src/lib/cache.ts): счёт и заказ должны быть свежими, а не из кэша
 * браузера.
 */
const CACHE = 'menu-shell-1'

self.addEventListener('install', (event) => {
  // Новая сборка заступает сразу: гость не должен ловить старую страницу.
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Сама страница: сначала сеть — чтобы новая сборка приезжала сама, —
  // а нет сети, отдаём последнюю сохранённую.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          const cache = await caches.open(CACHE)
          cache.put(request, fresh.clone())
          return fresh
        } catch {
          return (await caches.match(request)) ?? (await caches.match('./')) ?? Response.error()
        }
      })(),
    )
    return
  }

  // Скрипты, стили, значки: имя файла меняется со сборкой, поэтому
  // сохранённое всегда то самое.
  event.respondWith(
    (async () => {
      const known = await caches.match(request)
      if (known) return known
      const fresh = await fetch(request)
      if (fresh.ok) {
        const cache = await caches.open(CACHE)
        cache.put(request, fresh.clone())
      }
      return fresh
    })(),
  )
})
