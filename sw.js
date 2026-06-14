// sw.js — Service Worker per Segretario AI
// Strategia: Cache-First per assets statici, Network-Only per API

const CACHE_VERSION = 'v2';
const CACHE_NAME = `segretario-ai-${CACHE_VERSION}`;

// Assets da pre-cachare all'installazione (shell minima)
const PRECACHE_ASSETS = [
    'style-v2.css',
    'js/config.js',
    'js/api-client.js',
    'js/core-init.js',
    'js/auth-guard.js',
    'js/supabase-client.js',
    'js/shared-ui.js',
    'js/libs/supabase.min.js',
    'js/libs/choices.min.js',
    'dark-mode.css',
    'js/dark-mode.js'
];

// Pattern di URL da NON cachare mai
const NO_CACHE_PATTERNS = [
    '/api/',           // Chiamate backend
    '/auth/',          // Auth Supabase
    '/rest/',          // REST Supabase diretto
    '/storage/',       // Upload/download Supabase Storage (immagini dinamiche)
    'supabase.co',     // Qualsiasi cosa Supabase
    'googleapis.com',  // Google APIs
    'chrome-extension' // Estensioni browser
];

// Estensioni da cachare (cache-first)
const CACHEABLE_EXTENSIONS = ['.js', '.css', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.jpeg', '.svg', '.ico'];

// --- INSTALL: Pre-cacha la shell minima ---
self.addEventListener('install', (event) => {
    console.log(`[SW] Install ${CACHE_VERSION}`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting()) // Attiva subito senza aspettare
    );
});

// --- ACTIVATE: Pulisci cache vecchie ---
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activate ${CACHE_VERSION}`);
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME)
                    .map(k => {
                        console.log(`[SW] Elimino cache vecchia: ${k}`);
                        return caches.delete(k);
                    })
            )
        ).then(() => self.clients.claim()) // Prendi controllo subito
    );
});

// --- FETCH: Strategia per tipo di risorsa ---
self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    const request = event.request;

    // 1. Solo GET
    if (request.method !== 'GET') return;

    // 2. Mai cachare API e servizi esterni
    if (NO_CACHE_PATTERNS.some(p => url.includes(p))) return;

    // 3. Pagine HTML → Network-First (prova server, fallback cache)
    if (request.mode === 'navigate' || url.endsWith('.html')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // 4. Assets statici → Cache-First + background update
    const urlObj = new URL(url);
    const isCacheable = CACHEABLE_EXTENSIONS.some(ext => urlObj.pathname.endsWith(ext));
    
    if (isCacheable) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // 5. Tutto il resto → Network normale
});

// --- STRATEGIE ---

// Cache-First: risponde dalla cache, aggiorna in background (stale-while-revalidate)
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    // Aggiornamento in background (non blocca la risposta)
    const networkUpdate = fetch(request).then(response => {
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => null);

    // Se abbiamo la cache, rispondi subito
    if (cached) return cached;

    // Altrimenti aspetta il network
    const response = await networkUpdate;
    return response || new Response('Offline', { status: 503 });
}

// Network-First: prova il server, fallback alla cache
async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (e) {
        const cached = await cache.match(request);
        return cached || new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

// --- MESSAGGI: Permette al frontend di forzare aggiornamenti ---
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('[SW] Cache svuotata su richiesta');
        });
    }
});
