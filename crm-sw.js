const CACHE='nia-crm-shell-20261107-media-attach';
const SHELL=['./crm.html','./crm.css?v=20261107-media-attach','./crm.js?v=20261107-media-attach','./crm-ui.js?v=20261107-media-attach','./crm-member-features.js?v=20261107-media-attach','./crm-legacy-fields.js?v=20261107-paged','./crm-pwa.js?v=20261107-mobile','./crm-icon-192.png','./crm-icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(asset=>new URL(asset,self.registration.scope).href))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('nia-crm-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!SHELL.some(asset=>new URL(asset,self.registration.scope).pathname===url.pathname))return;
 event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}return response;}).catch(()=>caches.match(request)));
});
