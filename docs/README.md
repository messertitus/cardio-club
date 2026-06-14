# Messers Cardio Club — Dokumentation

Zentrale Übersicht über **den aktuellen Stand der App** aus verschiedenen Sichten.
Jede Sicht-Doku beginnt mit einer **Kurzfassung** (kompakt) und führt darunter
**ausführlich** weiter — wähle je nach Szenario.

> **Pflege:** Diese Dokus werden **fortlaufend** aktualisiert. Jede inhaltliche
> Änderung an der App wird hier nachgezogen und in [CHANGELOG.md](CHANGELOG.md)
> protokolliert — **auch Entferntes**. Das Vorgehen steht in
> [MAINTENANCE.md](MAINTENANCE.md). Stand-Datum jeweils oben in jeder Datei.

## Nach Sicht (Perspektive)

| Sicht | Für wen / Szenario | Doku |
|---|---|---|
| **Stakeholder / Produkt** | Was ist die App, welchen Wert stiftet sie, Status | [perspectives/stakeholder.md](perspectives/stakeholder.md) |
| **Nutzer** | Wie benutze ich die App (Mitglied & Admin) | [perspectives/user-guide.md](perspectives/user-guide.md) |
| **Architektur** | Systemaufbau, Datenfluss, Grenzen, Entscheidungen | [perspectives/architecture.md](perspectives/architecture.md) |
| **Entwickler** | Setup, Codebasis, Konventionen, Build/Test/Deploy | [perspectives/developer.md](perspectives/developer.md) |
| **Betrieb / Ops** | Runtime, Deploy, Runbooks, Wartung, Incidents | [perspectives/operations.md](perspectives/operations.md) |
| **Security & Datenschutz** | Auth, RLS, Secrets, Privacy | [perspectives/security-and-privacy.md](perspectives/security-and-privacy.md) |

## Nach Thema (bestehende Tiefen-Dokus)

| Thema | Doku |
|---|---|
| Wochen-Entscheidung & Fairness-Algorithmus (Übergabe) | [fairness-first-algorithmus-handoff.md](fairness-first-algorithmus-handoff.md) |
| Algorithmus-Weiterentwicklung (Prompt) | [fairness-first-algorithmus-copy-prompt.md](fairness-first-algorithmus-copy-prompt.md) |
| Benachrichtigungen & Wochenentscheidung | [notifications-and-weekly-decision.md](notifications-and-weekly-decision.md) |
| Push-Einrichtung (Web Push) | [push-setup.md](push-setup.md) |
| PWA-Updatefähigkeit | [pwa-updates.md](pwa-updates.md) |
| Analytics & Datenschutz | [analytics-and-privacy.md](analytics-and-privacy.md) |
| Datenbank-Schema | [schema.md](schema.md) |
| Klassendiagramm (Gesamtüberblick) | [class-diagram.md](class-diagram.md) |
| Ubuntu-Deployment | [deployment-ubuntu.md](deployment-ubuntu.md) |

## Logs

- [CHANGELOG.md](CHANGELOG.md) — chronologisches Protokoll aller dokumentierten Änderungen, **inkl. Entferntem**.
- [MAINTENANCE.md](MAINTENANCE.md) — wie diese Dokus gepflegt werden (Protokoll).

## In einem Satz

**Messers Cardio Club (MCC)** ist eine private Wochen-Sportclub-App (Expo/React-Native-Web-PWA + Supabase): Mitglieder stimmen unter der Woche über Teilnahme und Sportarten ab, ein fairness-orientierter Algorithmus entscheidet pro Cardiotag, was wo stattfindet — stadtgebunden, einladungsbasiert, push-benachrichtigt.
