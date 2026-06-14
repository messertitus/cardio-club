// Central, privacy-first analytics registry. PURE (no I/O), so it is unit
// tested and shared by the client tracking service and any future job.
//
// Purpose binding: only the keys listed here are "blessed" app metrics. Each
// key must match the same format the database enforces (056_user_analytics_*),
// i.e. lowercase dotted/underscored segments. The accompanying test asserts
// this, so a typo or a sensitive free-text key can never ship.
//
// Data minimisation: a tracked event optionally carries a tiny `context`
// object with NON-SENSITIVE identifiers only (eventId, sportId, screen, status,
// rank, source). Never message content, names, phone numbers, or coordinates.

// Must mirror is_valid_stat_key() in migration 056.
export const STAT_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/;

export function isValidStatKey(value: string): boolean {
  return value.length >= 2 && value.length <= 80 && STAT_KEY_PATTERN.test(value);
}

// Engagement / app usage.
export const APP_EVENTS = {
  sessionStarted: "app.session_started",
  standaloneDetected: "app.standalone_detected",
  pushEnabled: "app.push_enabled",
  pushDisabled: "app.push_disabled",
  onboardingCompleted: "onboarding.completed",
  installHintSeen: "install_hint.seen",
  installHintDismissed: "install_hint.dismissed",
} as const;

// Screen views (engagement + navigation interest).
export const SCREEN_EVENTS = {
  event: "screen.event_viewed",
  vote: "screen.vote_viewed",
  decision: "screen.decision_viewed",
  chat: "screen.chat_viewed",
  members: "screen.members_viewed",
  profile: "screen.profile_viewed",
  ideas: "screen.ideas_viewed",
  invites: "screen.invites_viewed",
  menu: "screen.menu_viewed",
  settings: "screen.settings_viewed",
  push: "screen.push_viewed",
  install: "screen.install_viewed",
  history: "screen.history_viewed",
  clubs: "screen.clubs_viewed",
  howItWorks: "screen.how_it_works_viewed",
} as const;

// Feature adoption — which tools members actually use.
export const FEATURE_EVENTS = {
  mapRouteOpened: "feature.map_route_opened",
  themeToggled: "feature.theme_toggled",
  directChatStarted: "feature.direct_chat_started",
  chatReplySent: "feature.chat_reply_sent",
} as const;

// Event participation. attended / no_show are recorded server-side (057) from
// the admin/AP attendance review, since the subject ≠ the actor.
export const PARTICIPATION_EVENTS = {
  attendanceSet: "attendance.set",
  attendanceChanged: "attendance.changed",
  attendanceGoing: "attendance.going",
  attendanceMaybe: "attendance.maybe",
  attendanceNotGoing: "attendance.not_going",
  attended: "attendance.attended",
  noShow: "attendance.no_show",
} as const;

// Voting (ranked-choice usage; outcomes are recorded as results, never the
// algorithm internals).
export const VOTE_EVENTS = {
  submitted: "vote.submitted",
  changed: "vote.changed",
  removed: "vote.removed",
  rank1: "vote.rank1",
  rank2: "vote.rank2",
  rank3: "vote.rank3",
  // Recorded server-side (057) when the weekly decision is finalized. Result
  // data only — compares the user's picks to the public decided sport(s).
  wishWon: "vote.wish_won",
  wishPartial: "vote.wish_partial",
  wishNotMet: "vote.wish_not_met",
} as const;

// No-Go usage (no sensitive reasons are tracked).
export const NOGO_EVENTS = {
  added: "nogo.added",
  removed: "nogo.removed",
} as const;

// Sport / location engagement & contribution. accepted / rejected are recorded
// server-side (057) from the admin review, credited to the suggester.
export const CONTRIBUTION_EVENTS = {
  ideaSuggested: "idea.suggested",
  ideaAccepted: "idea.accepted",
  ideaRejected: "idea.rejected",
  proposalCreated: "proposal.created",
  profileUpdated: "profile.updated",
} as const;

// Community. inviteUsed (credited to the inviter) and clubJoined are recorded
// server-side (057), since they are triggered by another user / at signup.
export const COMMUNITY_EVENTS = {
  chatMessageSent: "chat.message_sent",
  inviteCreated: "invite.created",
  inviteUsed: "invite.used",
  clubJoined: "club.joined",
} as const;

// Flat union of every blessed key, used by the test to validate the format and
// by callers for type-safe tracking.
export const ALL_STAT_KEYS = [
  ...Object.values(APP_EVENTS),
  ...Object.values(SCREEN_EVENTS),
  ...Object.values(FEATURE_EVENTS),
  ...Object.values(PARTICIPATION_EVENTS),
  ...Object.values(VOTE_EVENTS),
  ...Object.values(NOGO_EVENTS),
  ...Object.values(CONTRIBUTION_EVENTS),
  ...Object.values(COMMUNITY_EVENTS),
] as const;

export type StatKey = (typeof ALL_STAT_KEYS)[number];

// Human-readable German labels for the admin test menu. Falls back to the raw
// key for any not listed (e.g. future keys written before this map is updated).
export const STAT_KEY_LABELS: Record<string, string> = {
  [APP_EVENTS.sessionStarted]: "App geöffnet (Sessions)",
  [APP_EVENTS.standaloneDetected]: "Als App genutzt (Standalone)",
  [APP_EVENTS.pushEnabled]: "Push aktiviert",
  [APP_EVENTS.pushDisabled]: "Push deaktiviert",
  [APP_EVENTS.onboardingCompleted]: "Onboarding abgeschlossen",
  [APP_EVENTS.installHintSeen]: "Install-Hinweis gesehen",
  [APP_EVENTS.installHintDismissed]: "Install-Hinweis geschlossen",
  [SCREEN_EVENTS.event]: "Event-Seite geöffnet",
  [SCREEN_EVENTS.vote]: "Abstimmung geöffnet",
  [SCREEN_EVENTS.decision]: "Entscheidung geöffnet",
  [SCREEN_EVENTS.chat]: "Chat geöffnet",
  [SCREEN_EVENTS.members]: "Mitgliederseite geöffnet",
  [SCREEN_EVENTS.profile]: "Profil geöffnet",
  [SCREEN_EVENTS.ideas]: "Sportarten/Standorte geöffnet",
  [SCREEN_EVENTS.invites]: "Einladungen geöffnet",
  [SCREEN_EVENTS.menu]: "Menü geöffnet",
  [SCREEN_EVENTS.settings]: "Einstellungen geöffnet",
  [SCREEN_EVENTS.push]: "Push-Seite geöffnet",
  [SCREEN_EVENTS.install]: "Installationsseite geöffnet",
  [SCREEN_EVENTS.history]: "Verlauf geöffnet",
  [SCREEN_EVENTS.clubs]: "Club-Seite geöffnet",
  [SCREEN_EVENTS.howItWorks]: "Fairness-Erklärung geöffnet",
  [FEATURE_EVENTS.mapRouteOpened]: "Karte/Route geöffnet",
  [FEATURE_EVENTS.themeToggled]: "Design gewechselt (hell/dunkel)",
  [FEATURE_EVENTS.directChatStarted]: "Direktchat gestartet",
  [FEATURE_EVENTS.chatReplySent]: "Chat-Antwort gesendet",
  [PARTICIPATION_EVENTS.attendanceSet]: "Teilnahme gesetzt",
  [PARTICIPATION_EVENTS.attendanceChanged]: "Teilnahme geändert",
  [PARTICIPATION_EVENTS.attendanceGoing]: "Teilnahme: dabei",
  [PARTICIPATION_EVENTS.attendanceMaybe]: "Teilnahme: vielleicht",
  [PARTICIPATION_EVENTS.attendanceNotGoing]: "Teilnahme: nicht dabei",
  [PARTICIPATION_EVENTS.attended]: "Event tatsächlich besucht",
  [PARTICIPATION_EVENTS.noShow]: "No-Shows",
  [VOTE_EVENTS.submitted]: "Votes abgegeben",
  [VOTE_EVENTS.changed]: "Votes geändert",
  [VOTE_EVENTS.removed]: "Votes entfernt",
  [VOTE_EVENTS.rank1]: "Rang 1 genutzt",
  [VOTE_EVENTS.rank2]: "Rang 2 genutzt",
  [VOTE_EVENTS.rank3]: "Rang 3 genutzt",
  [VOTE_EVENTS.wishWon]: "Wunsch gewonnen",
  [VOTE_EVENTS.wishPartial]: "Wunsch teilweise abgedeckt",
  [VOTE_EVENTS.wishNotMet]: "Wunsch nicht berücksichtigt",
  [NOGO_EVENTS.added]: "No-Gos gesetzt",
  [NOGO_EVENTS.removed]: "No-Gos entfernt",
  [CONTRIBUTION_EVENTS.ideaSuggested]: "Sport/Standort vorgeschlagen",
  [CONTRIBUTION_EVENTS.ideaAccepted]: "Vorschlag angenommen",
  [CONTRIBUTION_EVENTS.ideaRejected]: "Vorschlag abgelehnt",
  [CONTRIBUTION_EVENTS.proposalCreated]: "Event-Vorschlag erstellt",
  [CONTRIBUTION_EVENTS.profileUpdated]: "Profil bearbeitet",
  [COMMUNITY_EVENTS.chatMessageSent]: "Nachrichten gesendet",
  [COMMUNITY_EVENTS.inviteCreated]: "Einladungscode erstellt",
  [COMMUNITY_EVENTS.inviteUsed]: "Einladung genutzt",
  [COMMUNITY_EVENTS.clubJoined]: "Club beigetreten",
};

export function statKeyLabel(key: string): string {
  return STAT_KEY_LABELS[key] ?? key;
}

// Maps an attendance status to its history counter key.
export function attendanceStatusKey(status: "going" | "maybe" | "not_going"): StatKey {
  if (status === "going") return PARTICIPATION_EVENTS.attendanceGoing;
  if (status === "maybe") return PARTICIPATION_EVENTS.attendanceMaybe;
  return PARTICIPATION_EVENTS.attendanceNotGoing;
}

// Maps a ranked vote choice (1/2/3) to its usage counter key.
export function voteRankKey(rank: 1 | 2 | 3): StatKey {
  if (rank === 1) return VOTE_EVENTS.rank1;
  if (rank === 2) return VOTE_EVENTS.rank2;
  return VOTE_EVENTS.rank3;
}
