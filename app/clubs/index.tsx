import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { EmptyState, LoadingSkeleton, MccBadge, MccBody, MccButton, MccCard, MccCardTitle, MccScreen } from "../../src/components/MccDesign";
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
    <MccScreen title="Deine Clubs" kicker="MCC" subtitle="Wähle deinen Club aus oder starte einen neuen gemeinsamen Cardiotag.">
      <MccButton label="Club erstellen" icon="plus-circle-outline" onPress={() => router.push("/clubs/create")} />
      {error ? (
        <MccBadge tone="danger" icon="alert-circle-outline">
          {error}
        </MccBadge>
      ) : null}
      {loading ? <LoadingSkeleton lines={3} /> : null}
      {!loading && clubs.length === 0 ? <EmptyState title="Noch kein Club" body="Erstelle einen Club und lade deine Gruppe ein." /> : null}
      {clubs.map((club) => (
        <MccCard key={club.id} accent>
          <View style={{ gap: 10 }}>
            <MccBadge icon="account-group-outline">{club.role}</MccBadge>
            <MccCardTitle>{club.name}</MccCardTitle>
            {club.description ? <MccBody muted>{club.description}</MccBody> : null}
          </View>
          <MccButton label="Öffnen" icon="arrow-right" variant="secondary" onPress={() => router.push(`/clubs/${club.id}`)} />
        </MccCard>
      ))}
      <MccButton label="Abmelden" icon="logout" variant="ghost" onPress={() => supabase.auth.signOut()} />
    </MccScreen>
  );
}
