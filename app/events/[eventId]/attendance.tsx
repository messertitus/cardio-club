import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { InlineError, LoadingSkeleton, MccBadge, MccBody, MccButton, MccCard, MccCardTitle, MccScreen } from "../../../src/components/MccDesign";
import { useAuth } from "../../../src/context/AuthContext";
import { supabase } from "../../../src/lib/supabase";
import { eventInputOpen, formatBerlinTime, isVotingInputOpen } from "../../../src/services/date";
import {
  isCurrentUserAdmin,
  listAttendance,
  listEventActivities,
  reviewAttendance,
  updateAttendance,
  type ActualAttendanceStatus,
  type AttendanceStatus,
  type Row,
} from "../../../src/services";

export default function AttendanceScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<Row<"attendance">[]>([]);
  const [event, setEvent] = useState<Row<"weekly_events"> | null>(null);
  const [eventActivities, setEventActivities] = useState<Row<"event_activities">[]>([]);
  const [profileNames, setProfileNames] = useState<Map<string, string>>(new Map());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    setLoading(true);
    const [attendanceResult, eventResult, activitiesResult, adminResult] = await Promise.all([
      listAttendance(supabase, eventId),
      supabase.from("weekly_events").select().eq("id", eventId).maybeSingle(),
      listEventActivities(supabase, eventId),
      user ? isCurrentUserAdmin(supabase, user.id) : Promise.resolve({ data: false, error: null }),
    ]);
    const rows = attendanceResult.data ?? [];
    const userIds = [...new Set(rows.map((entry) => entry.user_id))];
    const profilesResult = userIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] as Array<Pick<Row<"profiles">, "id" | "display_name">>, error: null };

    setAttendance(rows);
    setEvent(eventResult.data ?? null);
    setEventActivities(activitiesResult.data ?? []);
    setIsAdmin(adminResult.data ?? false);
    setProfileNames(new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name])));
    setError(
      attendanceResult.error?.message ??
        eventResult.error?.message ??
        activitiesResult.error?.message ??
        profilesResult.error?.message ??
        adminResult.error?.message ??
        null,
    );
    setLoading(false);
  }

  async function setStatus(status: AttendanceStatus) {
    if (!user) {
      return;
    }

    const result = await updateAttendance(supabase, {
      eventId,
      userId: user.id,
      status,
    });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await load();
  }

  async function setActualStatus(entry: Row<"attendance">, actualStatus: ActualAttendanceStatus) {
    if (!user) {
      return;
    }

    const result = await reviewAttendance(supabase, {
      eventId,
      userId: entry.user_id,
      actualStatus,
    });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await load();
  }

  const going = attendance.filter((entry) => entry.status === "going").length;
  const maybe = attendance.filter((entry) => entry.status === "maybe").length;
  const notGoing = attendance.filter((entry) => entry.status === "not_going").length;
  const ownAttendance = attendance.find((entry) => entry.user_id === user?.id) ?? null;
  const ownStatus = ownAttendance?.status;
  const canReview = useMemo(() => {
    const reviewerIsParticipant = ownStatus === "going" || ownStatus === "maybe";
    if (!user || !reviewerIsParticipant) return false;
    return isAdmin || event?.activity_contact_id === user.id || eventActivities.some((activity) => activity.activity_contact_id === user.id);
  }, [event?.activity_contact_id, eventActivities, isAdmin, ownStatus, user]);
  const rsvpOpen = Boolean(event && isVotingInputOpen(event.week_start_date, event.event_day));
  // Actual attendance may only be recorded from the exact event start time on.
  const reviewOpen = Boolean(event && eventInputOpen(event.starts_at, event.week_start_date, event.event_day));

  return (
    <MccScreen title="Teilnahme" kicker="RSVP" subtitle="Plane deine Teilnahme — und trage nach dem Event die tatsächliche Anwesenheit ein.">
      <InlineError>{error}</InlineError>
      {loading ? <LoadingSkeleton lines={3} /> : null}
      {rsvpOpen ? (
        <MccCard accent>
          <MccBadge icon="account-check-outline">Dein Status: {attendanceStatusLabel(ownStatus)}</MccBadge>
          <MccCardTitle>Bist du dabei?</MccCardTitle>
          <MccButton label="Ich bin dabei" onPress={() => setStatus("going")} />
          <MccButton label="Vielleicht" variant="secondary" onPress={() => setStatus("maybe")} />
          <MccButton label="Nicht dabei" variant="secondary" onPress={() => setStatus("not_going")} />
        </MccCard>
      ) : null}
      <MccCard>
        <MccCardTitle>Teilnehmende</MccCardTitle>
        <MccBody>Dabei: {going}</MccBody>
        <MccBody>Vielleicht: {maybe}</MccBody>
        <MccBody>Nicht dabei: {notGoing}</MccBody>
      </MccCard>
      <MccCard>
        <MccCardTitle>AP-Nachbereitung</MccCardTitle>
        <MccBody muted>Geplantes RSVP bleibt getrennt von der tatsächlichen Anwesenheit.</MccBody>
        <MccBody muted>Auch Personen mit "Nicht dabei" können hier als tatsächlich anwesend markiert werden.</MccBody>
        {!canReview ? <MccBody muted>Die Prüfung ist nur für Admins, Event-Kontakt oder Profil-AP sichtbar, wenn diese Person selbst Dabei oder Vielleicht gesetzt hat.</MccBody> : null}
        {canReview && !reviewOpen ? (
          <MccBody muted>
            Die tatsächliche Anwesenheit kann erst ab Eventbeginn{event?.starts_at ? ` (${formatBerlinTime(event.starts_at)} Uhr)` : ""} eingetragen werden.
          </MccBody>
        ) : null}
        {attendance.map((entry) => (
          <View key={entry.id} style={{ gap: 8 }}>
            <MccBody>
              {displayName(entry, profileNames, user?.id)} · geplant: {plannedLabel(entry.status)} · tatsächlich: {actualLabel(entry.actual_status)}
            </MccBody>
            {canReview && reviewOpen ? (
              <>
                <MccButton label={entry.status === "not_going" ? "War doch da" : "War da"} variant="secondary" onPress={() => setActualStatus(entry, "present")} />
                <MccButton label="Nicht erschienen" variant="secondary" onPress={() => setActualStatus(entry, "absent")} />
                <MccButton label="Entschuldigt" variant="ghost" onPress={() => setActualStatus(entry, "excused")} />
              </>
            ) : null}
          </View>
        ))}
      </MccCard>
    </MccScreen>
  );
}

function displayName(entry: Row<"attendance">, names: Map<string, string>, ownUserId?: string): string {
  if (entry.user_id === ownUserId) return "Du";
  return names.get(entry.user_id) ?? "Mitglied";
}

function attendanceStatusLabel(status?: AttendanceStatus): string {
  if (status === "going") return "Dabei";
  if (status === "maybe") return "Vielleicht";
  if (status === "not_going") return "Nicht dabei";
  return "Offen";
}

function plannedLabel(status: AttendanceStatus): string {
  if (status === "going") return "Dabei";
  if (status === "maybe") return "Vielleicht";
  return "Nicht dabei";
}

function actualLabel(status: ActualAttendanceStatus | null): string {
  if (status === "present") return "war da";
  if (status === "absent") return "nicht erschienen";
  if (status === "excused") return "entschuldigt";
  return "offen";
}
