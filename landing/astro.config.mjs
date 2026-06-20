// @ts-check
import { defineConfig } from 'astro/config';

// Static landing page for messers-cardio-club.com.
// Output is a fully static site (default) — rsync `dist/` to /var/www/landing/.
export default defineConfig({
  site: 'https://messers-cardio-club.com',
  build: {
    // Emit clean URLs (index.html per route) so nginx try_files works simply.
    format: 'directory',
  },
});
