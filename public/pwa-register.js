(function () {
  if (!("serviceWorker" in navigator)) return;

  function emitUpdateReady() {
    try {
      window.dispatchEvent(new CustomEvent("mcc:update-ready"));
    } catch (error) {
      // CustomEvent unavailable (very old browser) — ignore; reload still works.
    }
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("/mcc-push-worker.js")
      .then(function (registration) {
        // A newer service worker was found. Once it finishes installing while an
        // old one still controls the page, a new version is ready to use. We only
        // surface a hint (no auto-reload) — see UpdateBanner.
        registration.addEventListener("updatefound", function () {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", function () {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              emitUpdateReady();
            }
          });
        });

        // Proactively look for a new deployment when the app regains focus and
        // periodically, so an installed PWA picks up updates without the user
        // doing a manual hard refresh.
        function checkForUpdate() {
          registration.update().catch(function () {});
        }
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible") checkForUpdate();
        });
        setInterval(checkForUpdate, 30 * 60 * 1000);
      })
      .catch(function (error) {
        console.warn("MCC PWA Service Worker konnte nicht registriert werden.", error);
      });
  });

  // If the controlling worker changes after the initial load (the new SW used
  // skipWaiting), that also means a fresh version is live. Guard the very first
  // install so we don't show an update hint on a brand-new installation.
  var hadController = navigator.serviceWorker.controller != null;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (hadController) emitUpdateReady();
    hadController = true;
  });
})();
