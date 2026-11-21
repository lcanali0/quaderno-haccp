// Fa aprire l'app anche con connessione debole: prima prova la rete, poi la copia salvata.
const CACHE = "haccp-v3";
const BASE = ["./", "index.html", "manuale.html", "collegamento.js", "config.js", "manifest.webmanifest", "icona-192.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    // no-cache: chiede sempre al sito se c'è una versione nuova, così le modifiche arrivano subito
    fetch(e.request, { cache: "no-cache" }).catch(() => fetch(e.request)).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html")))
  );
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(ws => ws.length ? ws[0].focus() : self.clients.openWindow("./")));
});
