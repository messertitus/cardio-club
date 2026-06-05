import { ScrollViewStyleReset } from "expo-router/html";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" translate="no" className="notranslate">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="google" content="notranslate" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#05070b" />
        <meta name="color-scheme" content="dark" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MCC" />
        <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
        <meta name="application-name" content="Messers Cardio Club" />
        <meta name="description" content="Messers Cardio Club als installierbare Web-App." />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link id="mcc-favicon" rel="icon" type="image/png" href="/assets/mcc-logo-white-symbol-transparent.png" />
        <link rel="icon" type="image/png" href="/assets/mcc-logo-black-symbol-transparent.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/assets/mcc-logo-white-symbol-transparent.png" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/mcc-logo.png" />        <script src="/pwa-register.js" defer />
        <script dangerouslySetInnerHTML={{ __html: FAVICON_THEME_SCRIPT }} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: WEB_RESET }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const WEB_RESET = `
  html, body, #root {
    background: #05070b;
    overscroll-behavior: none;
    -webkit-text-size-adjust: 100%;
    touch-action: manipulation;
  }

  body {
    min-height: 100dvh;
  }

  input, textarea, select, button {
    font-size: 16px !important;
  }

  * {
    -webkit-tap-highlight-color: transparent;
  }
`;

const FAVICON_THEME_SCRIPT = `
  (function () {
    var darkIcon = "/assets/mcc-logo-white-symbol-transparent.png";
    var lightIcon = "/assets/mcc-logo-black-symbol-transparent.png";
    var query = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");

    function setFavicon() {
      var link = document.getElementById("mcc-favicon");
      if (!link) return;
      link.setAttribute("href", query && query.matches ? darkIcon : lightIcon);
    }

    setFavicon();
    if (query && query.addEventListener) {
      query.addEventListener("change", setFavicon);
    } else if (query && query.addListener) {
      query.addListener(setFavicon);
    }
  })();
`;