import type { Row } from "../services/database.types";

// Whether an event's chat should exist. The chat opens once the decision has
// actually been finalized (status `decided`), NOT merely when the 48h moment
// passed — there is no live preview anymore, so the chat follows the persisted
// decision. cancelled never; completed keeps its chat for the close-out window;
// the < 2 attending voters guard mirrors cancel_underused_events as a safety net
// in case the server cancel job has not run yet. Single source of truth — both
// the chat loader (getWeekChatStates) and the chat screen's channel builder use
// this, so they can never disagree on which chats appear.
export function isEventDecisionReadyForChat(event: Row<"weekly_events">, attendingVoterCount: number): boolean {
  if (event.status === "cancelled") return false;
  if (event.status === "completed") return true;
  if (attendingVoterCount < 2) return false;
  return event.status === "decided";
}
