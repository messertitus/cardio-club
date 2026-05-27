import { router } from "expo-router";
import { useState } from "react";
import { Button, Card, ErrorText, Field, Screen } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { supabase } from "../../src/lib/supabase";
import { createClub } from "../../src/services";

export default function CreateClubScreen() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!user) {
      router.replace("/auth");
      return;
    }

    setLoading(true);
    setError(null);
    const result = await createClub(supabase, {
      name,
      description: description || null,
      createdBy: user.id,
      creatorDisplayName: user.email,
    });
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    router.replace(`/clubs/${result.data.club.id}`);
  }

  return (
    <Screen title="Club erstellen" subtitle="Halte es einfach: Name, kurzer Zweck, fertig.">
      <Card>
        <Field label="Clubname" value={name} onChangeText={setName} placeholder="Messers Cardio Club" />
        <Field label="Beschreibung" value={description} onChangeText={setDescription} placeholder="Wöchentlicher Sporttag" multiline />
        <ErrorText>{error}</ErrorText>
        <Button label="Club speichern" onPress={submit} disabled={loading || name.trim().length === 0} />
      </Card>
    </Screen>
  );
}
