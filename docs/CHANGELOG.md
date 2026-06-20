# Doku-Changelog

Chronologisches Protokoll dokumentierter Änderungen am **Stand der App** und an
dieser Dokumentation. **Neuestes oben.** Entferntes wird unter `Entfernt`
ausdrücklich festgehalten (nichts verschwindet stillschweigend).

Format je Eintrag: `## YYYY-MM-DD — Titel` mit Abschnitten
`Hinzugefügt` / `Geändert` / `Behoben` / `Entfernt` / `Doku` (nur was zutrifft).

---

## 2026-06-20 — Landing: Karte/Liste/Footer überarbeitet + mehr Kreativ-Details

### Geändert
- **Standortliste vereinfacht:** statt Akkordeon nun klare **Stadtteil-Pills**; Hover/Tap auf eine Pill hebt die zugehörigen Kartenpunkte hervor (`.st-hi`). Karte bleibt interaktiv (Klick auf Punkt → Tooltip).
- **Karte größer + mehr Umrisse:** Ausschnitt nach Westen erweitert (Reichenau, Allensbach, Untersee sichtbar), 6 Gemeinde-Umrisse (Konstanz, Kreuzlingen, Reichenau, Allensbach, Bottighofen, Gottlieben; 4 beschriftet), breitere Karten-Spalte.
- **Beispiel als eigenes Element:** Flow-Diagramm (3 Sport-Icons → Standort „Strandbad Horn") statt einer zweiten Karte wie der Join-Block.
- **Abstände:** Puls (EKG) enger an die Sektionen gezogen, Header→Inhalt etwas kompakter.
- **Footer:** großes weißes Logo **mittig zentriert**, Navigation und Copyright darunter zentriert.
- **Stadtteil-Korrektur:** Humboldt→Altstadt, Schänzlepark→Paradies, Herosee→Petershausen (alle 14 geprüft).

### Hinzugefügt
- Mehr Kreativ-Details: **Scroll-Fortschrittsleiste**, animierter Flow-Pfeil; dazu die bestehenden Orbs/EKG/Reveals/Count-up/Spotlight/Shimmer.

### Behoben
- Mobile-Overflow im Hero (4 Kennzahlen erzwangen Überbreite) — Stats brechen jetzt um, `hero-copy: min-width 0`. Kein horizontaler Overflow bei 375 px.

---

## 2026-06-20 — Landing: vollständige EN-Version + Server-Rollout vorbereitet

### Hinzugefügt
- **Englische Versionen** für FAQ, Impressum und Datenschutz. Prosa-Seiten nutzen ganze DE/EN-Blöcke (`data-lang-only`), die `lang.ts` umschaltet; die Startseite war bereits über `data-i18n` zweisprachig. Damit schaltet der Header-Switch die **gesamte Seite** DE↔EN.
- **Server-Rollout vorbereitet** (`deploy/`): versionierte nginx-Configs `landing.conf` (Apex + www → `/var/www/landing`) und `app.conf` (`app.`-Subdomain → bestehendes `/var/www/messers-cardio-club`), ein `_project-template.conf` für weitere Projekte sowie `deploy-landing.sh` / `deploy-app.sh`.
- `docs/deployment-ubuntu.md` zum vollständigen **Multi-Site-Runbook** umgeschrieben (DNS, .env, Build/Publish, nginx-Umstellung von Apex→App-Subdomain, certbot je Domain, Supabase-Redirect-URL, Verify-Checkliste, Update-Flow, neues Projekt).

### Behoben
- `data-lang-only`-Umschaltung: gewählter Block muss explizit `display:block` setzen (nicht `''`), sonst greift die Default-`en→none`-Regel und es bleibt leer.

---

## 2026-06-20 — Landing: großes FAQ, größere Karte, mehr Kreativ-Details

### Hinzugefügt
- **FAQ stark ausgebaut:** 45 Fragen in 7 Kategorien (Allgemein, Mitgliedschaft & Warteliste, Ablauf & Cardiotag, Fairness & Algorithmus, Technik & App, Datenschutz & Rechtliches, Sonstiges) als aufklappbares Akkordeon.
- **Mehr Kreativ-Details:** Cursor-Spotlight-Glow auf allen Karten (Event-Delegation, übersteht Live-Re-Render) + sanfter **Gradient-Shimmer** auf der Hero-Überschrift.

### Geändert
- Invite-Pill-Text → „**Start steht bevor — sichere dir deinen Platz**".
- **Karte vergrößert** (Hero-Grid: Karten-Spalte breiter).
- **Puls-Padding reduziert** (EKG-Linie sitzt enger).
- 4. Keyzahl-Label „Cardiotage/Wo." → „**Tage/Woche**".
- Footer-Tagline: „auf Einladung" entfernt → „Konstanz · Bodensee".

---

## 2026-06-20 — Landing: DE/EN-Switch, „Wow"-Redesign, Feinschliff

### Hinzugefügt
- **DE/EN-Sprachumschalter** (Header-Pill). Client-seitig über ein Wörterbuch (`src/i18n/strings.ts`) + `src/scripts/lang.ts`: tauscht alle `data-i18n`-Texte und Platzhalter, persistiert die Wahl, setzt `<html lang>`; dynamische Strings (Tooltip, Warteliste-Meldungen) in `live.ts` sind sprach-bewusst. Deutsch ist Default/SSR.
- **Signatur-„Wow"-Elemente:** driftende Aurora-Orbs im Hintergrund, eine animierte **EKG-/Puls-Linie** als Sektions-Signatur, **Scroll-Reveals** (IntersectionObserver) und **Count-up-Zahlen** (`src/scripts/reveal.ts`), Button-Shimmer, neue premium **Sport-Kacheln** (Icon-Badge + Glow).

### Geändert
- **Stadtteil-Zuordnung korrigiert:** Humboldt→Altstadt, Schänzlepark→Paradies, Herosee→Petershausen (alle 14 geprüft).
- **Hero:** Invite-Pill neu („Exklusiv auf Einladung — der öffentliche Start folgt"); die **aktiven Cardiotage/Woche** sind jetzt die **4. Keyzahl** (eigene Events-Zeile entfernt).
- **Karten-Tooltip:** nur noch Name + Sportarten (kein „Konstanz · Bodensee" mehr).
- **Footer:** volles **weißes Logo mit Wortmarke** als Bild.
- **Datenschutz** deutlich ausgebaut (u. a. Warteliste-Verarbeitung Name/Telefon, Auftragsverarbeiter, Speicherdauer, Rechte, Aufsichtsbehörde LfDI BW).

### Behoben
- **Live-gerenderte Elemente waren ungestylt:** Astro-*scoped* CSS greift nicht auf von `live.ts` neu erzeugte Knoten (Sport-Kacheln, Kartenpunkte, Stadtteil-Chips). Die betroffenen Regeln liegen jetzt in `global.css`.

---

## 2026-06-20 — Landing: Warteliste, Stadtteil-Liste, Header/Footer-Feinschliff

### Hinzugefügt
- **Warteliste / „Einladungscode anfragen":** Hero-CTA öffnet einen Dialog (Name + Telefonnummer). Einträge landen über die abgesicherte RPC `request_invite` in einer neuen `waitlist`-Tabelle (Migration `071`); ein Admin sichtet und verschickt Codes. Anonyme haben keinen direkten Tabellenzugriff.
- **Standortliste nach Stadtteilen gruppiert** (`src/lib/stadtteile.ts`): jeder Standort wird einem Konstanzer/Kreuzlinger Stadtteil zugeordnet (Namens-Override + nächstgelegenes Zentrum aus OSM-Daten); die ausklappbare Liste zeigt jetzt „N Standorte in M Stadtteilen". Kartenpunkte per **Klick/Tap** → Tooltip.
- Footer trägt jetzt **Logo + Wortmarke**.

### Geändert
- **Header-Buttons:** oben rechts wieder „**Zur App**", links daneben dezenter „**FAQ**"-Link.
- **Hero:** „Standorte ansehen" entfernt; primärer CTA ist „**Einladungscode anfragen**" (Warteliste). Unter dem „bald geöffnet"-Hinweis platziert.
- **Sportarten wieder vollständig:** die Liste zeigt wieder **alle aktiven** Sportarten des Pools (Laufen/Radfahren etc. sind zurück) statt nur der standort-gebundenen.
- **Cardiotag-Anzeige:** „Aktuell N Cardiotage die Woche" — aus `mcc_event_days` (wöchentlicher Rhythmus) statt offener Event-Zählung (Migration `072`, ersetzt `events_upcoming`).
- **Mobile-Reihenfolge der Startseite:** zuerst Überschrift + Keyzahlen, dann die Karte (vorher Karte zuerst).

### Entfernt
- **Alle Verlinkungen/Erwähnungen von `/vision`** (Footer, FAQ). Die Seite bleibt erreichbar, ist aber **geheim**: `noindex` + nirgends verlinkt.

### Migration
- **`071_waitlist.sql`** — `waitlist`-Tabelle (RLS, nur Admin-Lesen) + `request_invite(name, phone, note)` (SECURITY DEFINER, `anon` execute).
- **`072_landing_stats_weekly_cardiotage.sql`** — RPC liefert `weekly_cardiotage` (aus `mcc_event_days`) statt `events_upcoming`.

---

## 2026-06-20 — Landing: Echtzeit-Daten, Stadt-Karte, Vision & Rechtsseiten

### Hinzugefügt
- **`/vision`** — die ursprüngliche „Eine Stadt nach der anderen"-Idee als eigene Seite: Deutschland-Karte (`GermanyMap.astro`) mit leuchtenden Stadt-Punkten, Konstanz als hellem Ursprung. Bewusst von der Startseite getrennt (kein interner Plan auf der Hauptseite).
- **Rechts-/Infoseiten:** `/faq` (echte Q&A zu Club, Cardiotag, Fairness, Standorten), `/impressum`, `/datenschutz`. Im Footer verlinkt. **Impressum + Datenschutz enthalten Platzhalter `[…]`, die der Betreiber vor Live-Gang ausfüllen muss** (Pflichtangaben nach DDG/DSGVO); Datenschutz weist auf Self-Hosting der Schriftart hin (Google-Fonts-Übermittlung vermeiden).
- **Stadt-Umrisse Konstanz + Kreuzlingen** auf der Bodensee-Karte (OSM-Grenzen, gestrichelt) zur Orientierung. `cities.geo.json`.

### Geändert
- **Daten sind jetzt echtzeit:** `src/scripts/live.ts` holt die RPC bei **jedem Seitenaufruf** clientseitig und rendert Stats, Sportarten, Kartenpunkte und Standortliste neu. Der statische Build dient nur noch als Sofort-Anzeige/Fallback. (Projektion-Parameter werden mitgegeben, `lib/geo.ts` exportiert `proj`.)
- **Nur tatsächlich angebotene Sportarten:** Die Liste wird aus den Standorten abgeleitet (`offeredSports`) — Sportarten ohne Standort (z. B. Hiking) erscheinen nicht mehr.
- **Cardiotag-Anzahl live:** Hero-Copy ohne feste „ein Termin pro Woche"-Behauptung; stattdessen Live-Zeile „Gerade N Cardiotage in Planung" (mint Live-Punkt).
- **Standortliste als ausklappbares Detail** statt langer Liste unter der Karte (`<details>`, „N Standorte … Liste anzeigen"); Kartenpunkte sind jetzt auch per Tap (mobil) bedienbar.
- **Mobile-Responsiveness** geprüft/gefixt (u. a. Header-CTA „Code einlösen" statt Langform, Brand-Text ab < 430 px ausgeblendet); kein horizontaler Overflow auf allen Seiten bei 375 px.

### Migration
- **`070_landing_stats_events.sql`** — RPC um `events_upcoming` (aktive `weekly_events` in `proposing`/`voting`/`decided`) erweitert.

---

## 2026-06-19 — Öffentliche Landingpage (`landing/`, Astro)

### Hinzugefügt
- **Neues Sub-Projekt `landing/`** (Astro, statischer Export) für die öffentliche Marketing-Seite. Getrennt von der App: Die Landingpage kommt auf die Root-Domain `messers-cardio-club.com`, die App zieht auf `app.messers-cardio-club.com` um (Subdomain-Split, je eigener nginx-`server`-Block + Cert). Architektur-Entscheidung im Memory `multi-site-architecture`.
- **Interaktive Bodensee-Karte** (`src/components/RegionMap.astro`): echte Bodensee-Wassergeometrie aus OpenStreetMap (Inseln wie Mainau/Reichenau als Polygon-Löcher), auf den Konstanzer Trichter gecroppt. Leuchtende Standort-Punkte nur an erfassten Sport-Standorten; Größe/Helligkeit datengetrieben nach Anzahl der Sessions. Hover/Fokus-Tooltips + Legenden-Chips mit Cross-Highlight, tastaturbedienbar, respektiert `prefers-reduced-motion`.
- **Datengetriebene Inhalte** aus eigenen JSON-Dateien: `data/venues.json` (Standorte), `data/sports.json` (10 Sportarten aus dem Katalog), `data/club.json` (aggregierte, PII-freie Kennzahlen; `members` vorerst manuell). Spiegeln die App-Daten; spätere Anbindung an eine öffentliche Supabase-View vorgesehen.
- Projektions-Helfer `src/lib/geo.ts` (eigene Mercator-Projektion, optionaler fixer Viewport-Crop) — Karte und Punkte teilen dieselbe Transformation.
- Messaging bewusst „invite-only": „Bald für alle geöffnet — aktuell nur mit Einladungscode". Keine internen Pläne öffentlich (Tagline „Eine Stadt nach der anderen" bewusst weggelassen).
- **„So funktioniert's"-Sektion** (4 Schritte) und echtes MCC-Logo im Header (`public/brand/`, weiße Symbol-Variante).
- **Live-Daten beim Build:** `src/lib/clubData.ts` zieht die öffentliche RPC `landing_public_stats` anonym und füllt Mitgliederzahl, aktive Sportarten und Standorte (Punkte) live. Best-effort mit Fallback auf die committeten JSONs, wenn Env fehlt, Netz/RPC nicht erreichbar oder noch keine Venues existieren → Build bleibt offline-fest. Konfiguration über `landing/.env` (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`; nur Publishable-Key, Build-Zeit).

### Geändert
- **Landing an die App angeglichen** (Stil, Inhalt, Technik), nachdem die App-Quelle ausgewertet wurde:
  - **Palette = App-Dark-Theme-Tokens** (`theme.mcc.*`): Akzent `#4DA3FF`, Primär `#1677FF`, Mint `#5EEAD4`, Text `#F7FBFF/#A7B4C7`, Linien `rgba(255,255,255,.12)`. Buttons auf 16 px Radius + fett (800/900) wie `MccButton`.
  - **Echte Icons statt Emojis:** `@mdi/js` rendert dieselben MaterialCommunityIcons wie die App (`SportIcon`/`SPORT_ICON_OPTIONS`) — z. B. `run`, `swim`, `boxing-glove`, `volleyball`, `soccer`, `hiking`, `rowing`, `basketball`, `bike`. Neue `Icon.astro` + `src/lib/icons.ts`.
  - **App-Terminologie & -Stimme:** „Cardiotag", „Dein Teil" (Dabei? · Wunsch-Sportarten · No-Gos), „Fair statt laut" mit den echten Fairness-Faktoren (Ranked Voting, harte No-Gos, Vernachlässigungs-/Mehrheits-Schutz, Standort-Passung, parallele Gruppen) und dem Strandbad-Horn-Beispiel — übernommen aus `app/how-it-works.tsx`.
  - Kartenpunkte/See in App-Blautönen.

### Live geschaltet
- **Landing zieht jetzt echte Daten** aus der RPC: 18 Mitglieder, 13 Sportarten (inkl. Badminton, Frisbee, Tischtennis, Street-Soccer) und 14 reale Standorte (Strandbad Horn, Bolzplätze, HTWG, Klein Venedig, Schänzlepark, Workoutpark Kreuzlingen …) mit echten Koordinaten. `landing/.env` mit `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY` angelegt (Publishable-Key, gitignored).
- **Sportarten-Liste live:** Migration `069` erweitert die RPC um die aktiven Sportarten (Name + `icon_name`); `src/lib/icons.ts` portiert den vollständigen App-Icon-Resolver (`SPORT_ICON_OPTIONS`) → jede Sportart bekommt das exakte App-Icon.
- **Karten-Intensität = Anzahl Sportarten pro Standort** (statt Sessions, da der junge Club fast überall 0 Cardiotage hat → wäre uninformativ gewesen). Sessions stehen weiter im Tooltip.
- Fallback-JSONs (`data/venues.json`, `sports.json`, `club.json`) auf den echten Stand aktualisiert — auch ein Build ohne `.env` zeigt die Wahrheit.

### Migration
- **`069_landing_stats_sports.sql`** — erweitert die RPC um `sports` (aktive Sportarten mit `icon_name`). Mitgliederzahl als `count(*)-1` (Test-/Admin-Account ausgenommen).
- **`068_public_landing_stats.sql`** — neue `SECURITY DEFINER`-Funktion `public.landing_public_stats()`, `execute` an `anon`/`authenticated`. Liefert ausschließlich **PII-freie Aggregate**: Mitglieder-Headcount, Anzahl aktiver Sportarten und aktive Venues mit Koordinaten (nach `venue_group_key` gruppiert) inkl. Sportarten und Session-Anzahl. Keine Profil-, Vote-, Chat-, Attendance- oder Einladungsdaten.

### Doku
- nginx-Configs + aktualisierte `deployment-ubuntu.md` folgen mit dem Server-Rollout (noch offen).

---

## 2026-06-18 — Keine Vorschau mehr: Entscheidung läuft einmal 48 h vorher

### Geändert
- **Es gibt keine Live-Vorschau der Entscheidung mehr.** Bisher berechnete jeder Client die Entscheidung bei jedem Aufruf neu (mit Live-Wetter) — das konnte auf zwei Geräten unterschiedliche Sportarten zeigen. Jetzt läuft der Algorithmus **genau einmal, 48 h vor Eventstart**, wählt die Sport-Konstellation, persistiert sie (`status = decided`, `selected_sport_id`, `event_activities`) und **friert den `weather_snapshot` ein** → ab da auf allen Geräten identisch.
- **Auslöser (beides):** Neue Edge-Function-Action `finalize-due` (idempotent über `status in (proposing,voting)`-Guard). (1) Server-Sweep: `send-push` ruft sie bei jedem Lauf auf (unabhängig von den Push-Ruhezeiten). (2) Client-Fallback: `triggerDueFinalize()` beim Öffnen von Home/Chat (gedrosselt), falls kein Cron läuft.
- **UI ohne Vorschau:** Während der Abstimmung zeigt das Event nur einen Hinweis ("Entscheidung fällt 48 h vorher"), keine berechnete Sportart. `buildEventState` lädt die Entscheidung nur noch für `decided`/`completed`-Events. „Entschieden" heißt jetzt **persistierter Status**, nicht mehr „48h-Zeitpunkt überschritten" — betrifft `EventFlowCard`, `decision.tsx` und die Chat-Öffnung (`isEventDecisionReadyForChat`). Die „Live-Vorschau"-Karte in `vote.tsx` wurde entfernt.
- **Chats** öffnen sich wie geplant, sobald das Event `decided` ist (= nach dem 48h-Lauf).

### Hinweise
- Erfordert Deploy beider Edge-Functions (`decision`, `send-push`). Für die echte Zeitsteuerung muss `send-push` per Cron laufen; sonst greift der Client-Fallback beim App-Öffnen.

---

## 2026-06-18 — Archiv: echter Wochentag im Titel (Samstag wurde als Sonntag angezeigt)

### Behoben
- Im Event-Archiv (`app/events/history.tsx`, `app/clubs/[clubId]/history.tsx`) trug **jede** Karte den Titel „Cardiotag am Sonntag …", auch reine Samstags-Events. Ursache: der Alt-Helfer `formatCardioSunday()` (aus der Sonntag-only-Phase) snappt jedes Datum auf „den Sonntag" der Woche und erzwingt den Wochentag. Der Titel widersprach so dem korrekten „Geplant für: Samstag, … 14:00". Jetzt wird `formatEventDayDate(week_start_date, event_day)` genutzt — der echte Wochentag aus `event_day`, konsistent mit Home und Chat. Damit lösen sich auch die scheinbaren „doppelten Sonntage" auf: Es waren Samstag + Sonntag derselben Woche, beide fälschlich als Sonntag beschriftet.

---

## 2026-06-18 — Unterbesetzte Events werden wieder übersprungen (Regression)

### Behoben
- **Events mit weniger als zwei teilnehmenden Abstimmenden wurden nicht mehr abgesagt.** `cancel_underused_events()` war seit Migration 041 in den Runner `run_mcc_notification_jobs()` eingebaut, ging aber bei der Neudefinition des Runners in **053** (und erneut 063) verloren — seitdem lief der Skip nie. Folge: Ein Samstag mit nur einer Stimme/einem „Vielleicht" blieb `voting` und zeigte eine Entscheidung statt ins Archiv zu wandern. Migration **067** stellt den Aufruf wieder her (läuft zuerst, damit ein abgesagtes Event keine „Auswertung ist da"-Push mehr auslöst).
- Erklärt auch, warum dasselbe Event auf zwei Geräten **unterschiedliche** Sportarten zeigte: Für ein noch nicht finalisiertes Event ist die angezeigte Sportart eine **Live-Vorschau**, die mangels persistiertem `weather_snapshot` das **aktuelle Wetter** lädt. Der Algorithmus ist deterministisch, aber bei fast keinem Stimmen-Signal (1 Stimme) kippt das Wetter die Wahl — zwei Clients berechnen die Vorschau zu unterschiedlichen Zeitpunkten → unterschiedliches Ergebnis. Sobald das Event korrekt abgesagt (zu wenige) oder finalisiert (Wetter eingefroren) ist, ist die Anzeige stabil.

---

## 2026-06-18 — Ladezeiten: Caching, Bootstrap-Memo, schlanker Chat-Loader, Prefetch

### Geändert
- **A — Cache auf der Event-Detailseite** (`app/events/[eventId]/attendance.tsx`): stale-while-revalidate wie bei Mitgliedern/Chat. Beim Wiederöffnen erscheint sofort der gecachte Stand, im Hintergrund wird aktualisiert — kein sekundenlanger Spinner mehr. Mutations-Reloads umgehen den Cache (kein Flackern).
- **B — `ensure_mcc_week` nur noch 1×/Session** statt bei jedem Seitenaufruf: `bootstrapMccWeek()` memoisiert das Ergebnis (clubId + Event-Refs) für 5 Minuten und teilt parallele Aufrufe. Davon profitieren Home, Mitglieder und Chat automatisch. Reset bei Logout (`resetMccBootstrapCache`, verdrahtet in `AuthContext`).
- **C — Schlanker Chat-Loader** (`getWeekChatStates`): lädt Teilnahmen/Stimmen/Aktivitäten der ganzen Woche in gebündelten `.in(event_id, …)`-Queries statt pro Event eine volle `getEventStateById`. Lässt weg, was der Chat nie liest (Proposals, No-Gos, Sportprofile) und — am wichtigsten — ruft die **Decision-Edge-Function nur noch** für das seltene Event auf, das entscheidungsreif ist, aber noch keine persistierten `event_activities` hat (vorher: pro Event ein Edge-Call). Die Readiness-Regel liegt jetzt zentral in `src/lib/eventChatReadiness.ts` (`isEventDecisionReadyForChat`) und wird von Loader und Chat-Screen geteilt, damit **keine Chats verschwinden**.
- **F — Prefetch** (`prefetchSecondaryTabs`): Der Home-Screen wärmt Mitglieder- und Chat-Cache einmal pro Session im Hintergrund (eine Assembly über `loadChatBundle` füllt beide Caches), sodass der erste Tab-Wechsel sofort aus dem Cache rendert.
- Cache-Keys zentralisiert (`src/services/localCache.ts`), damit Screen und Prefetch garantiert denselben Key schreiben. `mcc.members.` und `mcc.eventDetail.` zur Purge-Liste (`MANAGED_CACHE_PREFIXES`) ergänzt — vorher wäre der Mitglieder-Cache bei einem Schema-Wechsel nicht geräumt worden.

### Hinzugefügt
- `tests/chatReadiness.test.ts` (5 Tests) sichert ab, welche Event-Chats erscheinen — direkter Schutz gegen versehentlich verschwindende Chats.

---

## 2026-06-18 — Installations-Anleitung: iPhone-Screenshots untereinander

### Geändert
- Die iPhone/iPad-Screenshots in der Installations-Anleitung (`app/install.tsx`) standen in einem 2-spaltigen Grid (zwei nebeneinander). Sie liegen jetzt **untereinander** in einer Spalte, zentriert und etwas größer (Bildbreite ~62 %, max. 220 px), mit der Bildunterschrift jeweils zentriert darunter.

---

## 2026-06-17 — Intro-Tour nicht erneut in der installierten PWA

### Behoben
- Nach Installation der PWA spielte die Willkommens-Tour erneut, obwohl man sie im Browser schon gesehen hatte. Ursache: Die installierte PWA hat einen **eigenen** Storage, getrennt vom Browser-Tab — der `mcc.introSeen.<userId>`-Flag (AsyncStorage → localStorage) wandert nicht mit. Die Tour wird jetzt im **Standalone-Modus** (`isStandaloneDisplay()`) übersprungen, da der Browser-Erstkontakt bereits stattgefunden hat (`app/index.tsx`). Der irreführende Kommentar, der Persistenz über die installierte PWA hinweg behauptete, wurde korrigiert.

---

## 2026-06-17 — Push nur tagsüber + Wochentag in Benachrichtigungen

### Geändert
- **Keine Pushes nachts.** Benachrichtigungen werden nur noch zwischen **09:00 und 22:00 (Europe/Berlin)** ausgeliefert. Der Zeit-Gate sitzt an beiden Auslieferungswegen: der `send-push` Edge-Funktion (Hintergrund-Web-Push) und der In-App-`AppNotificationBridge` (Vordergrund). Außerhalb des Fensters bleiben die Einträge in `app_notifications` liegen und gehen beim ersten Lauf nach 09:00 raus — nichts wird verworfen. Gemeinsame Quelle der Logik: `isWithinPushWindow()` in `src/services/date.ts` (in der Edge-Funktion in Deno gespiegelt).
- **Wochentag im Text.** Benachrichtigungen nennen jetzt den Tag des Events, z. B. „Neue Abstimmung für Samstag", „Stimme für Sonntag fällig", „Auswertung für Samstag ist da". Neuer SQL-Helper `mcc_event_day_label_de(weekday)` (Migration 064); admin-angepasste Titel aus den `notification_rules` bleiben erhalten und bekommen den Tag als „<Titel> – Samstag" angehängt.

### Doku
- `docs/notifications-and-weekly-decision.md`: Tagzeit-Fenster (09–22) und Wochentag-Texte ergänzt.

---

## 2026-06-15 — „Neue Version verfügbar" beim Erstinstall behoben

### Behoben
- Die PWA-Update-Erkennung (`public/pwa-register.js`) prüfte das **live** `navigator.serviceWorker.controller`. Da der frische SW per `skipWaiting()`/`clients.claim()` die Seite schon beim Erstinstall übernimmt, war der Controller gesetzt, wenn `statechange === "installed"` feuerte → fälschliche „Neue Version verfügbar"-Meldung beim **allerersten** Aufruf. Jetzt wird **einmalig** beim Laden erfasst, ob die Seite bereits von einem SW kontrolliert wurde; ein Update-Hinweis erscheint nur, wenn das der Fall war (echtes Update, kein Erstinstall).

---

## 2026-06-15 — Registrierung auf OTP-first umgestellt (Session nach Verify garantiert)

### Geändert
- Registrierung nutzt jetzt **`signInWithOtp`** (eine SMS, Account-Erstellung bei Verify) statt `signUp(phone,password)`. Nach `verifyOtp` existiert **zuverlässig eine Session** — dadurch läuft die anschließende Einladungs-Einlösung **authentifiziert**. Vorher konnte der Passwort-`signUp`-Bestätigungsflow den Client ohne Session lassen → `consume_invitation_code` lief unauthentifiziert (`auth.uid()` null) → „Einladungscode konnte nicht eingelöst werden" **trotz freiem, gültigem Code** (per SQL bestätigt: `used_by/used_at/expires_at` alle NULL).
- Die **PIN** wird nach der Verifizierung per `updateUser({ password })` gesetzt (PIN-Login bleibt unverändert). Resend nutzt ebenfalls `signInWithOtp`.
- Nebeneffekt: bestehende/verwaiste Accounts werden per OTP eingeloggt und sauber fertig-onboarded — ein vorheriges Löschen ist nicht mehr zwingend nötig.

---

## 2026-06-16 — ECHTE Ursache: Analytics-Trigger crasht Einladungs-Einlösung (42703)

### Behoben
- **Root Cause der „Einladungscode konnte nicht eingelöst werden"-Fehler.** Der Analytics-Trigger `track_invitation_used()` (Migration 057, 13.06.) referenzierte `new.id`, aber `public.invitation_codes` hat **kein `id`** (PK ist `code`). Jeder `update ... set used_by` (genau das macht `consume_invitation_code`) löste den Trigger aus → `record "new" has no field "id"` (SQLSTATE **42703**) → der Update brach ab → Einlösung schlug fehl, **trotz** gültigem freiem Code und gültiger Session. Migration **065** ersetzt `new.id` durch `new.code`. Erklärt auch, warum es „schon vor dem 14.06." auftrat (057 wurde am 13.06. eingespielt).
- Per On-Screen-Diagnose verifiziert: „Session OK · Code 12 Zeichen · Fehler: record \"new\" has no field \"id\" [42703]". Diagnose danach wieder entfernt.

---

## 2026-06-15 — Einladungscode nach SMS „nicht einlösbar": consume idempotent

### Behoben
- Nachdem die SMS-Verifizierung wieder funktioniert, wanderte der Fehler zu `consume_invitation_code`: lief die Einlösung im selben Registrierungs-Flow zweimal (bzw. erneut durch denselben gerade angelegten Nutzer), setzte der erste Aufruf `used_by` und der zweite meldete „bereits benutzt" → „Einladungscode konnte nicht eingelöst werden". Migration **064** macht `consume_invitation_code` **idempotent**: ist der Code bereits von **diesem** Nutzer eingelöst, gibt sie `true` zurück (fremd-genutzte Codes bleiben gesperrt).

---

## 2026-06-15 — SMS-Code „ungültig": Doppel-OTP-Regression behoben (Hauptursache)

### Behoben
- **Root Cause der „Code ungültig"-Fehler seit 14.06.** In `submitSignup` wurde nach `signUp` ein zweites OTP per `resend` gesendet, wenn `user.identities` leer war. Bei aktiver Phone-Confirmation liefert Supabase aber **auch für neue Nutzer** ein leeres `identities`-Array → es wurde bei **jedem** Signup ein zweites OTP gesendet, das das erste **ungültig** machte. Eingegeben wurde dann der erste (tote) Code → „invalid". Eingeführt durch Commit `b829582`, jetzt entfernt: nach `signUp` geht es direkt zum Code-Schritt (signUp hat den Code bereits gesendet).
- **Hinweis:** Die damit entfernte „bereits registriert"-Erkennung war ohnehin unzuverlässig (Obfuscation). Verwaiste Alt-Accounts weiter über `supabase/maintenance/delete_orphaned_phone_user.sql` bereinigen.

---

## 2026-06-15 — SMS-Code „ungültig/abgelaufen": Resend-Race entschärft

### Behoben/Geändert
- Beim erneuten SMS-Senden wird das Code-Eingabefeld jetzt **geleert** und der Nutzer angewiesen, den **zuletzt** erhaltenen Code zu verwenden (ein Resend macht ältere Codes ungültig — bisher konnte ein veralteter, bereits getippter Code abgeschickt werden → „invalid").
- **Hauptursache bleibt serverseitig:** zu kurze **SMS-OTP-Ablaufzeit** in Supabase (Auth → Providers → Phone → „SMS OTP Expiry", Empfehlung 600 s). Runbook in [operations.md](perspectives/operations.md) ergänzt.

---

## 2026-06-15 — Schwebende Bottom-Navigation (Instagram-Stil)

### Hinzugefügt
- Neue, **schwebende runde Pille** als Bottom-Navigation: transparenter/leicht verschwommener Hintergrund (Web-Backdrop-Blur), Schatten, runde Ecken.
- **Scroll-Reaktion:** beim Runterscrollen wird die Leiste leicht kleiner, beim Hochscrollen/oben wieder voll groß. Umgesetzt über `NavChromeProvider`/`useNavChrome` (geteilter Scroll-Zustand), eingehängt in die Scroller von Event (`index`), Chat, Menü und allen `MccScreen`-Seiten.

### Geändert
- `BottomNav` von der durchgehenden Vollbreiten-Leiste auf die zentrierte Pille umgestellt; aktiver Tab als kleiner Punkt statt Linie. Bewusst **im Layout-Fluss** (nicht über Inhalt schwebend), damit das Chat-Eingabefeld nicht verdeckt wird und keine Reflow-/Überlappungsprobleme entstehen.

---

## 2026-06-15 — BottomNav: doppelten unteren Safe-Area-Inset entfernt

### Behoben
- Auf Screens mit `MccScreen` **und** `BottomNav` (Mitglieder, Einstellungen, Push, Einladungen, App installieren, „So entscheidet der Club") wurde der untere Safe-Area-Inset **doppelt** angewandt (einmal von `MccScreen`s SafeAreaView, einmal von der BottomNav). Dadurch saß die Navigationsleiste auf dem iPhone nicht bündig am unteren Rand. Neue Prop `MccScreen withBottomNav` lässt den unteren Edge weg, sodass nur die BottomNav den Inset trägt. Sub-Seiten ohne BottomNav (events/*, clubs/*) bleiben unverändert.

---

## 2026-06-15 — Kombinierte Events mit 3+ Sportarten möglich

### Hinzugefügt
- Der Entscheidungs-Algorithmus kann jetzt **mehr als zwei** Sportarten zu **einem** kombinierten Event an einem Ort zusammenfassen (z. B. Beachvolleyball + Outdoor-Boxen + Schwimmen am Strandbad). Neuer Generator `generateCombinedCandidates`: ankert an jeder Sportart und nimmt greedy weitere **ko-lokalisierte** Sportarten (selber Standort/Rufnähe) auf, die jede für sich **echten Support** haben, bis `maxActivities`.
- Test: „combines three co-located sports into one multi-sport event".

### Geändert
- `DEFAULT_OPTIONS.maxActivities` von 2 auf **4** erhöht und in der Generierung **erzwungen** (bisher nur deklariert). Single- und 2-Sport-Kandidaten unverändert; nur größere Kombinationen kommen hinzu.
- Greift nach **Neu-Deploy der `decision`-Function**. Bestehende 27 Algorithmus-Tests weiter grün.

---

## 2026-06-15 — „Selber Standort"-Radius erhöht (120 m → 300 m)

### Geändert
- `DEFAULT_OPTIONS.sameSpotRadiusKm` von 0.12 auf **0.3 km** erhöht, damit eine größere Anlage (z. B. Strandbad) als **ein** Standort zählt. Bleibt unter `socialRadiusKm` (0.75 km, Rufnähe). Greift nach Neu-Deploy der `decision`-Function.

---

## 2026-06-15 — Gleicher Ort: Distanz statt Name als primäres Signal

### Geändert
- `getProfileProximity` (Entscheidungs-Algorithmus) entscheidet „gleicher Ort/Rufnähe" jetzt **zuerst über die Distanz** der Koordinaten (Haversine; `sameSpotRadiusKm`=120 m „selber Standort", `socialRadiusKm`=750 m „Rufnähe"). Der namensbasierte `venue_group_key` ist nur noch **Fallback**, wenn bei mindestens einem Profil Koordinaten fehlen.
- Die Standort-/Kapazitätsgruppierung (`groupActivitiesByLocation`) nutzt dieselbe distanzbasierte Logik, statt direkt über den `venue_group_key` (Namen) kurzzuschließen. Verhindert, dass zwei gleichnamige, aber weit entfernte Orte als einer behandelt werden.
- Praxis: Standorte am selben Platz brauchen primär **Koordinaten** (Map-Pin). Der Namens-Key bleibt für koordinatenlose Profile nützlich.

---

## 2026-06-15 — Standorte gruppieren (venue_group_key) + Beispiel verfeinert

### Hinzugefügt
- `supabase/maintenance/align_venue_group_keys.sql`: prüft/füllt `venue_group_key` aus dem Standortnamen, damit gleichnamige Profile (z. B. drei Profile „Strandbad Horn" für Boxen/Volleyball/Schwimmen) vom Entscheidungs-Algorithmus als **ein Ort** gruppiert werden und gemeinsam laufen können.

### Geändert
- how-it-works-Beispiel auf das realistische Szenario umgestellt: Beachvolleyball, Outdoor-Boxen und Schwimmen → ein Standort (Strandbad Horn), an dem alles zusammen möglich ist.

### Doku
- Hintergrund zur Standort-Gruppierung (`venue_group_key`, „same_spot") ergänzt — siehe [operations.md](perspectives/operations.md).

---

## 2026-06-15 — Benachrichtigungen: „Voting offen" statt „neue Woche"; Einladung nur tagsüber

### Geändert
- **„Neue Cardio-Abstimmung"** wird nicht mehr beim Anlegen der Wochen-Events ausgelöst, sondern erst, **wenn das Voting eines Events wirklich offen ist** (zeitgesteuerter, dedup-sicherer Job `enqueue_vote_open_notifications`, eingehängt in `run_mcc_notification_jobs`). Verhindert die doppelte Meldung bei zwei neuen Cardiotagen, von denen nur einer abstimmbar ist.
- **Wöchentliche Einladungs-Erinnerung** nur noch **tagsüber** (Berlin 10:00–20:00) — keine 02:00-Push mehr (`enqueue_weekly_invite_reminders` mit Tageszeit-Gate).

### Entfernt
- Insert-Trigger `enqueue_weekly_event_notification_trigger` auf `weekly_events` entfernt. Grund: löste die „neue Woche"-Push pro angelegtem Event aus, unabhängig vom Voting-Status. Ersatz: o. g. zeitgesteuerter Job.
- DB: Migration **063**.

---

## 2026-06-14 — Menüseite „So entscheidet der Club" (Nutzer-Erklärung)

### Hinzugefügt
- Neue Route `app/how-it-works.tsx` und Menüeintrag „So entscheidet der Club": Erklärung des Fairness-Algorithmus für Mitglieder mit CTA „Jetzt abstimmen".
- Screen-Event `SCREEN_EVENTS.howItWorks` (+ Label) für Analytics.

### Geändert
- Seite **detaillierter**: 5-Schritte-Ablauf, Karte „Was fair abgewogen wird" (Ranked Voting, No-Go-Härte, Vernachlässigungs-/Mehrheitsschutz, Standort/Wetter, parallele Gruppen) und ein konkretes Beispiel — weiterhin einfach und ohne Formeln.

---

## 2026-06-14 — Standort-Export/-Import (Admin)

### Hinzugefügt
- **Admin → Sportprofile:** „Standorte exportieren / importieren". Export als JSON (alle Standorte inkl. zugeordneter Sportarten per Name + ID); Import legt fehlende Standorte an und aktualisiert vorhandene (gleiche ID). Sportarten werden über den **Namen** aufgelöst (robust über Datenbanken hinweg), Fallback auf ID.
- **Service:** `exportSportProfiles` / `importSportProfiles` in `src/services/sportProfiles.ts` (+ Typen `SportProfileExport`, `SportProfileImportResult`).
- Datei-Download/-Upload nur im **Web** (Platform-Guard); auf Native erscheint ein Hinweis.

---

## 2026-06-14 — Doku-System eingeführt; Onboarding/Voting/Standorte gehärtet

### Doku
- Neues, sichten-basiertes Doku-System unter `docs/` angelegt:
  `README.md` (Index), `perspectives/{stakeholder,architecture,developer,user-guide,operations,security-and-privacy}.md`,
  `CHANGELOG.md` (dieses Log) und `MAINTENANCE.md` (Pflegeprotokoll).

### Hinzugefügt
- **Admin:** „Sportart mehreren Standorten zuordnen" (Bulk-Zuordnung) + Service `linkSportToProfiles` (additiv, idempotent).
- **Ideen:** „Sportart an bestehenden Standorten" — ein Sport an mehrere bekannte Standorte vorschlagen (Details aus dem Standortprofil).
- **Ideen:** „Zuletzt verwendete Standorte" als Schnellauswahl im Standort-Schritt, Stadt des Nutzers zuerst/hervorgehoben.
- **Auth:** Resend-Cooldown (60 s, Countdown) und klare Rate-Limit-/OTP-Fehlermeldungen.
- **Ops:** `scripts/create-basic-user.mjs` (login-fähiges Basis-Konto via Service-Role) und `supabase/maintenance/delete_orphaned_phone_user.sql`.
- **DB:** Migrationen 060 (`admin_upsert_sport` idempotent auf Name), 061 (Admin-UPDATE-Policy auf `sports`), 062 (Voting-/Attendance-Gate an Event-Zeit angeglichen).

### Geändert
- **Ortssuche** auf Land (DE) eingeschränkt und an die Stadt des Nutzers gebunden (keine USA-/Auslandstreffer).
- **Standort-Picker (Ideen)** nach Ortsnamen dedupliziert; bereits zugeordnete Standorte gesperrt.
- **Sport-Auswahl:** „+"-Chip → „+ Hinzufügen".
- **Event-Default:** `getMccEventState` wählt das Event der **eigenen Stadt** zuerst (greift bei mehreren aktiven Städten).

### Behoben
- Freigabe einer Idee mit „neuer" Sportart: Duplicate-Key (`sports_name_key`) und „Cannot coerce…" (RLS) behoben.
- Freigabe **flexibler** Ideen: Standortname wird aus PLZ/Stadt abgeleitet.
- Registrierung: bestehende Nummer wird erkannt (verschleierte `signUp`-Antwort), kein falsches „SMS geschickt"; Einladungscode wird vor `signUp` revalidiert.

### Entfernt
- `supabase/maintenance/delete_unconfirmed_phone_user.sql` **umbenannt/ersetzt** durch `delete_orphaned_phone_user.sql`. Grund: Die alte Variante löschte nur *unbestätigte* User und ließ verwaiste **bestätigte** User (ohne Club-Mitgliedschaft) stehen, die die Nummer blockierten. Neue Variante guarded auf „keine Club-Mitgliedschaft".

---

## Vor 2026-06-14 (Basis, verdichtet)

Frühere Entwicklung ist in den Migrationen (001–059) und den Themen-Dokus
dokumentiert (Algorithmus-Handoff, Notifications, Push, PWA, Analytics, Schema).
Dieser Changelog wird ab hier fortgeschrieben.
