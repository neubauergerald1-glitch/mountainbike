/* Offline-Cache: App-Dateien werden beim ersten Besuch gespeichert. Bei Änderungen VERSION erhöhen. */
const VERSION = "mtb-v4";
const FILES = ["./", "index.html", "css/base.css", "css/dashboard.css", "js/d3.min.js", "js/shim.js", "js/calcs.js", "js/app.js",
  "manifest.webmanifest", "data/fahrten.csv", "data/touren.json", "data/touren_edits.json", "data/duell_segmente.json",
  "data/duell_zeiten.json", "data/meta.json", "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.hostname === "api.anthropic.com") return;
  // Netzwerk zuerst (neuer Datenstand), ohne Netz aus dem Cache
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (url.origin === location.origin || url.hostname.startsWith("fonts.g"))) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
