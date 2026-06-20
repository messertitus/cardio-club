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
