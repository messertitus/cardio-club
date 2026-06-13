# PWA-Updatefähigkeit – wie Änderungen bei installierten Apps ankommen

Ziel: Nutzer installieren **Messers Cardio Club** einmal als PWA und müssen nie
neu installieren. Neue Deployments, Inhalte und Konfigurationen erreichen die
installierte App automatisch.

## Wie gebaut, ausgeliefert und aktualisiert wird

- **Build/Export:** `npm run export:web` (Expo Router, Metro) → statisches `dist/`.
  JS-Bundles sind **gehasht** (`entry-<hash>.js`), d. h. jede neue Version hat
  neue Dateinamen → kein Versehen-Caching alter Bundles.
- **App-Shell:** `app/+html.tsx` erzeugt `dist/index.html`. (`public/index.html`
  ist ein ungenutztes Relikt – der Router-Export nutzt `+html.tsx`.)
- **Service Worker:** `public/mcc-push-worker.js`, registriert über
  `public/pwa-register.js`. Strategie: **network-first** für Navigationen **und**
  Assets – online wird immer das neueste Bundle geladen, der Cache dient nur als
  Offline-Fallback. `skipWaiting()` + `clients.claim()` → ein neuer SW wird sofort
  aktiv. `MCC_CACHE_VERSION` beim Aktivieren räumt alte Caches weg.
- **Manifest:** `public/manifest.webmanifest` (`start_url: /`, `display: standalone`).

**Folge:** Eine installierte PWA bekommt neue Deployments beim nächsten
Kaltstart/Reload automatisch (network-first). Eine Neuinstallation ist nicht nötig.

## Update-Erkennung (dezent, nie aufdringlich)

- `pwa-register.js` erkennt einen neuen SW (`updatefound` → `installed` bei
  vorhandenem Controller, sowie `controllerchange`) und feuert das Fenster-Event
  `mcc:update-ready`. Zusätzlich wird bei Fokuswechsel und alle 30 min
  `registration.update()` aufgerufen, damit neue Deployments zeitnah erkannt werden.
- `src/components/UpdateBanner.tsx` zeigt daraufhin einen dezenten Hinweis
  „Neue Version verfügbar – Aktualisieren". **Kein Auto-Reload** – der Reload
  passiert nur per Tipp des Nutzers, also nie mitten in Abstimmung/Formular.

## Lokale Caches & Cache-Schema-Version

- `src/services/localCache.ts` speichert kurzlebige Daten (Events, Chat, Sport-
  Listen) mit TTL.
- `src/lib/appInfo.ts` definiert `CACHE_SCHEMA_VERSION`. Beim App-Start ruft
  `app/_layout.tsx` `purgeAppCachesIfOutdated()` auf: ändert sich die Version,
  werden **alle managed Data-Caches** (`mcc.cache.*`, `mcc.weekEvents.*`,
  `mcc.chat.*`) verworfen. Nutzer-Präferenzen (`mcc.theme`, `mcc.introSeen.*`,
  `mcc.installHint.*`) und Supabase-Auth-Tokens bleiben erhalten.

➡️ **Regel:** Wenn sich die **Form** lokal gecachter Daten ändert →
`CACHE_SCHEMA_VERSION` in `appInfo.ts` erhöhen. Dann lesen neue Builds nie alte,
falsch geformte Daten.

## Was bereits datengetrieben ist (ohne Code-Deploy änderbar)

Über Supabase + Admin-Menü pflegbar – **kein** App-Update nötig:

- Sportarten, Sportprofile/Standorte, Ansprechpartner
- Aktive Städte, Eventtage & Uhrzeiten
- Mitglieder/Rollen, Einladungscodes
- **Benachrichtigungs-Regeln** inkl. der eingebauten System-Benachrichtigungen
  (an/aus + Text editierbar; `notification_rules`)

## Was noch hardcoded ist (ändern = Code-Deploy, aber **keine** Neuinstallation)

Selten geändert, daher bewusst im Code belassen:

- Anleitungstexte (`app/install.tsx`), Onboarding/Tour (`TourGuide`)
- PWA-/Push-Hinweis-Texte (`InstallHintCard`)
- Statische UI-Labels, Default-Sportkategorien

Diese Änderungen kommen über ein normales Deployment bei der installierten PWA an
(network-first) – nur eben mit Code-Release.

## Empfohlener Ausbaupfad (Remote Config / App Settings)

Wenn häufige Text-/Flag-Änderungen ohne Deploy gewünscht sind, eine schlanke
`app_settings`-Tabelle (key/value/jsonb, Admin-RLS) einführen und damit z. B.
Wartungs-/Ankündigungs-Banner, Onboarding-Texte oder Feature-Flags steuern. Muster
existiert bereits über `notification_rules`. **Bewusst noch nicht gebaut**, da für
die Updatefähigkeit nicht zwingend nötig.

## Entwickler-Regeln (damit niemand neu installieren muss)

1. **Service Worker network-first lassen.** Keine cache-first-Strategie für
   `index.html` oder JS-Bundles.
2. **Assets gehasht ausliefern** (Standard bei `expo export`). Keine
   unversionierten, langlebig gecachten Assets mit gleichem Namen.
3. Bei Datenmodell-Änderungen, die lokale Caches betreffen:
   `CACHE_SCHEMA_VERSION` erhöhen.
4. Bei SW-Logik-Änderungen: `MCC_CACHE_VERSION` in `mcc-push-worker.js` erhöhen.
5. Services defensiv halten: optionale Felder mit `?.`/`coalesce`, alte Caches
   dürfen neue Felder nicht voraussetzen.
6. `APP_VERSION` (`appInfo.ts`) synchron mit `app.json`/`package.json` halten.
7. Niemals Secrets/Service-Role-Keys ins Frontend. Admin-Aktionen über
   `security definer`-RPCs mit `is_admin_user`-Check.
8. Kein Auto-Reload erzwingen – Updates immer über den dezenten Banner anbieten.
