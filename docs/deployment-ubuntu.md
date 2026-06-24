# Ubuntu Deployment (Multi-Site)

The server hosts several independent sites, split by **subdomain**, each with its
own nginx `server` block and its own certbot certificate:

| Domain                              | Content              | Web root                          |
| ----------------------------------- | -------------------- | --------------------------------- |
| `messers-cardio-club.com` (+ `www`) | **Landing** (Astro)  | `/var/www/landing`                |
| `app.messers-cardio-club.com`       | **PWA** (Expo export)| `/var/www/messers-cardio-club`    |
| `<projekt>.messers-cardio-club.com` | future projects      | own root / reverse-proxy          |

Version-controlled configs live in [`deploy/`](../deploy):
`deploy/nginx/landing.conf`, `deploy/nginx/app.conf`,
`deploy/nginx/_project-template.conf`, plus `deploy/deploy-landing.sh` and
`deploy/deploy-app.sh`.

> Migration note: previously the **app** was served at the apex
> (`messers-cardio-club.com`). The apex now serves the **landing**, and the app
> moves to `app.`. Step 4 replaces the old apex site config.

---

## 0. Prerequisites

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx rsync
# Node.js 20+ (for building both sites). Use your existing install or nvm.
```

Clone (or pull) the repo on the server, e.g. to `/var/www/src/cardioclub`.

## 1. DNS

Point these A/AAAA records at the server IP (apex + www likely already exist):

```text
messers-cardio-club.com        -> <server-ip>
www.messers-cardio-club.com    -> <server-ip>
app.messers-cardio-club.com    -> <server-ip>     # NEW
# optional wildcard for future projects:
*.messers-cardio-club.com      -> <server-ip>
```

## 2. Environment files (before building)

- **Landing** — create `landing/.env` (publishable/anon key only; it is baked
  into the client at build time, which is fine — it's the public key):

  ```env
  PUBLIC_SUPABASE_URL=https://<project>.supabase.co
  PUBLIC_SUPABASE_ANON_KEY=<publishable-anon-key>
  ```

- **App** — `/.env` at the repo root with `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_VAPID_PUBLIC_KEY`
  (see `docs/push-setup.md`).

## 3. Build & publish both sites

```bash
cd /var/www/src/cardioclub
chmod +x deploy/*.sh

./deploy/deploy-landing.sh      # builds landing/, rsyncs to /var/www/landing
./deploy/deploy-app.sh          # builds Expo web, rsyncs to /var/www/messers-cardio-club
```

(Equivalent manual steps are inside those scripts.)

## 4. nginx site configs

```bash
cd /var/www/src/cardioclub

# Landing (apex + www) and App (app subdomain)
sudo cp deploy/nginx/landing.conf /etc/nginx/sites-available/landing
sudo cp deploy/nginx/app.conf     /etc/nginx/sites-available/app
sudo ln -sf /etc/nginx/sites-available/landing /etc/nginx/sites-enabled/landing
sudo ln -sf /etc/nginx/sites-available/app     /etc/nginx/sites-enabled/app

# Remove the OLD apex site that used to serve the app (avoids server_name clash).
# (File name from the previous setup — adjust if different.)
sudo rm -f /etc/nginx/sites-enabled/messers-cardio-club

sudo nginx -t && sudo systemctl reload nginx
```

## 5. HTTPS (certbot)

Separate certs per site (clean and independently renewable):

```bash
sudo certbot --nginx -d messers-cardio-club.com -d www.messers-cardio-club.com
sudo certbot --nginx -d app.messers-cardio-club.com
```

certbot rewrites the two config files to add the `listen 443 ssl` blocks and an
HTTP→HTTPS redirect. Auto-renewal is handled by the `certbot.timer` systemd unit
(`systemctl status certbot.timer`).

## 6. Supabase settings

- Run any pending SQL migrations (through `072_landing_stats_weekly_cardiotage.sql`,
  plus `071_waitlist.sql` for the waitlist).
- In **Authentication → URL Configuration**, add the app's production URLs:

  ```text
  https://app.messers-cardio-club.com
  ```

- The landing only calls the **public** RPCs (`landing_public_stats`,
  `request_invite`), granted to `anon` — no extra Supabase config needed.

## 7. Verify

```text
✓ https://messers-cardio-club.com        → landing, padlock, live numbers load
✓ https://www.messers-cardio-club.com    → landing (or redirect to apex)
✓ https://app.messers-cardio-club.com    → app loads, login works
✓ Landing: DE/EN switch, waitlist form submits (check the `waitlist` table)
✓ App: PWA installable, push still works
```

## 8. Updating later

```bash
cd /var/www/src/cardioclub && git pull
./deploy/deploy-landing.sh      # after landing changes
./deploy/deploy-app.sh          # after app changes
```

Live numbers on the landing are fetched **client-side on every visit**, so they
stay current without a rebuild; a rebuild is only needed for code/content
changes (and refreshes the build-time fallback snapshot).

## EAM (Uniprojekt) — eam. / eam-test.

Eigene Subdomains für ein weiteres Projekt, isoliert von Landing & App:
`eam.messers-cardio-club.com` (Produktion) und `eam-test.messers-cardio-club.com`
(Test/Staging). Das EAM-Projekt läuft per **Docker Compose** (3 Services:
`frontend` React/Vite hinter Nginx im Container, `backend` Node/Express + Prisma,
`postgres`). Der **Host-Nginx ist Reverse-Proxy und terminiert HTTPS**; die
Container lauschen ausschließlich auf `127.0.0.1`, PostgreSQL bekommt **keinen**
öffentlichen Host-Port. Von außen ist nur Nginx (80/443) erreichbar. Die
Hauptdomain bleibt unverändert.

Ports (Host-Bind): **Produktion `127.0.0.1:4000`**, **Test `127.0.0.1:4001`**.
Configs: `deploy/nginx/eam.conf`, `deploy/nginx/eam-test.conf`.

1. **DNS** bei Checkdomain: A-Records `eam` und `eam-test` → `93.90.201.126`.
2. **Configs** nach `/etc/nginx/sites-available/{eam,eam-test}` (per pscp oder
   heredoc), in `sites-enabled` verlinken, `nginx -t && systemctl reload nginx`.
3. **Certbot:** `sudo certbot --nginx -d eam.messers-cardio-club.com` und
   `-d eam-test.messers-cardio-club.com` (funktioniert auch, bevor der Container
   läuft — bis dahin liefert nginx 502, das ist normal).
4. **Docker:** in `docker-compose.yml` das Frontend an `127.0.0.1:4000:<port>`
   (prod) bzw. `127.0.0.1:4001:<port>` (test) binden.
5. **`/api/`-Routing prüfen:** entweder proxyt der Frontend-Container `/api`
   intern ans Backend (dann genügt der `location /`-Block), oder der Host-Nginx
   braucht einen zusätzlichen `location /api/`-Block auf den Backend-Port (in den
   Configs als auskommentierte Option vorbereitet). **Das ist anhand der finalen
   `docker-compose.yml` zu verifizieren.**

**Optionaler Basic-Auth-Schutz** (sinnvoll, solange EAM keine eigene Auth hat):

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd-eam demo   # legt User "demo" an, fragt PW
```

Dann in der jeweiligen `*.conf` die beiden `auth_basic`-Zeilen einkommentieren
und Nginx neu laden.

## messerscc.com — Redirect-Alias (Kurzdomain)

Die Kurzdomain `messerscc.com` ist **kein eigener Inhalt**, sondern leitet per
**301** auf `messers-cardio-club.com` um — pro Host gespiegelt (Landing, App,
EAM). So bleibt **eine** kanonische Domain (kein Duplicate-Content, Indexierung
der Hauptdomain unangetastet). Config: `deploy/nginx/messerscc.conf` (eine `map`
`$host → Ziel-Host` + ein 301-`server`-Block).

| Alias | → Ziel |
| --- | --- |
| `messerscc.com`, `www.messerscc.com` | `messers-cardio-club.com` |
| `app.messerscc.com` | `app.messers-cardio-club.com` |
| `eam.messerscc.com` | `eam.messers-cardio-club.com` |
| `eam-test.messerscc.com` | `eam-test.messers-cardio-club.com` |

1. **DNS** beim Registrar von `messerscc.com`: A-Records `@`, `www`, `app`,
   `eam`, `eam-test` → `93.90.201.126`.
2. **Aktivieren:** `sudo ln -s /etc/nginx/sites-available/messerscc
   /etc/nginx/sites-enabled/messerscc` → `sudo nginx -t && sudo systemctl reload nginx`.
3. **Zertifikat** (ein SAN-Cert für alle Alias-Hosts):
   ```bash
   sudo certbot --nginx -d messerscc.com -d www.messerscc.com \
     -d app.messerscc.com -d eam.messerscc.com -d eam-test.messerscc.com
   ```
   certbot ergänzt den `listen 443 ssl`-Block; der 301 bleibt erhalten.
4. **Check:** `curl -sI https://messerscc.com` → `301` mit
   `Location: https://messers-cardio-club.com/`.

## 9. Adding another project

1. Publish its files to `/var/www/<project>` (static) or run it on a local port.
2. Copy `deploy/nginx/_project-template.conf` →
   `/etc/nginx/sites-available/<project>`, set `server_name`, root or `proxy_pass`.
3. `ln -s` into `sites-enabled`, `nginx -t`, reload.
4. `sudo certbot --nginx -d <project>.messers-cardio-club.com`.

## Security checklist

- Commit `.env.example`, never `.env`.
- Frontend uses only the Supabase **publishable/anon** key. Never expose the
  service-role key in any build or nginx config.
- Each site has its own server block, web root and certificate — fully isolated.
- Security headers are set per site (see the configs). Consider adding a strict
  Content-Security-Policy once verified (must allow Supabase `connect-src` and,
  until the font is self-hosted, Google Fonts `style-src`/`font-src`).
- **Before public launch:** fill the `[…]` placeholders in `/impressum` and
  `/datenschutz`, and self-host the Space Grotesk font (removes the Google Fonts
  IP transfer noted in the privacy policy).
