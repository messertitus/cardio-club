(function () {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/mcc-push-worker.js").catch(function (error) {
      console.warn("MCC PWA Service Worker konnte nicht registriert werden.", error);
    });
  });
})();