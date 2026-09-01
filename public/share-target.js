/*
 * Web Share Target — the phone half of the Chrome capture extension.
 *
 * The extension writes a bundle to a synced folder on the laptop. On the phone
 * that file is shared into Blatt from Drive or Files, and Android POSTs it
 * here as multipart form data. A POST cannot be handled by a page, so the
 * service worker takes it: it parks the text in a cache and redirects to
 * /import, which picks it up and restores it.
 *
 * This file is imported into the generated Workbox worker (see
 * workbox.importScripts in vite.config.ts), so the listener below is
 * registered before Workbox's own. Workbox only routes GET, so there is no
 * contest over the POST.
 */

const SHARE_CACHE = 'blatt-share';
const SHARE_KEY = '/shared-capture';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return;

  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const file = form.get('file');
        if (!file || typeof file === 'string') {
          return Response.redirect('/import?shared=empty', 303);
        }

        const cache = await caches.open(SHARE_CACHE);
        await cache.put(
          SHARE_KEY,
          new Response(await file.text(), {
            headers: { 'Content-Type': 'application/json' },
          }),
        );
        return Response.redirect('/import?shared=1', 303);
      } catch {
        // The file never reached the cache, so /import has nothing to find.
        return Response.redirect('/import?shared=failed', 303);
      }
    })(),
  );
});
