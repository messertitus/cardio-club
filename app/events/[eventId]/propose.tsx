import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SearchField } from "../../../src/components/FormControls";
import { InlineError, LoadingSkeleton, MccBadge, MccBody, MccButton, MccScreen, SportVoteCard } from "../../../src/components/MccDesign";
import { SportIconBadge } from "../../../src/components/SportIcon";
import { useAuth } from "../../../src/context/AuthContext";
import { supabase } from "../../../src/lib/supabase";
import { listEventProposals, listSports, proposeSport, type Row } from "../../../src/services";

export default function ProposeSportScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [proposals, setProposals] = useState<Row<"sport_proposals">[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSportId, setSavingSportId] = useState<string | null>(null);
  const [sportSearch, setSportSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const proposedSportIds = useMemo(() => new Set(proposals.map((proposal) => proposal.sport_id)), [proposals]);
  const filteredSports = useMemo(() => {
    const query = sportSearch.trim().toLowerCase();
    if (!query) return sports;
    return sports.filter((sport) =>
      [sport.name, sport.category, sport.intensity_level, sport.combinable_tags?.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [sportSearch, sports]);

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    setLoading(true);
    const [sportsResult, proposalsResult] = await Promise.all([
      listSports(supabase),
      listEventProposals(supabase, eventId),
    ]);
    setSports(sportsResult.data ?? []);
    setProposals(proposalsResult.data ?? []);
    setError(sportsResult.error?.message ?? proposalsResult.error?.message ?? null);
    setLoading(false);
  }

  async function submit(sportId: string) {
    if (!user) {
      router.replace("/auth");
      return;
    }

    setSavingSportId(sportId);
    const result = await proposeSport(supabase, {
      eventId,
      sportId,
      proposedBy: user.id,
    });
    setSavingSportId(null);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await load();
  }

  return (
    <MccScreen title="Sportart vorschlagen" kicker="Ideen" subtitle="Nur vorgeschlagene Sportarten können diese Woche gewinnen.">
      <InlineError>{error}</InlineError>
      {loading ? <LoadingSkeleton lines={3} /> : null}
      <SearchField value={sportSearch} onChangeText={setSportSearch} placeholder="Sportart suchen" />
      {!loading && filteredSports.length === 0 ? <MccBody muted>Keine Sportarten für diese Suche.</MccBody> : null}
      {filteredSports.map((sport, index) => {
        const proposed = proposedSportIds.has(sport.id);

        return (
          <SportVoteCard
            key={sport.id}
            title={sport.name}
            meta={`${sport.intensity_level} - ${sport.location_type}`}
            icon={<SportIconBadge sport={sport} size={42} />}
            selected={proposed}
            index={index}
            right={<MccBadge tone={proposed ? "success" : "neutral"}>{sport.category}</MccBadge>}
          >
            <MccButton
              label={proposed ? "Bereits vorgeschlagen" : "Vorschlagen"}
              variant={proposed ? "secondary" : "primary"}
              disabled={proposed || savingSportId === sport.id}
              onPress={() => submit(sport.id)}
            />
          </SportVoteCard>
        );
      })}
      <MccButton label="Weiter zur Abstimmung" icon="vote-outline" variant="secondary" onPress={() => router.push(`/events/${eventId}/vote`)} />
    </MccScreen>
  );
}
