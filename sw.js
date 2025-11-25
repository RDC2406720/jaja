//Nombre de la caché
const CACHE = "Media-PWA-v1";

//Archivos que se almacenarán en cache durante la instalación del service worker
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/maskable-192.png',
    './icons/maskable-512.png'
];

//Evento que se ejecuta cuando el SW se instala por primera vez
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS))
    );
});

//Evento que se ejecuta cuando el SW se activa
self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        );
        //Reclama inmediatamente el control de las pestañas abiertas
        self.clients.claim();
    })());
});

//Evento que intercepta todas las peticiones de red
self.addEventListener('fetch', (e) => {
    const req = e.request;
    e.responWith((async () => {
        const cached = await caches.match(req);
        if (cached) return cached;

        try {
            const fresh = await fetch(req);
            const cache = await caches.open(CACHE);
            if (req.method === 'GET' && fresh.status === 200){
                cache.put(req, fresh.clone());
            }
            return fresh;
        } catch (err) {
            return cached || Response.error();
        }
    })());
});