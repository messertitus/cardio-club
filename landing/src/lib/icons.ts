// Sport → icon resolver, ported 1:1 from the app's src/components/SportIcon.tsx
// so the landing picks the exact same MaterialCommunityIcons. Resolution order:
//   1. the sport's stored `icon_name` (from the DB / RPC), if known
//   2. keyword match on the sport name
//   3. fallback: run
import {
  mdiVolleyball, mdiBoxingGlove, mdiBasketball, mdiSoccer, mdiSoccerField,
  mdiTennis, mdiTennisBall, mdiBadminton, mdiTableTennis, mdiHandball,
  mdiRugby, mdiFootball, mdiFootballHelmet, mdiBaseball, mdiBaseballBat,
  mdiHockeySticks, mdiHockeyPuck, mdiGolf, mdiBowling, mdiCricket, mdiDisc,
  mdiBike, mdiBikeFast, mdiRun, mdiRunFast, mdiWalk, mdiHiking, mdiWall,
  mdiSkateboard, mdiSkateboarding, mdiRollerSkate, mdiSwim, mdiPool, mdiWaves,
  mdiSurfing, mdiSailBoat, mdiRowing, mdiKayaking, mdiDivingScuba, mdiSki,
  mdiSkiCrossCountry, mdiSkiWater, mdiSnowboard, mdiSledding, mdiYoga,
  mdiMeditation, mdiDumbbell, mdiWeightLifter, mdiGymnastics, mdiKarate,
  mdiMixedMartialArts, mdiKabaddi, mdiFencing, mdiTarget, mdiHorse,
  mdiDanceBallroom, mdiWhistle,
} from '@mdi/js';

interface IconOption { icon: string; path: string; keywords: string[] }

const OPTIONS: IconOption[] = [
  { icon: 'volleyball', path: mdiVolleyball, keywords: ['volleyball', 'beachvolleyball'] },
  { icon: 'boxing-glove', path: mdiBoxingGlove, keywords: ['box', 'kickbox'] },
  { icon: 'basketball', path: mdiBasketball, keywords: ['basketball'] },
  { icon: 'soccer', path: mdiSoccer, keywords: ['fussball', 'fußball', 'fuss', 'soccer', 'street-soccer', 'street soccer'] },
  { icon: 'soccer-field', path: mdiSoccerField, keywords: ['kleinfeld', 'rasen', 'feldsport', 'bolzplatz'] },
  { icon: 'tennis', path: mdiTennis, keywords: ['tennis'] },
  { icon: 'tennis-ball', path: mdiTennisBall, keywords: ['pickleball', 'padel', 'squash', 'racquetball', 'racket'] },
  { icon: 'badminton', path: mdiBadminton, keywords: ['badminton'] },
  { icon: 'table-tennis', path: mdiTableTennis, keywords: ['tischtennis', 'ping', 'table tennis'] },
  { icon: 'handball', path: mdiHandball, keywords: ['handball'] },
  { icon: 'rugby', path: mdiRugby, keywords: ['rugby'] },
  { icon: 'football', path: mdiFootball, keywords: ['football', 'flag football'] },
  { icon: 'football-helmet', path: mdiFootballHelmet, keywords: ['american football'] },
  { icon: 'baseball', path: mdiBaseball, keywords: ['baseball', 'softball'] },
  { icon: 'baseball-bat', path: mdiBaseballBat, keywords: ['cricket', 'baseballschlaeger', 'baseballschläger', 'softballschlaeger', 'softballschläger'] },
  { icon: 'hockey-sticks', path: mdiHockeySticks, keywords: ['hockey', 'floorball', 'unihockey'] },
  { icon: 'hockey-puck', path: mdiHockeyPuck, keywords: ['eishockey', 'ice hockey'] },
  { icon: 'golf', path: mdiGolf, keywords: ['golf', 'minigolf'] },
  { icon: 'bowling', path: mdiBowling, keywords: ['bowling', 'kegeln'] },
  { icon: 'cricket', path: mdiCricket, keywords: ['cricket'] },
  { icon: 'disc', path: mdiDisc, keywords: ['frisbee', 'ultimate', 'disc'] },
  { icon: 'bike', path: mdiBike, keywords: ['radfahren', 'fahrrad', 'cycling'] },
  { icon: 'bike-fast', path: mdiBikeFast, keywords: ['rennrad', 'mountainbike', 'mtb', 'gravel'] },
  { icon: 'run', path: mdiRun, keywords: ['lauf', 'jog', 'joggen', 'run'] },
  { icon: 'run-fast', path: mdiRunFast, keywords: ['sprint', 'leichtathletik'] },
  { icon: 'walk', path: mdiWalk, keywords: ['gehen', 'walking', 'spazier'] },
  { icon: 'hiking', path: mdiHiking, keywords: ['wandern', 'wander', 'hike', 'trekking', 'hiking'] },
  { icon: 'wall', path: mdiWall, keywords: ['klettern', 'bouldern', 'climbing'] },
  { icon: 'skateboard', path: mdiSkateboard, keywords: ['skateboard'] },
  { icon: 'skateboarding', path: mdiSkateboarding, keywords: ['skaten', 'skateboarding'] },
  { icon: 'roller-skate', path: mdiRollerSkate, keywords: ['inliner', 'rollschuh', 'roller'] },
  { icon: 'swim', path: mdiSwim, keywords: ['schwimm', 'swim'] },
  { icon: 'pool', path: mdiPool, keywords: ['pool', 'freibad', 'hallenbad'] },
  { icon: 'waves', path: mdiWaves, keywords: ['see', 'meer', 'wasser'] },
  { icon: 'surfing', path: mdiSurfing, keywords: ['surf', 'wellenreiten'] },
  { icon: 'sail-boat', path: mdiSailBoat, keywords: ['segeln', 'sailing'] },
  { icon: 'rowing', path: mdiRowing, keywords: ['rudern', 'rowing'] },
  { icon: 'kayaking', path: mdiKayaking, keywords: ['kajak', 'kanu', 'paddeln'] },
  { icon: 'diving-scuba', path: mdiDivingScuba, keywords: ['tauchen', 'diving'] },
  { icon: 'ski', path: mdiSki, keywords: ['ski', 'alpin'] },
  { icon: 'ski-cross-country', path: mdiSkiCrossCountry, keywords: ['langlauf', 'cross country'] },
  { icon: 'ski-water', path: mdiSkiWater, keywords: ['wasserski'] },
  { icon: 'snowboard', path: mdiSnowboard, keywords: ['snowboard'] },
  { icon: 'sledding', path: mdiSledding, keywords: ['rodel', 'schlitten'] },
  { icon: 'yoga', path: mdiYoga, keywords: ['yoga', 'pilates', 'stretch'] },
  { icon: 'meditation', path: mdiMeditation, keywords: ['meditation', 'achtsamkeit'] },
  { icon: 'dumbbell', path: mdiDumbbell, keywords: ['kraft', 'fitness', 'gym', 'hantel'] },
  { icon: 'weight-lifter', path: mdiWeightLifter, keywords: ['gewichtheben', 'weightlifting', 'crossfit'] },
  { icon: 'gymnastics', path: mdiGymnastics, keywords: ['turnen', 'gymnastik', 'gymnastics', 'calisthenics', 'calis'] },
  { icon: 'karate', path: mdiKarate, keywords: ['karate'] },
  { icon: 'mixed-martial-arts', path: mdiMixedMartialArts, keywords: ['mma', 'mixed martial arts'] },
  { icon: 'kabaddi', path: mdiKabaddi, keywords: ['ringen', 'wrestling', 'judo'] },
  { icon: 'fencing', path: mdiFencing, keywords: ['fechten', 'fencing'] },
  { icon: 'target', path: mdiTarget, keywords: ['bogenschiessen', 'dart', 'darts', 'ziel'] },
  { icon: 'horse', path: mdiHorse, keywords: ['reiten', 'pferd'] },
  { icon: 'dance-ballroom', path: mdiDanceBallroom, keywords: ['tanz', 'dance'] },
  { icon: 'whistle', path: mdiWhistle, keywords: ['training', 'kurs', 'coach'] },
];

const BY_ICON = new Map(OPTIONS.map((o) => [o.icon, o.path]));

/** Resolve a sport to an MDI path. Prefers the stored icon_name, then keywords. */
export function sportIconPath(nameOrIcon: string, iconName?: string | null): string {
  if (iconName && BY_ICON.has(iconName)) return BY_ICON.get(iconName)!;
  // Allow passing a known icon key directly (used by the static fallback list).
  if (BY_ICON.has(nameOrIcon)) return BY_ICON.get(nameOrIcon)!;

  const text = nameOrIcon.toLowerCase();
  for (const o of OPTIONS) {
    if (o.keywords.some((k) => text.includes(k))) return o.path;
  }
  if (text.includes('wasser')) return mdiSwim;
  if (text.includes('winter')) return mdiSki;
  if (text.includes('ball')) return mdiBasketball;
  if (text.includes('ausdauer')) return mdiRun;
  return mdiRun;
}
