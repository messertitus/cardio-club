import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text } from "react-native";
import { Button, Card, EmptyState, ErrorText, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { buildDecisionPresentation } from "../../../src/lib/decisionPresentation";
import type { VoteRank } from "../../../src/lib/votingRules";
import { supabase } from "../../../src/lib/supabase";
import {
  getEventDecisionPreview,
  listEventProposals,
  listEventVotes,
  listSports,
  removeVote,
  voteForSport,
  type EventDecisionPreview,
  type Row,
} from "../../../src/services";

export default function VoteOnSportsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [proposals, setProposals] = useState<Row<"sport_proposals">[]>([]);
  const [votes, setVotes] = useState<Row<"sport_votes">[]>([]);
  const [preview, setPreview] = useState<EventDecisionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sportsById = useMemo(() => new Map(sports.map((sport) => [sport.id, sport])), [sports]);
  const sportNames = useMemo(() => new Map(sports.map((sport) => [sport.id, sport.name])), [sports]);
  const previewPresentation = useMemo(
    () => (preview ? buildDecisionPresentation(preview, sportNames) : null),
    [preview, sportNames],
  );
  const myVotes = useMemo(
    () => votes.filter((vote) => vote.user_id === user?.id).sort((a, b) => a.vote_rank - b.vote_rank),
    [user?.id, votes],
  );
  const myVoteBySport = useMemo(() => new Map(myVotes.map((vote) => [vote.sport_id, vote])), [myVotes]);
  const usedRankBySport = useMemo(() => new Map(myVotes.map((vote) => [vote.vote_rank, vote.sport_id])), [myVotes]);

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    setLoading(true);
    const [sportsResult, proposalsResult, votesResult, previewResult] = await Promise.all([
      listSports(supabase),
      listEventProposals(supabase, eventId),
      listEventVotes(supabase, eventId),
      getEventDecisionPreview(supabase, { eventId }),
    ]);
    setSports(sportsResult.data ?? []);
    setProposals(proposalsResult.data ?? []);
    setVotes(votesResult.data ?? []);
    setPreview(previewResult.data);
    setError(
      sportsResult.error?.message ??
        proposalsResult.error?.message ??
        votesResult.error?.message ??
        previewResult.error?.message ??
        null,
    );
    setLoading(false);
  }

  async function setRankedVote(sportId: string, rank: VoteRank) {
    if (!user) {
      router.replace("/auth");
      return;
    }

    const result = await voteForSport(supabase, {
      eventId,
      sportId,
      userId: user.id,
      rank,
    });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await load();
  }

  async function removeMyVote(sportId: string) {
    if (!user) {
      router.replace("/auth");
      return;
    }

    const result = await removeVote(supabase, { eventId, sportId, userId: user.id });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await load();
  }

  function countVotes(sportId: string) {
    return votes
      .filter((vote) => vote.sport_id === sportId)
      .reduce((total, vote) => total + vote.weight, 0)
      .toFixed(1);
  }

  function rankLabel(rank: VoteRank) {
    if (rank === 1) {
      return "1. Wahl";
    }
    if (rank === 2) {
      return "2. Wahl";
    }
    return "3. Wahl";
  }

  return (
    <Screen title="Abstimmen" subtitle="Du kannst bis zu drei Sportarten wählen: erste Wahl zählt am stärksten, dritte Wahl etwas weniger.">
      <ErrorText>{error}</ErrorText>
      {loading ? <LoadingState /> : null}

      {previewPresentation ? (
        <Card>
          <Pill>Vorschau</Pill>
          <Text style={ui.cardTitle}>Aktuelle Entscheidung: {previewPresentation.selectedSportName}</Text>
          {previewPresentation.secondarySportName ? <Text style={ui.body}>+ {previewPresentation.secondarySportName}</Text> : null}
          <Text style={ui.body}>{previewPresentation.simpleExplanation}</Text>
          <Button label="Entscheidung anzeigen" variant="secondary" onPress={() => router.push(`/events/${eventId}/decision`)} />
        </Card>
      ) : null}

      <Card>
        <Text style={ui.cardTitle}>Deine Stimmen</Text>
        <Text style={ui.body}>Maximal drei Stimmen pro Woche. Dieselbe Sportart kann nicht doppelt gewählt werden.</Text>
        {myVotes.length === 0 ? <Text style={ui.body}>Du hast noch nicht abgestimmt.</Text> : null}
        {myVotes.map((vote) => (
          <Text key={vote.id} style={ui.body}>
            {rankLabel(vote.vote_rank as VoteRank)}: {sportsById.get(vote.sport_id)?.name ?? vote.sport_id}
          </Text>
        ))}
      </Card>

      {!loading && proposals.length === 0 ? <EmptyState title="Noch keine Vorschläge" body="Schlage zuerst eine Sportart vor." /> : null}
      {proposals.map((proposal) => {
        const sport = sportsById.get(proposal.sport_id);
        const myVote = myVoteBySport.get(proposal.sport_id);

        return (
          <Card key={proposal.id}>
            <Pill>{countVotes(proposal.sport_id)} gewichtete Stimmen</Pill>
            <Text style={ui.cardTitle}>{sport?.name ?? proposal.sport_id}</Text>
            <Text style={ui.body}>{sport ? `${sport.category} · ${sport.location_type}` : "Vorgeschlagene Sportart"}</Text>
            {myVote ? <Text style={ui.body}>Deine Auswahl: {rankLabel(myVote.vote_rank as VoteRank)}</Text> : null}
            {[1, 2, 3].map((rank) => {
              const typedRank = rank as VoteRank;
              const rankUsedByOtherSport = usedRankBySport.get(typedRank) && usedRankBySport.get(typedRank) !== proposal.sport_id;

              return (
                <Button
                  key={rank}
                  label={rankLabel(typedRank)}
                  variant={myVote?.vote_rank === typedRank ? "primary" : "secondary"}
                  disabled={Boolean(rankUsedByOtherSport)}
                  onPress={() => setRankedVote(proposal.sport_id, typedRank)}
                />
              );
            })}
            {myVote ? <Button label="Stimme entfernen" variant="ghost" onPress={() => removeMyVote(proposal.sport_id)} /> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
