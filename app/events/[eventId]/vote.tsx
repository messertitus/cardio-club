import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text } from "react-native";
import { SearchField } from "../../../src/components/FormControls";
import { Button, Card, EmptyState, ErrorText, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { buildDecisionPresentation } from "../../../src/lib/decisionPresentation";
import { excludeNonAttendingEntries, excludeNonAttendingVotes } from "../../../src/lib/votingEligibility";
import type { VoteRank } from "../../../src/lib/votingRules";
import { supabase } from "../../../src/lib/supabase";
import {
  getEventDecisionPreview,
  listAttendance,
  listEventNoGos,
  listEventProposals,
  listEventVotes,
  listSportProfilesForSports,
  listSports,
  removeSportNoGo,
  removeVote,
  setSportNoGo,
  updateAttendance,
  voteForSport,
  type AttendanceStatus,
  type EventDecisionPreview,
  type Row,
} from "../../../src/services";

export default function VoteOnSportsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [proposals, setProposals] = useState<Row<"sport_proposals">[]>([]);
  const [sportProfiles, setSportProfiles] = useState<Row<"sport_profiles">[]>([]);
  const [votes, setVotes] = useState<Row<"sport_votes">[]>([]);
  const [noGos, setNoGos] = useState<Row<"sport_no_gos">[]>([]);
  const [attendance, setAttendance] = useState<Row<"attendance">[]>([]);
  const [preview, setPreview] = useState<EventDecisionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposalSearch, setProposalSearch] = useState("");
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
  const myAttendance = useMemo(() => attendance.find((entry) => entry.user_id === user?.id) ?? null, [attendance, user?.id]);
  const canVote = myAttendance?.status === "going" || myAttendance?.status === "maybe";
  const filteredProposals = useMemo(() => {
    const query = proposalSearch.trim().toLowerCase();
    if (!query) return proposals;
    return proposals.filter((proposal) => {
      const sport = sportsById.get(proposal.sport_id);
      const profileText = sportProfiles
        .filter((profile) => profile.sport_id === proposal.sport_id)
        .map((profile) => [profile.name, profile.location_name, profile.location_city, profile.venue_group_key].filter(Boolean).join(" "))
        .join(" ");
      return [sport?.name, sport?.category, sport?.intensity_level, profileText].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [proposalSearch, proposals, sportProfiles, sportsById]);

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    setLoading(true);
    const [sportsResult, proposalsResult, votesResult, attendanceResult, previewResult] = await Promise.all([
      listSports(supabase),
      listEventProposals(supabase, eventId),
      listEventVotes(supabase, eventId),
      listAttendance(supabase, eventId),
      getEventDecisionPreview(supabase, { eventId }),
    ]);
    const proposedSportIds = proposalsResult.data?.map((proposal) => proposal.sport_id) ?? [];
    const [profilesResult, noGosResult] = await Promise.all([
      listSportProfilesForSports(supabase, proposedSportIds),
      listEventNoGos(supabase, eventId),
    ]);
    setSports(sportsResult.data ?? []);
    setProposals(proposalsResult.data ?? []);
    setSportProfiles(profilesResult.data ?? []);
    setAttendance(attendanceResult.data ?? []);
    setVotes(excludeNonAttendingVotes(votesResult.data ?? [], attendanceResult.data ?? []));
    setNoGos(excludeNonAttendingEntries(noGosResult.data ?? [], attendanceResult.data ?? []));
    setPreview(previewResult.data);
    setError(
      sportsResult.error?.message ??
        proposalsResult.error?.message ??
        profilesResult.error?.message ??
        votesResult.error?.message ??
        attendanceResult.error?.message ??
        noGosResult.error?.message ??
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

    if (!canVote) {
      setError("Bitte setze zuerst deine Teilnahme auf Dabei oder Vielleicht.");
      return;
    }

    if (noGos.some((noGo) => noGo.user_id === user.id && noGo.sport_id === sportId)) {
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

  async function toggleNoGo(sportId: string) {
    if (!user) {
      router.replace("/auth");
      return;
    }

    if (!canVote) {
      setError("No-Go ist erst möglich, wenn du Dabei oder Vielleicht gesetzt hast.");
      return;
    }

    const existing = noGos.find((noGo) => noGo.user_id === user.id && noGo.sport_id === sportId);
    if (existing) {
      const result = await removeSportNoGo(supabase, { eventId, sportId, userId: user.id });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      await load();
      return;
    }

    if (myVoteBySport.has(sportId)) {
      await removeVote(supabase, { eventId, sportId, userId: user.id });
    }

    const result = await setSportNoGo(supabase, { eventId, sportId, userId: user.id });
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

  async function chooseAttendance(status: AttendanceStatus) {
    if (!user) {
      router.replace("/auth");
      return;
    }

    const result = await updateAttendance(supabase, { eventId, userId: user.id, status });
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

      <Card>
        <Pill>Schritt 1</Pill>
        <Text style={ui.cardTitle}>Teilnahme zuerst</Text>
        <Text style={ui.body}>Nur Dabei und Vielleicht fließen in die Entscheidung ein. Nicht dabei wird ignoriert.</Text>
        <Text style={ui.body}>Dein Status: {attendanceLabel(myAttendance?.status)}</Text>
        <Button label="Ich bin dabei" variant={myAttendance?.status === "going" ? "primary" : "secondary"} onPress={() => chooseAttendance("going")} />
        <Button label="Vielleicht" variant={myAttendance?.status === "maybe" ? "primary" : "secondary"} onPress={() => chooseAttendance("maybe")} />
        <Button label="Nicht dabei" variant={myAttendance?.status === "not_going" ? "primary" : "ghost"} onPress={() => chooseAttendance("not_going")} />
      </Card>

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
        {!canVote ? <Text style={ui.body}>Abstimmen ist gesperrt, bis du Dabei oder Vielleicht gewählt hast.</Text> : null}
        {myVotes.length === 0 ? <Text style={ui.body}>Du hast noch nicht abgestimmt.</Text> : null}
        {myVotes.map((vote) => (
          <Text key={vote.id} style={ui.body}>
            {rankLabel(vote.vote_rank as VoteRank)}: {sportsById.get(vote.sport_id)?.name ?? vote.sport_id}
          </Text>
        ))}
      </Card>

      {!loading && proposals.length === 0 ? <EmptyState title="Noch keine Vorschläge" body="Schlage zuerst eine Sportart vor." /> : null}
      {proposals.length > 0 ? <SearchField value={proposalSearch} onChangeText={setProposalSearch} placeholder="Sportart oder Standort suchen" /> : null}
      {!loading && proposals.length > 0 && filteredProposals.length === 0 ? <Text style={ui.body}>Keine Vorschläge für diese Suche.</Text> : null}
      {filteredProposals.map((proposal) => {
        const sport = sportsById.get(proposal.sport_id);
        const myVote = myVoteBySport.get(proposal.sport_id);
        const myNoGo = noGos.some((entry) => entry.user_id === user?.id && entry.sport_id === proposal.sport_id);

        return (
          <Card key={proposal.id}>
            <Pill>{countVotes(proposal.sport_id)} gewichtete Stimmen</Pill>
            <Text style={ui.cardTitle}>{sport?.name ?? proposal.sport_id}</Text>
            <Text style={ui.body}>{sport ? `${sport.category} · ${sport.intensity_level}` : "Vorgeschlagene Sportart"}</Text>
            <Text style={ui.body}>{profileSummary(sportProfiles, proposal.sport_id)}</Text>
            {myNoGo ? <Text style={ui.body}>Dein No-Go ist gespeichert.</Text> : null}
            {myVote ? <Text style={ui.body}>Deine Auswahl: {rankLabel(myVote.vote_rank as VoteRank)}</Text> : null}
            {[1, 2, 3].map((rank) => {
              const typedRank = rank as VoteRank;
              const rankUsedByOtherSport = usedRankBySport.get(typedRank) && usedRankBySport.get(typedRank) !== proposal.sport_id;

              return (
                <Button
                  key={rank}
                  label={rankLabel(typedRank)}
                  variant={myVote?.vote_rank === typedRank ? "primary" : "secondary"}
                  disabled={Boolean(!canVote || rankUsedByOtherSport || myNoGo)}
                  onPress={() => setRankedVote(proposal.sport_id, typedRank)}
                />
              );
            })}
            {myVote ? <Button label="Stimme entfernen" variant="ghost" onPress={() => removeMyVote(proposal.sport_id)} /> : null}
            <Button
              label={myNoGo ? "No-Go entfernen" : "Als No-Go markieren"}
              variant="ghost"
              disabled={!canVote}
              onPress={() => toggleNoGo(proposal.sport_id)}
            />
          </Card>
        );
      })}
    </Screen>
  );
}

function attendanceLabel(status?: AttendanceStatus): string {
  if (status === "going") return "Dabei";
  if (status === "maybe") return "Vielleicht";
  if (status === "not_going") return "Nicht dabei";
  return "Noch offen";
}

function profileSummary(profiles: Row<"sport_profiles">[], sportId: string): string {
  const sportProfiles = profiles.filter((profile) => profile.sport_id === sportId);
  if (sportProfiles.length === 0) return "Noch kein konkretes Sportprofil hinterlegt.";
  const locations = sportProfiles.map((profile) => profile.location_name).filter(Boolean);
  const locationText = [...new Set(locations)].slice(0, 2).join(", ");
  return `${sportProfiles.length} Profil${sportProfiles.length === 1 ? "" : "e"}${locationText ? ` · ${locationText}` : ""}`;
}
