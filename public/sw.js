// Service Worker — Preceptor Médico PWA
// Atualiza automaticamente quando o app muda

const CACHE = "preceptor-v1";
const ASSETS = ["/", "/index.html"];

// Instala e cacheia os assets principais
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
});

// Ativa e limpa caches antigos
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Estratégia: Network first, cache fallback
// Sempre busca a versão mais recente da rede
self.addEventListener("fetch", e => {
  // Ignora requests não-GET e APIs externas
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("googleapis.com")) return;
  if (e.request.url.includes("pinecone.io")) return;
  if (e.request.url.includes("ncbi.nlm.nih.gov")) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cacheia a resposta nova
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Notifica o app quando há nova versão disponível
self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
