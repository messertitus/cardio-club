import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, ErrorText, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { supabase } from "../../../src/lib/supabase";
import { listAttendance, reviewAttendance, updateAttendance, type ActualAttendanceStatus, type AttendanceStatus, type Row } from "../../../src/services";

export default function AttendanceScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<Row<"attendance">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    setLoading(true);
    const result = await listAttendance(supabase, eventId);
    setAttendance(result.data ?? []);
    setError(result.error?.message ?? null);
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
  const ownStatus = attendance.find((entry) => entry.user_id === user?.id)?.status;

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
        <Text style={ui.body}>Nach dem Event kann eine prüfende Person markieren, wer wirklich da war.</Text>
        {attendance.map((entry) => (
          <View key={entry.id} style={{ gap: 8 }}>
            <Text style={ui.body}>
              {entry.user_id === user?.id ? "Du" : entry.user_id} · geplant: {entry.status} · geprüft: {entry.actual_status ?? "offen"}
            </Text>
            <Button label="War da" variant="secondary" onPress={() => setActualStatus(entry, "present")} />
            <Button label="Nicht erschienen" variant="secondary" onPress={() => setActualStatus(entry, "absent")} />
            <Button label="Entschuldigt" variant="ghost" onPress={() => setActualStatus(entry, "excused")} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
