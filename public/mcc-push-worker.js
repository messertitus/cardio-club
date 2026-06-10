const MCC_CACHE_VERSION = "mcc-pwa-v1";
const MCC_APP_SHELL = ["/", "/manifest.webmanifest", "/mcc-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(MCC_CACHE_VERSION)
      .then((cache) => cache.addAll(MCC_APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== MCC_CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(MCC_CACHE_VERSION).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/") || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(MCC_CACHE_VERSION).then((cache) => cache.put(request, copy));
        }

        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() ?? {
    title: "Messers Cardio Club",
    body: "Es gibt ein Update zu deinem nächsten Event.",
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Messers Cardio Club", {
      body: payload.body ?? "Es gibt ein neues Update.",
      data: payload.data ?? {},
      tag: payload.tag ?? "mcc-event-update",
      renotify: true,
      icon: "/mcc-icon.png",
      badge: "/mcc-icon.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client && href !== "/") {
            client.navigate(href).catch(() => {});
          }
          return client.focus();
        }
      }

      return clients.openWindow(href);
    }),
  );
});