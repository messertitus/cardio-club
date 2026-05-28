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
