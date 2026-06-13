import { router } from "expo-router";
import { useState } from "react";
import { LabeledInput } from "../../src/components/FormControls";
import { InlineError, MccButton, MccCard, MccScreen } from "../../src/components/MccDesign";
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
    <MccScreen title="Club erstellen" kicker="Setup" subtitle="Name, kurzer Zweck, fertig. Der gemeinsame Cardiotag bleibt sonntags.">
      <MccCard accent>
        <LabeledInput label="Clubname" value={name} onChangeText={setName} placeholder="Messers Cardio Club" />
        <LabeledInput label="Beschreibung" value={description} onChangeText={setDescription} placeholder="Wöchentlicher Sporttag" multiline />
        <InlineError>{error}</InlineError>
        <MccButton label="Club speichern" icon="content-save-outline" onPress={submit} disabled={loading || name.trim().length === 0} />
      </MccCard>
    </MccScreen>
  );
}
