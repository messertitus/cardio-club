import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SearchField } from "../../../src/components/FormControls";
import {
  EmptyState,
  InlineError,
  LoadingSkeleton,
  MccBadge,
  MccBody,
  MccButton,
  MccCard,
  MccCardTitle,
  MccScreen,
  NoGoNotice,
  SportVoteCard,
  SuccessFlash,
} from "../../../src/components/MccDesign";
import { SportIconBadge } from "../../../src/components/SportIcon";
import { useAuth } from "../../../src/context/AuthContext";
import { supabase } from "../../../src/lib/supabase";
import { excludeNonAttendingEntries, excludeNonAttendingVotes } from "../../../src/lib/votingEligibility";
import type { VoteRank } from "../../../src/lib/votingRules";
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
  const [savedFlash, setSavedFlash] = useState(0);

  const sportsById = useMemo(() => new Map(sports.map((sport) => [sport.id, sport])), [sports]);
  // The preview now arrives from the server already sanitized and presentation-ready.
  const previewPresentation = preview;
  const myVotes = useMemo(
    () => votes.filter((vote) => vote.user_id === user?.id).sort((a, b) => a.vote_rank - b.vote_rank),
    [user?.id, votes],
  );
  const myVoteBySport = useMemo(() => new Map(myVotes.map((vote) => [vote.sport_id, vote])), [myVotes]);
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
    void load();
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

    setSavedFlash((value) => value + 1);
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
    <MccScreen title="Abstimmen" kicker="Voting" subtitle="Bis zu drei Sportarten, klare Ranks und vorsichtige No-Go-Hinweise.">
      <SuccessFlash trigger={savedFlash} label="Stimme gespeichert" />
      <InlineError>{error}</InlineError>
      {loading ? <LoadingSkeleton lines={4} /> : null}

      <MccCard accent>
        <MccBadge icon="account-check-outline">Teilnahme</MccBadge>
        <MccCardTitle>Teilnahme zuerst</MccCardTitle>
        <MccBody muted>Nur Dabei und Vielleicht fliessen in die Entscheidung ein. Nicht dabei wird ignoriert.</MccBody>
        <MccBadge tone="neutral">Dein Status: {attendanceLabel(myAttendance?.status)}</MccBadge>
        <MccButton label="Ich bin dabei" variant={myAttendance?.status === "going" ? "primary" : "secondary"} onPress={() => chooseAttendance("going")} />
        <MccButton label="Vielleicht" variant={myAttendance?.status === "maybe" ? "primary" : "secondary"} onPress={() => chooseAttendance("maybe")} />
        <MccButton label="Nicht dabei" variant={myAttendance?.status === "not_going" ? "primary" : "ghost"} onPress={() => chooseAttendance("not_going")} />
      </MccCard>

      {previewPresentation ? (
        <MccCard>
          <MccBadge icon="chart-timeline-variant">Live-Vorschau</MccBadge>
          <MccCardTitle>Aktuelle Entscheidung: {previewPresentation.selectedSportName}</MccCardTitle>
          {previewPresentation.secondarySportName ? <MccBody>+ {previewPresentation.secondarySportName}</MccBody> : null}
          <MccBody muted>{previewPresentation.simpleExplanation}</MccBody>
          <MccButton label="Entscheidung anzeigen" icon="arrow-right" variant="secondary" onPress={() => router.push(`/events/${eventId}/decision`)} />
        </MccCard>
      ) : null}

      <MccCard>
        <MccCardTitle>Deine Stimmen</MccCardTitle>
        <MccBody muted>Maximal drei Stimmen pro Woche. Dieselbe Sportart kann nicht doppelt gewählt werden.</MccBody>
        <MccBody muted>Ein No-Go betrifft vor allem deine Zuordnung. Deine Präferenz kann trotzdem sichtbar bleiben.</MccBody>
        {!canVote ? <NoGoNotice>Abstimmen ist gesperrt, bis du Dabei oder Vielleicht gewählt hast.</NoGoNotice> : null}
        {myVotes.length === 0 ? <MccBody muted>Du hast noch nicht abgestimmt.</MccBody> : null}
        {myVotes.map((vote) => (
          <MccBody key={vote.id}>
            {rankLabel(vote.vote_rank as VoteRank)}: {sportsById.get(vote.sport_id)?.name ?? vote.sport_id}
          </MccBody>
        ))}
      </MccCard>

      {!loading && proposals.length === 0 ? <EmptyState title="Noch keine Vorschläge" body="Schlage zuerst eine Sportart vor." icon="lightbulb-on-outline" /> : null}
      {proposals.length > 0 ? <SearchField value={proposalSearch} onChangeText={setProposalSearch} placeholder="Sportart oder Standort suchen" /> : null}
      {!loading && proposals.length > 0 && filteredProposals.length === 0 ? <MccBody muted>Keine Vorschläge für diese Suche.</MccBody> : null}
      {filteredProposals.map((proposal, index) => {
        const sport = sportsById.get(proposal.sport_id);
        const myVote = myVoteBySport.get(proposal.sport_id);
        const myNoGo = noGos.some((entry) => entry.user_id === user?.id && entry.sport_id === proposal.sport_id);

        return (
          <SportVoteCard
            key={proposal.id}
            title={sport?.name ?? proposal.sport_id}
            meta={sport ? `${sport.category} - ${sport.intensity_level}` : "Vorgeschlagene Sportart"}
            icon={<SportIconBadge sport={sport} size={42} />}
            selected={Boolean(myVote)}
            blocked={myNoGo}
            index={index}
            right={<MccBadge tone={myVote ? "success" : "neutral"}>{countVotes(proposal.sport_id)} Stimmen</MccBadge>}
          >
            <MccBody muted>{profileSummary(sportProfiles, proposal.sport_id)}</MccBody>
            {myNoGo ? <NoGoNotice>Dein No-Go ist gespeichert. Deine Stimme bleibt als Wunsch sichtbar, falls du hier gewählt hast.</NoGoNotice> : null}
            {myVote ? <MccBadge tone="success">Deine Auswahl: {rankLabel(myVote.vote_rank as VoteRank)}</MccBadge> : null}
            <View style={styles.rankGrid}>
              {[1, 2, 3].map((rank) => {
                const typedRank = rank as VoteRank;

                return (
                  <MccButton
                    key={rank}
                    label={rankLabel(typedRank)}
                    variant={myVote?.vote_rank === typedRank ? "primary" : "secondary"}
                    disabled={Boolean(!canVote)}
                    onPress={() => setRankedVote(proposal.sport_id, typedRank)}
                    style={styles.rankButton}
                  />
                );
              })}
            </View>
            {myVote ? <MccButton label="Stimme entfernen" variant="ghost" icon="close" onPress={() => removeMyVote(proposal.sport_id)} /> : null}
            <MccButton
              label={myNoGo ? "No-Go entfernen" : "Als No-Go markieren"}
              variant={myNoGo ? "danger" : "ghost"}
              icon="shield-alert-outline"
              disabled={!canVote}
              onPress={() => toggleNoGo(proposal.sport_id)}
            />
          </SportVoteCard>
        );
      })}
    </MccScreen>
  );
}

const styles = StyleSheet.create({
  sportTitleRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  sportTitleText: { flex: 1, minWidth: 0 },
  rankGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rankButton: { flexGrow: 1, minWidth: 104 },
});

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
