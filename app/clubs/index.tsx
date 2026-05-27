import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text } from "react-native";
import { Button, Card, EmptyState, ErrorText, LoadingState, Pill, Screen, ui } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { supabase } from "../../src/lib/supabase";
import { listClubsForUser, type ClubWithRole } from "../../src/services";

export default function ClubListScreen() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<ClubWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        if (!user) {
          router.replace("/auth");
          return;
        }

        setLoading(true);
        const result = await listClubsForUser(supabase, user.id);

        if (!active) {
          return;
        }

        setError(result.error?.message ?? null);
        setClubs(result.data ?? []);
        setLoading(false);
      }

      load();

      return () => {
        active = false;
      };
    }, [user]),
  );

  return (
    <Screen title="Deine Clubs" subtitle="Wähle einen Club aus oder erstelle einen neuen gemeinsamen Cardiotag.">
      <Button label="Club erstellen" onPress={() => router.push("/clubs/create")} />
      <ErrorText>{error}</ErrorText>
      {loading ? <LoadingState /> : null}
      {!loading && clubs.length === 0 ? <EmptyState title="Noch kein Club" body="Erstelle einen Club und lade deine Gruppe ein." /> : null}
      {clubs.map((club) => (
        <Card key={club.id}>
          <Pill>{club.role}</Pill>
          <Text style={ui.cardTitle}>{club.name}</Text>
          {club.description ? <Text style={ui.body}>{club.description}</Text> : null}
          <Button label="Öffnen" variant="secondary" onPress={() => router.push(`/clubs/${club.id}`)} />
        </Card>
      ))}
      <Button label="Abmelden" variant="ghost" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
