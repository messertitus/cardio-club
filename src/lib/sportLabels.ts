// Display labels for sport categories / intensities. The database stores ASCII
// slugs (e.g. "rueckschlagspiel"); these map them to proper German labels with
// umlauts for the UI without touching the stored data.

const CATEGORY_LABELS: Record<string, string> = {
  ballsport: "Ballsport",
  ball: "Ballsport",
  ausdauer: "Ausdauersport",
  kraft: "Kraftsport",
  kraftsport: "Kraftsport",
  wasser: "Wasser",
  wassersport: "Wassersport",
  winter: "Winter",
  wintersport: "Wintersport",
  kampf: "Kampfsport",
  kampfsport: "Kampfsport",
  rueckschlagspiel: "Rückschlagspiel",
  teamsport: "Teamsport",
  individualsport: "Individualsport",
  tanz: "Tanz",
  fitness: "Fitness",
  mobility: "Mobility",
  unknown: "Unbekannt",
  unbekannt: "Unbekannt",
  cardio: "Ausdauersport",
};

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return "Unbekannt";
  return CATEGORY_LABELS[value.toLowerCase()] ?? capitalize(value);
}

export function intensityLabel(value: string | null | undefined): string {
  if (value === "low") return "leicht";
  if (value === "high") return "hoch";
  if (value === "medium") return "mittel";
  return value ? capitalize(value) : "mittel";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
