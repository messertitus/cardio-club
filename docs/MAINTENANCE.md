# Doku-Pflege (Protokoll)

> Diese Dokus sind **lebende Dokumente**. Sie werden bei jeder inhaltlichen
> Änderung an der App nachgezogen — fortlaufend, nicht „irgendwann".

## Grundregeln

1. **Mit dem Change, nicht danach.** Wer eine App-Änderung macht, aktualisiert im
   selben Zug die betroffene(n) Sicht-Doku(s) **und** trägt einen Eintrag in
   [CHANGELOG.md](CHANGELOG.md) ein.
2. **Nichts verschwindet still.** Entfernte Features/Dateien/Felder kommen unter
   `Entfernt` in den Changelog — mit **Grund** und ggf. Ersatz.
3. **Stand-Datum pflegen.** Jede geänderte Sicht-Doku bekommt oben das aktuelle
   `Stand: YYYY-MM-DD`.
4. **Single source of truth.** Tiefen-Themen (Schema, Algorithmus, Push, …) leben
   in ihren bestehenden Dokus; die Sicht-Dokus **verlinken** darauf statt zu
   duplizieren.
5. **Wahrheitstreue.** Lieber „heute so, bewusst offen" als geschöntes Soll. Wenn
   Code und Doku abweichen, gewinnt der Code — Doku korrigieren.

## Welche Änderung → welche Doku

| Änderungstyp | Zu aktualisieren |
|---|---|
| Neues/entferntes Feature, Flow-Änderung | `user-guide.md`, `stakeholder.md`, CHANGELOG |
| Neue Route/Service/Komponente, Konvention | `developer.md`, ggf. `architecture.md`, CHANGELOG |
| DB-Migration, RLS, SQL-Funktion, Edge Function | `architecture.md`, `developer.md`, ggf. `security-and-privacy.md`, CHANGELOG |
| Auth/Secrets/RLS/Privacy | `security-and-privacy.md`, ggf. `operations.md`, CHANGELOG |
| Deploy/Runtime/Runbook/Incident | `operations.md`, CHANGELOG |
| Externe Abhängigkeit (Supabase/Twilio/Push) | `operations.md`, `architecture.md`, CHANGELOG |

## Changelog-Eintrag (Vorlage)

```markdown
## YYYY-MM-DD — Kurztitel

### Hinzugefügt
- …

### Geändert
- …

### Behoben
- …

### Entfernt
- <Was> entfernt/ersetzt. Grund: … Ersatz: …
```

Nur zutreffende Abschnitte verwenden. Neueste Einträge **oben**.

## Reihenfolge bei der Pflege

1. Code/DB ändern.
2. Betroffene Sicht-Doku(s) anpassen, Stand-Datum setzen.
3. Changelog-Eintrag ergänzen (inkl. `Entfernt`, falls zutreffend).
4. `docs/README.md` nur anfassen, wenn eine **neue Doku** dazukommt oder eine wegfällt.

## Konsistenz-Check (gelegentlich)

- Stimmen Routenliste (`app/`), Service-Anzahl, höchste Migration und Edge-Functions in `architecture.md`/`developer.md` noch mit dem Repo?
- Sind veraltete Aussagen markiert/korrigiert (z. B. README nennt noch E-Mail-Auth — maßgeblich ist Phone+PIN)?
- Verweisen Tiefen-Links noch auf existierende Dateien?
