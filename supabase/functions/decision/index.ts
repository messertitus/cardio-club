// Supabase Edge Function: server-side home of the fair-constellation decision
// algorithm. The browser/PWA bundle no longer contains any scoring, ranking,
// fairness or no-go mechanics — it only calls this function and renders the
// sanitized DecisionView it returns.
//
// Deploy:  supabase functions deploy decision
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
//          provided automatically by the platform.
//
// Request body: { eventId: string, action: "preview" | "finalize", options?: object }
//  - preview:  any authenticated member that may read the event. Returns DecisionView.
//  - finalize: admins / managers only. Persists the decision with the service role
//              and returns { event, view }.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { finalizeEventDecision, getEventDecisionPreview } from "./_shared/decisionService.ts";
import { buildDecisionView } from "./_shared/sanitize.ts";
import type { SportNameMap } from "./_shared/decisionPresentation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Function is not configured." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header." }, 401);
  }

  let payload: { eventId?: string; action?: string; options?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const eventId = payload.eventId;
  const action = payload.action ?? "preview";
  if (!eventId || typeof eventId !== "string") {
    return json({ error: "eventId is required." }, 400);
  }
  if (action !== "preview" && action !== "finalize") {
    return json({ error: "Unknown action." }, 400);
  }

  // User-scoped client: reads honour the caller's RLS, exactly like the old
  // client-side path did with the member's session.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return json({ error: "Not authenticated." }, 401);
  }
  const userId = userData.user.id;

  const isAdmin = await checkAdmin(userClient);
  const options = (payload.options ?? undefined) as Parameters<typeof getEventDecisionPreview>[1]["options"];

  try {
    if (action === "preview") {
      const result = await getEventDecisionPreview(userClient, { eventId, options });
      if (result.error) {
        return json({ error: result.error.message }, 400);
      }
      const sportNames = await loadSportNames(userClient);
      return json({ view: buildDecisionView(result.data, sportNames, { isAdmin, userId }) });
    }

    // action === "finalize" — admins / managers only.
    const canManage = isAdmin || (await canCloseEvent(userClient, eventId, userId));
    if (!canManage) {
      return json({ error: "Nur Admins oder Verantwortliche dürfen eine Entscheidung abschließen." }, 403);
    }

    // Writes use the service role so the client never needs write access to the
    // protected decision columns.
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await finalizeEventDecision(serviceClient, { eventId, options });
    if (result.error) {
      return json({ error: result.error.message }, 400);
    }
    const sportNames = await loadSportNames(serviceClient);
    return json({ event: result.data.event, view: buildDecisionView(result.data.decision, sportNames, { isAdmin: true, userId }) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error." }, 500);
  }
});

async function checkAdmin(client: ReturnType<typeof createClient>): Promise<boolean> {
  const rpcResult = await client.rpc("is_current_mcc_admin");
  if (!rpcResult.error && typeof rpcResult.data === "boolean") {
    return rpcResult.data;
  }
  return false;
}

async function canCloseEvent(
  client: ReturnType<typeof createClient>,
  eventId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("event_can_be_closed_by", { target_event_id: eventId, actor_id: userId });
  return !error && Boolean(data);
}

async function loadSportNames(client: ReturnType<typeof createClient>): Promise<SportNameMap> {
  const { data } = await client.from("sports").select("id, name");
  return new Map((data ?? []).map((sport: { id: string; name: string }) => [sport.id, sport.name]));
}
