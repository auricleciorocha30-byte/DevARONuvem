// Service Worker para PWA DevARONuvem
const CACHE_NAME = 'devaro-pwa-v7';
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png'
];

function buildDynamicManifest(url) {
  const type = (url.searchParams.get('type') || '').toLowerCase();
  const loja = (url.searchParams.get('loja') || '').trim();
  const lojaQuery = loja ? `&loja=${encodeURIComponent(loja)}` : '';
  const lojaHashQuery = loja ? `?loja=${encodeURIComponent(loja)}` : '';

  let name = loja ? `DevARONuvem - ${loja}` : 'DevARONuvem - Gestão & PDV';
  let short_name = 'DevARO';
  let start_url = loja ? `/?loja=${encodeURIComponent(loja)}` : '/';
  let appId = loja ? `/app-${encodeURIComponent(loja)}` : '/';

  if (type === 'pdv') {
    name = loja ? `PDV - ${loja}` : 'PDV Frente de Caixa';
    short_name = 'PDV';
    start_url = `/?type=pdv${lojaQuery}#/pdv${lojaHashQuery}`;
    appId = loja ? `/pdv-${encodeURIComponent(loja)}` : '/pdv';
  } else if (type === 'atendente' || type === 'atendimento') {
    name = loja ? `Atendimento - ${loja}` : 'Painel Atendente';
    short_name = 'Atendente';
    start_url = `/?type=atendente${lojaQuery}#/atendimento${lojaHashQuery}`;
    appId = loja ? `/atendente-${encodeURIComponent(loja)}` : '/atendente';
  } else if (type === 'entregador' || type === 'entregas') {
    name = loja ? `Entregas - ${loja}` : 'Painel Entregas';
    short_name = 'Entregas';
    start_url = `/?type=entregador${lojaQuery}#/entregas${lojaHashQuery}`;
    appId = loja ? `/entregas-${encodeURIComponent(loja)}` : '/entregas';
  } else if (type === 'cardapio') {
    name = loja ? `Cardápio - ${loja}` : 'Cardápio Digital';
    short_name = 'Cardápio';
    start_url = `/?type=cardapio${lojaQuery}#/cardapio${lojaHashQuery}`;
    appId = loja ? `/cardapio-${encodeURIComponent(loja)}` : '/cardapio';
  } else if (type === 'cozinha' || type === 'producao') {
    name = loja ? `Produção - ${loja}` : 'Painel de Produção';
    short_name = 'Produção';
    start_url = `/?type=cozinha${lojaQuery}#/cozinha${lojaHashQuery}`;
    appId = loja ? `/cozinha-${encodeURIComponent(loja)}` : '/cozinha';
  } else if (type === 'tv') {
    name = loja ? `Painel TV - ${loja}` : 'Painel TV';
    short_name = 'Painel TV';
    start_url = `/?type=tv${lojaQuery}#/tv${lojaHashQuery}`;
    appId = loja ? `/tv-${encodeURIComponent(loja)}` : '/tv';
  }

  return {
    id: appId,
    name,
    short_name,
    description: `Aplicativo oficial ${name}.`,
    start_url,
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#001F3F',
    orientation: 'any',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ],
    shortcuts: [
      { name: 'PDV Frente de Caixa', short_name: 'PDV', url: `/?type=pdv${lojaQuery}#/pdv${lojaHashQuery}`, icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Atendimento', short_name: 'Atendimento', url: `/?type=atendente${lojaQuery}#/atendimento${lojaHashQuery}`, icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Entregas', short_name: 'Entregas', url: `/?type=entregador${lojaQuery}#/entregas${lojaHashQuery}`, icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Cardápio Digital', short_name: 'Cardápio', url: `/?type=cardapio${lojaQuery}#/cardapio${lojaHashQuery}`, icons: [{ src: '/icon-192.png', sizes: '192x192' }] }
    ]
  };
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache addAll warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Serve dynamic manifest directly for any module type (PDV, Atendente, Entregas, Cardápio, Cozinha, TV)
  if (url.pathname === '/manifest.json' || url.pathname === '/api/manifest') {
    const manifestObj = buildDynamicManifest(url);
    event.respondWith(
      new Response(JSON.stringify(manifestObj), {
        status: 200,
        headers: {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      })
    );
    return;
  }

  // Skip APIs, WebSockets, and all Vite dev resources
  if (
    url.pathname.startsWith('/api') || 
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts')
  ) {
    return;
  }

  // Always fetch fresh HTML for navigation requests to avoid stale cached index.html
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Network First, with cache fallback for static icons
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
