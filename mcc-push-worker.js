self.addEventListener("push", (event) => {
  const payload = event.data?.json?.() ?? {
    title: "Messers Cardio Club",
    body: "Es gibt ein Update zu deinem nächsten Event.",
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Messers Cardio Club", {
      body: payload.body ?? "Es gibt ein neues Update.",
      icon: "/assets/mcc-logo.png",
      badge: "/assets/mcc-logo.png",
      data: payload.data ?? {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
