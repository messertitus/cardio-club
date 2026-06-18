// The cacheable data the Chat screen needs, assembled in one place so the screen
// itself and the home-screen prefetch produce byte-for-byte the same shape (and
// write the same cache). Keeping this out of the screen also lets the prefetch
// warm the chat cache without importing any UI.
import { getWeekStartDate } from "./date";
import { listDirectChats, type DirectChatWithNames } from "./directChats";
import { getMccWeekEvents, getWeekChatStates, type MccEventState } from "./liveApp";
import { listMccMembers, type MccMember } from "./members";
import { ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type ChatBundle = {
  eventStates: MccEventState[];
  members: MccMember[];
  directChats: DirectChatWithNames[];
};

export async function loadChatBundle(
  supabase: AppSupabaseClient,
  userId: string,
): Promise<ServiceResult<ChatBundle>> {
  const [weekResult, directResult] = await Promise.all([getMccWeekEvents(supabase), listDirectChats(supabase)]);
  if (weekResult.error) return { data: null, error: weekResult.error };
  if (directResult.error) return { data: null, error: directResult.error };

  const membersResult = await listMccMembers(supabase, { clubId: weekResult.data.clubId });
  if (membersResult.error) return { data: null, error: membersResult.error };

  // Only this week's Cardiotage have a live chat; cancelled events are already
  // excluded by getMccWeekEvents.
  const currentWeek = getWeekStartDate();
  const weekRows = weekResult.data.events.filter((row) => row.week_start_date === currentWeek);
  const statesResult = await getWeekChatStates(supabase, userId, weekRows);
  if (statesResult.error) return { data: null, error: statesResult.error };

  // Local chats: the user's own city plus any event they joined elsewhere.
  const myCity = membersResult.data.find((member) => member.userId === userId)?.city ?? null;
  const eventStates = statesResult.data.filter(
    (entry) => !myCity || entry.event.city === myCity || entry.myAttendance != null,
  );

  return ok({ eventStates, members: membersResult.data, directChats: directResult.data });
}
