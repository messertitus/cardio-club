# Push-Benachrichtigungen: Einrichtung & Hintergrund-Zustellung

Ziel: Benachrichtigungen kommen **auch bei geschlossener App** an – nicht nur, wenn die App offen ist.

## Wie es funktioniert

```
Ereignis (Vote offen, Entscheidung, Chat, …)
        │  schreibt Zeile
        ▼
public.app_notifications  (Warteschlange, delivered_at = null)
        │
        ├─(A) App offen: AppNotificationBridge pollt alle 45 s, zeigt lokal,
        │     setzt delivered_at  ← funktionierte bisher als EINZIGER Weg
        │
        └─(B) App zu: Cron ruft 1×/Minute die Edge-Function send-push,
              die per Web-Push an die gespeicherten push_subscriptions
              sendet → Service-Worker (mcc-push-worker.js) zeigt die
              Notification, auch bei geschlossener App.
```

**Warum bisher nur bei offener App:** Weg (B) war nie scharf geschaltet – es gab keinen Server-Cron für `send-push` und (sehr wahrscheinlich) keine echten VAPID-Subscriptions. Damit blieb nur Weg (A).

## Einmalige Einrichtung

### 1. VAPID-Schlüsselpaar erzeugen
```bash
npx web-push generate-vapid-keys
```
Liefert `Public Key` und `Private Key`. Der **Public** Key geht in den Client, der **Private** Key bleibt ausschließlich serverseitig (Supabase-Secret).

### 2. Client konfigurieren
In `.env` (siehe `.env.example`):
```
EXPO_PUBLIC_VAPID_PUBLIC_KEY=<dein-public-key>
```
Danach neu bauen/deployen (`npm run export:web`). Ohne diesen Key kann der Client **keine echte** Push-Subscription anlegen – dann sind nur Vordergrund-Benachrichtigungen möglich (die App meldet das jetzt klar auf der Push-Seite).

### 3. Edge-Function-Secrets setzen

Es gibt zwei Wege – beide setzen dieselben drei Secrets.

**Variante A – Dashboard (ohne CLI):**
1. supabase.com/dashboard → dein Projekt.
2. Linke Seitenleiste **Edge Functions** → Tab **Secrets** (alternativ **Project Settings → Edge Functions → Secrets**).
3. **Add new secret** für jeden Eintrag (Name → Value):
   - `VAPID_PUBLIC_KEY` → dein Public Key (Schritt 1)
   - `VAPID_PRIVATE_KEY` → dein Private Key (Schritt 1)
   - `VAPID_SUBJECT` → `mailto:admin@messers-cardio-club.de`
4. Speichern.

**Variante B – CLI:**
```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=<dein-public-key> \
  VAPID_PRIVATE_KEY=<dein-private-key> \
  VAPID_SUBJECT=mailto:admin@messers-cardio-club.de
```

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase automatisch bereit – **nicht** selbst anlegen.

### 4. Edge-Function deployen
```bash
supabase functions deploy send-push --no-verify-jwt
```
`send-push` ruft zuerst `run_mcc_notification_jobs()` (zeitbasierte Reminder) und sendet dann alle offenen `app_notifications` per Web-Push.

### 5. Server-Cron einrichten (Supabase Dashboard)

**Variante A – Cron-UI (am einfachsten):**
Dashboard → *Integrations* → *Cron* → *Create job*:
- Schedule: `* * * * *` (jede Minute)
- Type: *Supabase Edge Function* → `send-push`
- Speichern. Fertig.

**Variante B – per SQL** (Dashboard → *SQL Editor*), falls du es versioniert/explizit willst:
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'mcc-send-push',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/send-push',
    headers := jsonb_build_object('Content-Type','application/json'),
    body    := '{}'::jsonb
  );
  $$
);
```
- `<PROJECT_REF>` = deine Supabase-Projekt-Ref.
- Da die Function mit `--no-verify-jwt` deployt ist, ist kein Auth-Header nötig. Falls du JWT-Prüfung aktivierst, ergänze `'Authorization','Bearer <SERVICE_ROLE_KEY>'` – dann den Key idealerweise über **Supabase Vault** statt im Klartext.

Job wieder entfernen: `select cron.unschedule('mcc-send-push');`
Laufende Jobs ansehen: `select * from cron.job;`

### 6. iPhone / iOS (wichtig)
Web-Push funktioniert auf iOS **nur als zum Home-Bildschirm hinzugefügte App** (iOS 16.4+), **nicht** im Safari-Tab. In der App ist die Push-Seite bereits entsprechend gestaltet (Install-Hinweis, wenn nicht standalone). Du nutzt es bereits als Home-Screen-App – passt.

## Verifizieren
1. In der App **„Push erlauben"** tippen → Meldung „Push ist gespeichert. … auch bei geschlossener App."
   (Kommt stattdessen „… VAPID-Schlüssel fehlt", ist Schritt 2 nicht aktiv.)
2. Prüfen, dass eine echte Subscription existiert:
   ```sql
   select user_id, left(endpoint, 40) from public.push_subscriptions where platform='web';
   ```
   Der `endpoint` muss eine `https://…`-URL sein (kein `browser-notification-permission`).
3. App **komplett schließen**. Als Admin im Adminbereich → *Benachrichtigungen* eine Regel „Test an mich" senden (oder eine echte Auslösung wie eine Entscheidung). Innerhalb ~1 min sollte die Push-Nachricht auf dem gesperrten/geschlossenen Gerät erscheinen.

## Troubleshooting
- **Nur bei offener App:** Cron läuft nicht (Schritt 5) oder Function nicht deployt (Schritt 4).
- **„VAPID-Schlüssel fehlt" im Client:** Schritt 2 (`.env`) fehlt oder Build nicht erneuert.
- **`send-push` liefert 500 „Missing … VAPID keys":** Schritt 3 (Secrets) fehlt.
- **Subscription-Endpoint ist `browser-notification-permission`:** Client lief ohne VAPID-Key; nach Schritt 2 erneut „Push erlauben".
- **iOS zeigt nichts:** Im Safari-Tab statt als Home-Screen-App geöffnet, oder Benachrichtigungen in den iOS-Einstellungen für die App deaktiviert.
- **Tote Endpoints:** `send-push` löscht abgelaufene Subscriptions (HTTP 404/410) automatisch; der Nutzer muss dann erneut „Push erlauben".

## Datenschutz
Es werden nur die für die Zustellung nötigen Subscription-Daten (Endpoint + Keys) und die Notification-Texte gespeichert. Keine Inhalte privater Nachrichten – siehe `docs/analytics-and-privacy.md`.
