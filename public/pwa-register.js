(function () {
  if (!("serviceWorker" in navigator)) return;

  // Was the page already controlled by a service worker when it first loaded?
  // Captured ONCE, before the worker can skipWaiting()/claim() the page. If it
  // was not controlled at start, this is a brand-new install — never a "new
  // version available" situation. Using the live navigator.serviceWorker.
  // controller instead would misfire on first install, because the fresh SW
  // claims the page before its "installed" state fires.
  var controlledAtStart = navigator.serviceWorker.controller != null;

  function emitUpdateReady() {
    if (!controlledAtStart) return; // first install → no update hint, ever
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
        // A newer service worker was found and finished installing while a
        // previous one already controlled the page → a new version is ready.
        registration.addEventListener("updatefound", function () {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", function () {
            if (installing.state === "installed") {
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

  // A controller change after the page was already controlled means the fresh SW
  // (skipWaiting) is now live. emitUpdateReady() self-guards the first install.
  navigator.serviceWorker.addEventListener("controllerchange", emitUpdateReady);
})();
