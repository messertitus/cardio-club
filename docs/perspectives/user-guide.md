# Nutzersicht (Bedienung)

> Stand: 2026-06-14 · Pflege siehe [MAINTENANCE.md](../MAINTENANCE.md)

## Kurzfassung

1. **Einladungscode** eingeben → **Name, Telefonnummer, App-PIN** festlegen → **SMS-Code** bestätigen.
2. Auf der Startseite siehst du den nächsten **Cardiotag deiner Stadt**.
3. **Teilnahme** angeben und **Sportarten** abstimmen (Reihenfolge = Priorität, plus „No-Gos").
4. Kurz vor dem Event erscheint die **Entscheidung** — was, wo, wann.
5. Optional **Standorte/Sportarten vorschlagen** und **Push-Benachrichtigungen** aktivieren.

## Mitglied

### Anmelden / Registrieren
- Beitritt nur mit gültigem **Einladungscode**.
- Login per **Telefonnummer + App-PIN**. PIN vergessen → „PIN zurücksetzen" (SMS-Code).
- Kommt keine SMS an: kurz warten (Zustellung kann ~1 Min dauern), dann „SMS erneut senden" (Countdown). Bei „Code abgelaufen/ungültig" einen neuen Code anfordern und zügig eingeben.

### Cardiotag, Teilnahme & Voting
- Die Startseite zeigt den/die Cardiotag(e) **deiner Stadt** zuerst; Events anderer aktiver Städte kannst du darunter beitreten.
- **Teilnahme** setzen (kommt / kommt nicht). Nur Teilnehmende werden bei der Sportwahl gewertet.
- **Sportwahl:** Sportarten in deiner Wunschreihenfolge wählen; **No-Gos** markieren, was gar nicht geht.
- Voting ist nur in einem **Zeitfenster** offen (einige Tage bis kurz vor der Entscheidung).

### Entscheidung & Ergebnis
- 2 Tage vor dem Event (zur Event-Uhrzeit) fällt die **automatische, faire Entscheidung**.
- Du siehst, **welche Sportart(en) an welchem Standort** stattfinden, plus Details (Treffpunkt, Wetterhinweise).

### Aktivitäten & Standorte vorschlagen
- **„Neue Aktivität vorschlagen"** (Schritt-für-Schritt): Standort → Sportart(en) → Profilart → Gruppengröße → Wetter → Ausstattung → Übersicht.
  - Bei der Ortssuche wird **deine Stadt zuerst** vorgeschlagen (keine Treffer aus anderen Ländern).
  - **„Zuletzt verwendete Standorte"** als Schnellauswahl (deine Stadt zuerst).
  - Über **„+ Hinzufügen"** kannst du eine neue Sportart anfragen.
- **„Sportart an bestehenden Standorten"**: eine Sportart wählen und gleich mehreren bekannten Standorten vorschlagen (Details kommen vom Standort). Bereits zugeordnete Standorte sind gesperrt.
- Vorschläge gehen in die **Warteschlange** und werden von einem Admin geprüft.

### Chat & Benachrichtigungen
- **Chat** je Event/Stadt.
- **Push-Benachrichtigungen** aktivieren (Voting-Erinnerung, Entscheidung) — funktionieren auch bei geschlossener App. App als **PWA installieren** für beste Erfahrung.

### Profil
- **Stadt** im Profil setzen — sie steuert, welche Events/Standorte dir zuerst angezeigt werden.

## Admin (zusätzlich)

Im **Admin-Bereich** (Menü):
- **Sportarten** anlegen/bearbeiten/aktiv schalten.
- **Sportprofile (Standorte)** verwalten; **eine Sportart mehreren Standorten zuordnen** (Schnellzuordnung).
- **Ideen-Warteschlange** prüfen: freigeben/ablehnen; bei neuer angefragter Sportart wird sie angelegt/wiederverwendet.
- **Mitglieder & Rollen**, **Einladungsbaum**, **Namensanfragen**.
- **Aktive Städte** festlegen (steuert, für welche Städte Events erzeugt werden).
- **Eventtage** (Samstag/Sonntag) und **Benachrichtigungsregeln** konfigurieren.

> Hinweis: Ein neues Mitglied kann im Notfall manuell angelegt werden (siehe [operations.md](operations.md) → `scripts/create-basic-user.mjs`).
