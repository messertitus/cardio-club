// Kill-switch service worker.
//
// The PWA used to live on the apex (messers-cardio-club.com) and registered a
// service worker at THIS path with scope "/". The app has since moved to
// app.messers-cardio-club.com and the apex now serves the static landing page.
//
// Browsers that visited the old app still have that worker active and keep
// serving the cached app shell. A 404 here does NOT remove it — so we ship this
// no-op worker instead. When the stale worker runs its periodic update check it
// fetches this file, sees new bytes, installs + activates it, and this code then
// deletes every cache, unregisters itself, and reloads open tabs. After that the
// apex is plain static HTML again, with no worker in the way.
//
// Safe to keep forever: on a browser that never had the old worker this just
// installs, clears nothing, unregisters, and disappears.

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      } catch (e) {
        // ignore — clearing caches is best-effort
      }

      try {
        await self.registration.unregister();
      } catch (e) {
        // ignore
      }

      // Force every controlled tab to reload so it picks up the live landing
      // page from the network instead of the dead cache.
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach(function (client) {
          client.navigate(client.url);
        });
      } catch (e) {
        // ignore — next manual navigation will load fresh anyway
      }
    })()
  );
});

// Never serve from cache: always hit the network. Belt-and-suspenders in case a
// fetch happens in the window before unregister() takes effect.
self.addEventListener("fetch", function (event) {
  event.respondWith(fetch(event.request));
});
