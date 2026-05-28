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
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }

      return clients.openWindow("/");
    }),
  );
});
