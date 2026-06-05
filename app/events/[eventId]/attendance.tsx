import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, ErrorText, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { supabase } from "../../../src/lib/supabase";
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

  return (
    <Screen title="Teilnahme" subtitle="Schnell sagen, ob du dabei bist. Keine Ranglisten, kein Druck.">
      <ErrorText>{error}</ErrorText>
      {loading ? <LoadingState /> : null}
      <Card>
        <Pill>Dein Status: {ownStatus ?? "offen"}</Pill>
        <Text style={ui.cardTitle}>Bist du dabei?</Text>
        <Button label="Ich bin dabei" onPress={() => setStatus("going")} />
        <Button label="Vielleicht" variant="secondary" onPress={() => setStatus("maybe")} />
        <Button label="Nicht dabei" variant="secondary" onPress={() => setStatus("not_going")} />
      </Card>
      <Card>
        <Text style={ui.cardTitle}>Teilnehmende</Text>
        <Text style={ui.body}>Dabei: {going}</Text>
        <Text style={ui.body}>Vielleicht: {maybe}</Text>
        <Text style={ui.body}>Nicht dabei: {notGoing}</Text>
      </Card>
      <Card>
        <Text style={ui.cardTitle}>AP-Nachbereitung</Text>
        <Text style={ui.body}>Geplantes RSVP bleibt getrennt von der tatsächlichen Anwesenheit.</Text>
        <Text style={ui.body}>Auch Personen mit "Nicht dabei" können hier als tatsächlich anwesend markiert werden.</Text>
        {!canReview ? <Text style={ui.body}>Die Prüfung ist nur für Admins, Event-Kontakt oder Profil-AP sichtbar, wenn diese Person selbst Dabei oder Vielleicht gesetzt hat.</Text> : null}
        {attendance.map((entry) => (
          <View key={entry.id} style={{ gap: 8 }}>
            <Text style={ui.body}>
              {displayName(entry, profileNames, user?.id)} · geplant: {plannedLabel(entry.status)} · tatsächlich: {actualLabel(entry.actual_status)}
            </Text>
            {canReview ? (
              <>
                <Button label={entry.status === "not_going" ? "War doch da" : "War da"} variant="secondary" onPress={() => setActualStatus(entry, "present")} />
                <Button label="Nicht erschienen" variant="secondary" onPress={() => setActualStatus(entry, "absent")} />
                <Button label="Entschuldigt" variant="ghost" onPress={() => setActualStatus(entry, "excused")} />
              </>
            ) : null}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function displayName(entry: Row<"attendance">, names: Map<string, string>, ownUserId?: string): string {
  if (entry.user_id === ownUserId) return "Du";
  return names.get(entry.user_id) ?? "Mitglied";
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
