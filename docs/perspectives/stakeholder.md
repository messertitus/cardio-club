# Stakeholder- / Produktsicht

> Stand: 2026-06-14 · Pflege siehe [MAINTENANCE.md](../MAINTENANCE.md)

## Kurzfassung

**Messers Cardio Club (MCC)** ist eine private, einladungsbasierte App für einen
wöchentlichen Sport-/Cardio-Club. Mitglieder geben unter der Woche an, ob sie zum
**Cardiotag** kommen, und stimmen über Sportarten ab. Ein **fairness-orientierter
Algorithmus** entscheidet automatisch und nachvollziehbar, welche Sportart(en) an
welchem Standort stattfinden. Alles ist **stadtgebunden** (aktuell Testphase mit
Konstanz) und läuft als **installierbare PWA** (plus native Möglichkeit über Expo).

- **Zielnutzer:** geschlossene Community, Beitritt nur per Einladungscode.
- **Kernnutzen:** kein Chaos bei der Orga — faire, automatische Wochenentscheidung statt Endlos-Abstimmung im Chat.
- **Status:** Live-Testphase, eine aktive Stadt (Konstanz), aktiver Funktionsausbau.

## Wertversprechen

| Problem | Lösung in MCC |
|---|---|
| „Wer kommt überhaupt?" | Teilnahme-Abstimmung pro Cardiotag, Stichtag vor dem Event |
| „Welche Sportart machen wir?" | Ranked Voting + No-Gos, fairer Algorithmus entscheidet |
| „Immer die Lautesten setzen sich durch" | Fairness-First: Minderheiten-/Vernachlässigungsschutz |
| „Wo treffen wir uns?" | Standort-Profile (Wetter, Kapazität, Ausstattung) je Sportart |
| „Verpasse ich die Abstimmung?" | Web-Push-Erinnerungen, auch bei geschlossener App |
| „Wildwuchs an Mitgliedern" | Einladungscodes, Admin-Freigaben |

## Funktionsumfang (heute)

- **Onboarding:** Einladungscode → Telefonnummer + App-PIN → SMS-Bestätigung.
- **Cardiotage:** Samstag und/oder Sonntag (technisch jeder Wochentag möglich), stadtgebunden, mit eigener Abstimmung je Event.
- **Teilnahme & Voting:** Teilnahme-Status, gerankte Sportwahl, No-Gos.
- **Entscheidung:** automatischer, fairness-orientierter Beschluss kurz vor dem Event; Ergebnisse einsehbar.
- **Standorte & Sportarten:** Mitglieder schlagen Aktivitäten/Standorte vor; Admins prüfen und verwalten; eine Sportart kann mehreren Standorten zugeordnet werden.
- **Chat:** pro Event/Stadt.
- **Benachrichtigungen:** Web-Push (Voting-Erinnerung, Entscheidung).
- **Statistik-Grundlage:** privacy-first erfasst (noch keine Gamification sichtbar).
- **Admin:** Sportarten/Profile, Mitglieder/Rollen, aktive Städte, Eventtage, Benachrichtigungsregeln, Einladungsbaum.

## Was bewusst (noch) NICHT enthalten ist

- Keine öffentliche Registrierung (nur per Einladung).
- Keine Gamification/Badges (nur Daten werden erfasst).
- Keine Bezahl-/Buchungsfunktion.
- Mehrere Clubs sind im Datenmodell angelegt, aber das Produkt zeigt aktuell **einen** Club (MCC).

## Roadmap-Hinweise (aus dem Code ableitbar, nicht terminiert)

- Mehrere aktive Städte gleichzeitig (Logik ist vorbereitet; Mitglied sieht die eigene Stadt zuerst).
- Gamification/Insights auf Basis der Analytics-Grundlage.
- Native App-Stores über Expo (Web/PWA ist der aktuelle Hauptkanal).

## Risiken / Abhängigkeiten

- **Supabase** (Auth, DB, Edge Functions) und **Twilio** (SMS) sind harte Abhängigkeiten.
- SMS-Onboarding ist anfällig für Provider-/Rate-Limit-Themen (siehe [operations.md](operations.md)).
- Der Entscheidungs-Algorithmus läuft **serverseitig** und darf nie ins Client-Bundle gelangen (Schutz ist automatisiert).
