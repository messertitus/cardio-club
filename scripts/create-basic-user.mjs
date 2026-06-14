// Create a basic, login-ready account manually (phone + PIN).
//
// Use when a member is stuck in signup/SMS verification: this creates a
// phone-confirmed auth user with a password derived from a PIN, so they can log
// in immediately with that PIN and set up everything else (display name, city,
// favorites) themselves in the app. The on_auth_user_created trigger creates the
// profile row, and ensure_mcc_week() adds the club membership on first login.
//
// Requires the SERVICE ROLE key (never ship this in the app). Run locally:
//
//   SUPABASE_URL="https://<project>.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
//   node scripts/create-basic-user.mjs "+491602953470" "1234" "Vorname"
//
// Args: <phoneE164> [pin=1234] [displayName]
// On Windows PowerShell, set the two env vars with $env:NAME="..." first, then
// run the node command.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Node does not auto-load .env, so pull values from it here (without overriding
// anything already set in the real environment).
function loadDotEnv() {
  const path = join(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const [, , phoneArg, pinArg = "1234", displayNameArg] = process.argv;

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

if (!phoneArg || !/^\+[1-9]\d{7,14}$/.test(phoneArg)) {
  console.error(`Invalid phone. Pass E.164 form, e.g. "+491602953470". Got: ${phoneArg ?? "(none)"}`);
  process.exit(1);
}

if (!/^\d{4,16}$/.test(pinArg)) {
  console.error(`Invalid PIN. Use 4-16 digits. Got: ${pinArg}`);
  process.exit(1);
}

// Mirror appPinToAuthPassword() in app/auth.tsx so the in-app PIN login matches.
function appPinToAuthPassword(phoneValue, pinValue) {
  const phoneTail = phoneValue.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `mcc-${phoneTail}-${pinValue}`;
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = appPinToAuthPassword(phoneArg, pinArg);

const { data, error } = await supabase.auth.admin.createUser({
  phone: phoneArg,
  password,
  phone_confirm: true,
  user_metadata: displayNameArg ? { display_name: displayNameArg } : {},
});

if (error) {
  console.error("Could not create user:", error.message);
  console.error("If the number already exists, delete the orphaned auth user first");
  console.error("(supabase/maintenance/delete_orphaned_phone_user.sql), then re-run.");
  process.exit(1);
}

console.log("Created login-ready account:");
console.log("  user id:", data.user?.id);
console.log("  phone:  ", data.user?.phone);
console.log(`  login:   open the app, enter phone ${phoneArg} and PIN ${pinArg}`);
console.log("  next:    club membership is added automatically on first login.");
