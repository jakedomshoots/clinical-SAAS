"""Progressive Web App manifest and service worker for mobile support.

Provides offline capability, home screen installation, and
native-app-like experience without building a separate iPad app.
"""

from __future__ import annotations

from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/pwa", tags=["PWA"])


MANIFEST = {
    "name": "Concierge OS",
    "short_name": "Concierge",
    "description": "Clinical practice management system",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#2563eb",
    "orientation": "portrait-primary",
    "icons": [
        {"src": "/icon-72x72.png", "sizes": "72x72", "type": "image/png"},
        {"src": "/icon-96x96.png", "sizes": "96x96", "type": "image/png"},
        {"src": "/icon-128x128.png", "sizes": "128x128", "type": "image/png"},
        {"src": "/icon-144x144.png", "sizes": "144x144", "type": "image/png"},
        {"src": "/icon-152x152.png", "sizes": "152x152", "type": "image/png"},
        {"src": "/icon-192x192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "/icon-384x384.png", "sizes": "384x384", "type": "image/png"},
        {"src": "/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
    ],
    "categories": ["medical", "productivity", "business"],
    "screenshots": [
        {"src": "/screenshot-1.png", "sizes": "1280x720", "type": "image/png", "form_factor": "wide"},
        {"src": "/screenshot-2.png", "sizes": "1280x720", "type": "image/png", "form_factor": "wide"},
        {"src": "/screenshot-mobile.png", "sizes": "750x1334", "type": "image/png", "form_factor": "narrow"},
    ],
    "shortcuts": [
        {"name": "Schedule", "short_name": "Schedule", "description": "View today's schedule", "url": "/scheduling", "icons": [{"src": "/icon-schedule.png", "sizes": "96x96"}]},
        {"name": "Patients", "short_name": "Patients", "description": "Search patients", "url": "/patients", "icons": [{"src": "/icon-patients.png", "sizes": "96x96"}]},
        {"name": "Tasks", "short_name": "Tasks", "description": "View tasks", "url": "/tasks", "icons": [{"src": "/icon-tasks.png", "sizes": "96x96"}]},
    ],
    "related_applications": [],
    "prefer_related_applications": False,
}


SERVICE_WORKER = """
const CACHE_NAME = 'concierge-os-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.js',
  '/static/css/main.css',
  '/icon-192x192.png',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful API responses for offline
        if (response.ok && event.request.url.includes('/api/')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Return offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-forms') {
    event.waitUntil(syncPendingForms());
  }
});

async function syncPendingForms() {
  const db = await openDB('concierge-os', 1);
  const pending = await db.getAll('pendingForms');
  for (const form of pending) {
    try {
      await fetch(form.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.data),
      });
      await db.delete('pendingForms', form.id);
    } catch (err) {
      console.error('Sync failed for form', form.id, err);
    }
  }
}
"""


@router.get("/manifest.json")
async def pwa_manifest() -> JSONResponse:
    """Serve the PWA manifest."""
    return JSONResponse(content=MANIFEST)


@router.get("/service-worker.js")
async def service_worker() -> Response:
    """Serve the service worker."""
    return Response(
        content=SERVICE_WORKER,
        media_type="application/javascript",
        headers={"Service-Worker-Allowed": "/"},
    )
