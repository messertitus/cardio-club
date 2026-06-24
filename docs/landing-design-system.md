# Landing Design System — Übertrag auf die App

Beschreibung des visuellen Stils und der Elemente der Landingpage (`landing/`),
damit dieselbe Anmutung in der App (`src/`, React Native / react-native-web)
umgesetzt werden kann. **Palette, Schrift-Gewichte und Icons spiegeln bereits
die App** (`theme.mcc.*`, MaterialCommunityIcons) — neu sind vor allem die
**Signatur-Effekte** und die **Premium-Veredelung** der Komponenten.

## 1. Farben (= App-Tokens, unverändert)
- Hintergrund `#05070b`, Flächen `rgba(10,18,31,.94)` / erhöht `rgba(17,28,45,.96)`
- Akzent `#4DA3FF`, Primär/Buttons `#1677FF`, hell `#8FC7FF`
- Mint/Success `#5EEAD4`, Koralle/Danger `#FF8D7A`
- Text `#F7FBFF` / sekundär `#A7B4C7` / muted `#718198`
- Linien `rgba(255,255,255,.12)`, starke Linie `rgba(77,163,255,.42)`
- Akzent-Flächen: faint `rgba(77,163,255,.08)`, soft `rgba(77,163,255,.16)`

## 2. Typografie
- Schrift **Space Grotesk** (App: gleiche geometrische Anmutung).
- Sehr **fett**: Überschriften 800–900, Buttons 800.
- Headlines groß, eng (`letter-spacing: -0.02em`), Zeilenhöhe ~1.05.
- „Eyebrow"-Labels: klein, UPPERCASE, weiter `letter-spacing`, Akzentfarbe, mit
  einem kleinen leuchtenden Punkt (Pip) davor.

## 3. Form & Abstand
- Große Radien: Karten 18–24 px, Buttons 16 px, Pills/Badges 999 px.
- Karten: dezenter Verlauf/Fläche + 1 px Linie; Hover hebt an (`translateY(-3px)`)
  und setzt die starke Linie + blauen Schatten.
- Icon-Badges: 52–60 px, Radius 14–16 px, radialer Akzent-Verlauf,
  `inset`-Glow, Icon in Akzentblau.

## 4. Signatur-Effekte (das „Wow")
1. **Aurora-Orbs Hintergrund** — 2–3 große, stark weichgezeichnete Farbkreise
   (Akzent/Primär/Mint), die langsam driften (20–34 s Loops). Die App hat das im
   Ansatz schon (`MotionBackground` glowBlob) — hier nur größer/ruhiger.
2. **EKG-/Puls-Signaturlinie** — eine dünne Herzschlag-Linie als Sektionstrenner;
   ein heller Puls-Abschnitt „läuft" per `stroke-dashoffset` darüber. Passt zur
   Cardio-Marke. (In RN über `react-native-svg` + `Animated` umsetzbar.)
3. **Scroll-Reveals** — Inhalte faden/sliden beim Einscrollen ein
   (IntersectionObserver, gestaffelt pro Gruppe). RN-Pendant: `Animated` +
   `onLayout`/Scroll-Position; die App nutzt schon `Reveal`/`SmoothReveal`.
4. **Count-up-Zahlen** — Kennzahlen zählen beim Erscheinen von 0 hoch.
5. **Cursor-Spotlight auf Karten** (nur Web/Maus) — ein blauer Radial-Glow folgt
   dem Cursor über Karten. In RN entfällt das (kein Cursor) → stattdessen
   Press/Hover-Glow.
6. **Button-Shimmer** — über Primär-Buttons läuft beim Hover ein heller
   Glanzstreifen.
7. **Headline-Gradient-Shimmer** — der blaue Verlauf im Akzent-Wort der
   Überschrift wandert langsam.
8. **Leuchtende, pulsierende Punkte** — z. B. „Live"-/Standort-Indikatoren:
   weicher Halo + Kern, sanftes Skalieren/Pulsieren (de-synchronisiert).
9. **Scroll-Fortschrittsleiste** — dünner Verlauf oben, füllt sich beim Scrollen.

## 5. Wiederkehrende Komponenten
- **Stat-Kacheln**: große fette Zahl + kleines UPPERCASE-Label.
- **Sport-Kacheln**: vertikal, leuchtendes Icon-Badge oben, Name unten,
  Hover-Lift + Icon-Glow.
- **Pills**: kompakte Buttons mit Zähler-Badge; Hover hebt an, kann verknüpfte
  Elemente hervorheben (z. B. Stadtteil-Pill → Kartenpunkte).
- **Flow-Diagramm**: mehrere Icon-Badges → animierter Pfeil → Ziel-Pin.
- **Glas-Tooltip**: dunkel, `backdrop-blur`, Akzentrand, weicher Schatten.
- **Badges/Eyebrows**: Pill mit Pip, UPPERCASE, Akzentfarbe.

## 6. Bewegungs-Prinzipien
- Subtil, GPU-freundlich (Transform/Opacity), nie hektisch.
- Immer `prefers-reduced-motion` respektieren (in RN: `AccessibilityInfo`).
- De-synchronisierte Loops (Punkte/Orbs), damit nichts „im Takt" wirkt.

## 7. Was die App schon hat vs. was neu wäre
- **Hat schon**: Palette, Icons, fette Typo, driftender Glow-Hintergrund,
  Herzschlag-/Spinner-Motive (`CardioRing`, `SpinnerRing`, `CardEntranceTrace`),
  Reveal-Animationen.
- **Neu übertragen**: EKG-Puls-Linie als Trenner, Count-up-Zahlen, leuchtende
  Icon-Badge-Kacheln, Pills mit Cross-Highlight, Glas-Tooltips, dezenter
  Headline-Shimmer, „Wow"-Politur (großzügige Radien, Hover-Glows).
- **Web-only (in RN weglassen/ersetzen)**: Cursor-Spotlight, Button-Shimmer per
  CSS, Scroll-Fortschrittsleiste → durch Press-States/native Effekte ersetzen.
