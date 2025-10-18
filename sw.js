// This service worker is used to enable cross-origin isolation,
// which is required for WebContainer to use SharedArrayBuffer.
self.addEventListener('install', (event) => {
  // Activate the new service worker as soon as it's installed.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Take control of all clients as soon as the service worker is activated.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // We only need to modify the headers for navigation requests (i.e., the main document).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        // Clone the response to modify its headers.
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
        newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      })
    );
  }
});
