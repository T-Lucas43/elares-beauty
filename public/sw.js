const CACHE='elares-beauty-static-v1';
const STATIC=['/offline.html','/icons/elares-192.png','/icons/elares-512.png','/icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const request=event.request;const url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;
 // Agenda, financeiro, sessões e links pessoais nunca são armazenados no cache.
 if(url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));return;}
 if(STATIC.includes(url.pathname)){event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;})));}
});

