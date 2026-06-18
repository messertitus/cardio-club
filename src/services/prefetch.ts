// Warm the caches of the secondary tabs (Members + Chat) in the background from
// the home screen, so the first switch to those tabs paints instantly from cache
// instead of showing a spinner. Best-effort and once per user per session.
import { loadChatBundle } from "./chatBundle";
import { finalizeDueDecisions } from "./decisions";
import { chatCacheKey, membersCacheKey, writeLocalCache } from "./localCache";
import type { AppSupabaseClient } from "./supabaseClient";

let prefetchedFor: string | null = null;

// Client fallback for the 48h finalize: when a member opens the app we ask the
// server to finalize any due events. Time-throttled so repeated screen loads
// don't hammer the Edge Function. The periodic send-push sweep is the primary
// driver; this just covers projects without a cron.
let lastFinalizeAt = 0;
const FINALIZE_MIN_INTERVAL_MS = 2 * 60 * 1000;

export async function triggerDueFinalize(supabase: AppSupabaseClient): Promise<void> {
  const now = Date.now();
  if (now - lastFinalizeAt < FINALIZE_MIN_INTERVAL_MS) return;
  lastFinalizeAt = now;
  try {
    const result = await finalizeDueDecisions(supabase);
    if (result.error) lastFinalizeAt = 0; // let the next load retry
  } catch {
    lastFinalizeAt = 0;
  }
}

export async function prefetchSecondaryTabs(supabase: AppSupabaseClient, userId: string): Promise<void> {
  if (prefetchedFor === userId) return;
  prefetchedFor = userId;
  try {
    // One assembly warms BOTH caches: the chat bundle already contains the full
    // member list the Members tab caches, so we don't fetch members twice.
    const bundle = await loadChatBundle(supabase, userId);
    if (!bundle.error) {
      void writeLocalCache(chatCacheKey(userId), bundle.data);
      void writeLocalCache(membersCacheKey(userId), bundle.data.members);
    } else {
      // Let a failed attempt retry on the next home visit.
      prefetchedFor = null;
    }
  } catch {
    prefetchedFor = null;
  }
}

// Allow the next user to prefetch again, e.g. on sign-out.
export function resetPrefetchGuard(): void {
  prefetchedFor = null;
  lastFinalizeAt = 0;
}
