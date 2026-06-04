import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { Row } from "../services";

type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type SportIconInput = Pick<Row<"sports">, "name" | "category" | "intensity_level"> & { icon_name?: string | null };

export const SPORT_ICON_OPTIONS: Array<{ name: MaterialCommunityIconName; label: string; keywords: string[] }> = [
  { name: "volleyball", label: "Volleyball", keywords: ["volleyball", "beachvolleyball"] },
  { name: "boxing-glove", label: "Boxen", keywords: ["box", "kickbox"] },
  { name: "basketball", label: "Basketball", keywords: ["basketball"] },
  { name: "soccer", label: "Fußball", keywords: ["fussball", "fußball", "fuss", "soccer"] },
  { name: "soccer-field", label: "Spielfeld", keywords: ["kleinfeld", "rasen", "feldsport"] },
  { name: "tennis", label: "Tennis", keywords: ["tennis"] },
  { name: "tennis-ball", label: "Rückschlag", keywords: ["pickleball", "padel", "squash", "racquetball", "racket"] },
  { name: "badminton", label: "Badminton", keywords: ["badminton"] },
  { name: "table-tennis", label: "Tischtennis", keywords: ["tischtennis", "ping", "table tennis"] },
  { name: "handball", label: "Handball", keywords: ["handball"] },
  { name: "rugby", label: "Rugby", keywords: ["rugby"] },
  { name: "football", label: "Football", keywords: ["football", "flag football"] },
  { name: "football-helmet", label: "Helm-Football", keywords: ["american football"] },
  { name: "baseball", label: "Baseball", keywords: ["baseball", "softball"] },
  { name: "baseball-bat", label: "Schlägerball", keywords: ["cricket", "baseballschlaeger", "baseballschläger", "softballschlaeger", "softballschläger"] },
  { name: "hockey-sticks", label: "Hockey", keywords: ["hockey", "floorball", "unihockey"] },
  { name: "hockey-puck", label: "Eishockey", keywords: ["eishockey", "ice hockey"] },
  { name: "golf", label: "Golf", keywords: ["golf", "minigolf"] },
  { name: "bowling", label: "Bowling", keywords: ["bowling", "kegeln"] },
  { name: "cricket", label: "Cricket", keywords: ["cricket"] },
  { name: "disc", label: "Disc", keywords: ["frisbee", "ultimate"] },
  { name: "bike", label: "Radfahren", keywords: ["radfahren", "fahrrad", "cycling"] },
  { name: "bike-fast", label: "Rennrad", keywords: ["rennrad", "mountainbike", "mtb", "gravel"] },
  { name: "run", label: "Laufen", keywords: ["lauf", "jog", "joggen", "run"] },
  { name: "run-fast", label: "Sprint", keywords: ["sprint", "leichtathletik"] },
  { name: "walk", label: "Gehen", keywords: ["gehen", "walking", "spazier"] },
  { name: "hiking", label: "Wandern", keywords: ["wandern", "wander", "hike", "trekking"] },
  { name: "wall", label: "Klettern", keywords: ["klettern", "bouldern", "climbing"] },
  { name: "skateboard", label: "Skateboard", keywords: ["skateboard"] },
  { name: "skateboarding", label: "Skaten", keywords: ["skaten", "skateboarding"] },
  { name: "roller-skate", label: "Inliner", keywords: ["inliner", "rollschuh", "roller"] },
  { name: "swim", label: "Schwimmen", keywords: ["schwimm", "swim"] },
  { name: "pool", label: "Pool", keywords: ["pool", "freibad", "hallenbad"] },
  { name: "waves", label: "Wasser", keywords: ["see", "meer", "wasser"] },
  { name: "surfing", label: "Surfen", keywords: ["surf", "wellenreiten"] },
  { name: "sail-boat", label: "Segeln", keywords: ["segeln", "sailing"] },
  { name: "rowing", label: "Rudern", keywords: ["rudern", "rowing"] },
  { name: "kayaking", label: "Kajak", keywords: ["kajak", "kanu", "paddeln"] },
  { name: "diving-scuba", label: "Tauchen", keywords: ["tauchen", "diving"] },
  { name: "ski", label: "Ski", keywords: ["ski", "alpin"] },
  { name: "ski-cross-country", label: "Langlauf", keywords: ["langlauf", "cross country"] },
  { name: "ski-water", label: "Wasserski", keywords: ["wasserski"] },
  { name: "snowboard", label: "Snowboard", keywords: ["snowboard"] },
  { name: "sledding", label: "Rodeln", keywords: ["rodel", "schlitten"] },
  { name: "yoga", label: "Yoga", keywords: ["yoga", "pilates", "stretch"] },
  { name: "meditation", label: "Entspannung", keywords: ["meditation", "achtsamkeit"] },
  { name: "dumbbell", label: "Kraft", keywords: ["kraft", "fitness", "gym", "hantel"] },
  { name: "weight-lifter", label: "Gewichtheben", keywords: ["gewichtheben", "weightlifting", "crossfit"] },
  { name: "gymnastics", label: "Turnen", keywords: ["turnen", "gymnastik", "gymnastics"] },
  { name: "karate", label: "Karate", keywords: ["karate"] },
  { name: "mixed-martial-arts", label: "MMA", keywords: ["mma", "mixed martial arts"] },
  { name: "kabaddi", label: "Ringen", keywords: ["ringen", "wrestling", "judo"] },
  { name: "fencing", label: "Fechten", keywords: ["fechten", "fencing"] },
  { name: "target", label: "Ziel", keywords: ["bogenschiessen", "dart", "darts", "ziel"] },
  { name: "horse", label: "Reiten", keywords: ["reiten", "pferd"] },
  { name: "dance-ballroom", label: "Tanz", keywords: ["tanz", "dance"] },
  { name: "whistle", label: "Training", keywords: ["training", "kurs", "coach"] },
];

export function SportIcon({ sport, size = 18, color }: { sport?: SportIconInput | null; size?: number; color?: string }) {
  const { theme } = useTheme();
  return <MaterialCommunityIcons name={sportIconName(sport)} size={size} color={color ?? theme.accent} />;
}

export function SportIconBadge({ sport, size = 34 }: { sport?: SportIconInput | null; size?: number }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderRadius: 999,
        borderWidth: 1,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <SportIcon sport={sport} size={Math.max(16, Math.round(size * 0.52))} />
    </View>
  );
}

function sportIconName(sport?: SportIconInput | null): MaterialCommunityIconName {
  if (sport?.icon_name && SPORT_ICON_OPTIONS.some((option) => option.name === sport.icon_name)) {
    return sport.icon_name as MaterialCommunityIconName;
  }

  const text = `${sport?.name ?? ""} ${sport?.category ?? ""}`.toLowerCase();
  for (const option of SPORT_ICON_OPTIONS) {
    if (hasAny(text, option.keywords)) return option.name;
  }

  if (hasAny(text, ["wasser"])) return "swim";
  if (hasAny(text, ["winter"])) return "ski";
  if (hasAny(text, ["ball"])) return "basketball";
  if (hasAny(text, ["ausdauer"])) return "run";

  return "run";
}

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}
