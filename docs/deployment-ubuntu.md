# Ubuntu Deployment

This app exports to static web files with Expo and can be served by nginx.

## Server Setup

Install Node.js LTS, nginx, and certbot:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Clone the repository:

```bash
git clone <your-github-repo-url> /var/www/messers-cardio-club-src
cd /var/www/messers-cardio-club-src
npm ci
```

Create `.env` on the server. Do not commit this file:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Build:

```bash
npm run export:web
sudo mkdir -p /var/www/messers-cardio-club
sudo rsync -a --delete dist/ /var/www/messers-cardio-club/
```

## nginx

Create `/etc/nginx/sites-available/messers-cardio-club`:

```nginx
server {
  listen 80;
  server_name messers-cardio-club.com www.messers-cardio-club.com;

  root /var/www/messers-cardio-club;
  index index.html;

  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/messers-cardio-club /etc/nginx/sites-enabled/messers-cardio-club
sudo nginx -t
sudo systemctl reload nginx
```

After the domain DNS points to the server, enable HTTPS:

```bash
sudo certbot --nginx -d messers-cardio-club.com -d www.messers-cardio-club.com
```

## Supabase Settings

In Supabase Auth, add the production URL to allowed redirect/site URLs:

```text
https://messers-cardio-club.com
https://www.messers-cardio-club.com
```

For phone auth, enable Phone provider and configure an SMS provider before inviting testers.

## Security Checklist

- Commit `.env.example`, never `.env`.
- Use only the Supabase publishable key in the frontend.
- Never expose the Supabase service-role key in Expo or nginx.
- Run all migrations before inviting testers.
- Run `npm run typecheck`, `npm test`, and `npm run export:web` before deployment.
- Keep `supabase/maintenance/reset_for_phone_test.sql` for manual admin reset only; do not run it after real users join.
