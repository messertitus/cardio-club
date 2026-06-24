// Supabase Edge Function: landing-page contact form.
// Stores the message in contact_messages (no data loss) AND emails it to the
// club inbox via SMTP, with the visitor's address as Reply-To.
//
// Deploy:  supabase functions deploy contact-email --no-verify-jwt
// Secrets: supabase secrets set \
//            SMTP_HOST=smtp.secure-mailgate.com SMTP_PORT=587 \
//            SMTP_USER=kontakt@messers-cardio-club.com SMTP_PASS=... \
//            CONTACT_TO=kontakt@messers-cardio-club.com
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically)
//
// Requires migration 073_contact_messages.sql (the contact_messages table).

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }

  // Honeypot: a filled "company" field means a bot → pretend success, do nothing.
  if (String(payload.company ?? "").trim()) return json({ ok: true });

  const name = String(payload.p_name ?? "").trim().slice(0, 120);
  const email = String(payload.p_email ?? "").trim().slice(0, 160);
  const message = String(payload.p_message ?? "").trim().slice(0, 4000);

  if (!name || !email.includes("@") || email.length < 3 || !message) {
    return json({ error: "invalid input" }, 400);
  }

  // 1) Persist first — best effort, so a message is never lost even if mail fails.
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase.from("contact_messages").insert({ name, email, message });
    if (error) console.error("contact_messages insert failed:", error.message);
  } catch (e) {
    console.error("DB insert threw:", e);
  }

  // 2) Send the email.
  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const to = Deno.env.get("CONTACT_TO") ?? user;
  if (!host || !user || !pass) {
    console.error("Missing SMTP env");
    return json({ error: "mail not configured" }, 500);
  }

  // Strip CR/LF from header-bound values to prevent header injection.
  const safeName = name.replace(/[\r\n]+/g, " ");
  const safeEmail = email.replace(/[\r\n]+/g, " ");

  try {
    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: port === 465, // implicit TLS on 465; STARTTLS upgrade otherwise (587)
        auth: { username: user, password: pass },
      },
    });
    await client.send({
      from: user,
      to: to!,
      replyTo: safeEmail,
      subject: `Kontaktformular: ${safeName}`,
      content: `Neue Nachricht über das Kontaktformular der Landing Page.\n\n`
        + `Name:    ${safeName}\n`
        + `E-Mail:  ${safeEmail}\n\n`
        + `Nachricht:\n${message}\n`,
    });
    await client.close();
  } catch (e) {
    console.error("SMTP send failed:", e);
    return json({ error: "send failed" }, 500);
  }

  return json({ ok: true });
});
