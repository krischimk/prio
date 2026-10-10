---
target: erste zusammenhängende Prio-Oberfläche
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/krischi/Documents/GitHub/prio/src/ui/WorkspaceScreen.tsx"
target_fingerprint: "sha256:2fe09c59774ad6326c8b61b048ddef9ebd03cfa30fe493bf670de320bf6dbb25"
target_path: /home/krischi/Documents/GitHub/prio/src/ui/WorkspaceScreen.tsx
timestamp: 2026-10-09T23-18-42Z
slug: src-ui-workspacescreen-tsx
---
Method: dual-agent (A: /root/critique_design · B: /root/critique_evidence)

# Impeccable-Kritik: erste zusammenhängende Prio-Oberfläche

Ziel: `src/ui/WorkspaceScreen.tsx` und verbundene Gesamt-/Listenansicht, Aufgabeneditor und Listeneinstellungen. Modus: Operate. Bewertet wird der uncommittete Arbeitsstand vom 10. Oktober 2026. A beendete seine unabhängige Designbewertung, bevor B-Ergebnisse in die Synthese eingingen. Die ausdrücklich gewünschte schwarze Basis und Schreibweise Prio sind berücksichtigt.

## Design und Gesamtwirkung

Die Abläufe sind auf Prio zugeschnitten: Herkunftslisten, persönliche Gesamtansicht, erhaltene Entwürfe und getrennte Aufbewahrungsregeln. Die visuelle Sprache ist ein vertrautes dunkles Werkzeug mit Systemschrift, gerundeten Controls und Violett. Schwarz, kühle Flächen und Violett passen zusammen. Die Gewichtung ist noch zu formularlastig; mehr Eigenständigkeit sollte aus präziser Hierarchie und besseren Abläufen entstehen.

## Heuristische Bewertung

Die Punkte bewerten den zuerst inspizierten Stand vor den im Anschluss vorgenommenen Korrekturen. Sie sind eine Designbewertung, keine mathematische Produktfreigabe. Kein neuer Score nach den Korrekturen wurde erfunden.

| # | Heuristik | Punkte | Wesentlicher Befund |
| --- | --- | ---: | --- |
| 1 | Systemzustand sichtbar | 3/4 | Lokale Wirkung sofort; ausführlicher mobiler Syncstatus im Menü. |
| 2 | Verständliche Sprache | 3/4 | Überwiegend klares Deutsch; unnötiges „Ohne Bereich“. |
| 3 | Kontrolle und Freiheit | 3/4 | Rückgängig und Entwürfe gut; abgeschlossene Aufgaben eingeschränkt. |
| 4 | Konsistenz | 3/4 | Gemeinsamer Editor; Erfassung und Aufgabenzugang unterschiedlich. |
| 5 | Fehlervermeidung | 3/4 | Explizite Zielliste, Pflichtfeld und erhaltene Entwürfe. |
| 6 | Wiedererkennen | 3/4 | Herkunft sichtbar; fehlender Detailzugang bei Erledigtem. |
| 7 | Effizienz | 2/4 | Alternative zum Ziehen; mobile Erfassung scrollt weg. |
| 8 | Ästhetik und Minimalismus | 2/4 | Ruhige Zeilen, zu dominante Formular-/Verwaltungsflächen. |
| 9 | Fehlerbehebung | 3/4 | Erklärte Fehler- und Konfliktwege; Offline-Speichern praktisch geprüft. |
| 10 | Hilfe | 2/4 | Gute einzelne Hinweise, kein zusammenhängender Hilfszugang. |
| **Gesamt** | | **27/40** | **Tragfähige Grundlage mit konkreten Bedienlücken.** |

## Stärken

- Lange Titel und vorhandene Metadaten bleiben lesbar; Beschreibungen lassen sich erweitern.
- Herkunft und Entwürfe bleiben sichtbar bzw. erhalten, auch beim Breitenwechsel.
- Lokales Speichern wirkt sofort; spätere Cloudübertragung wird getrennt gemeldet, ohne weiteren Bestätigungsdialog.

## Priorisierte Befunde

1. **P1 — Aufgaben im kurzen breiten Fenster unerreichbar.** Bei 844 × 390 hatte die innere Aufgabenfläche 0 Pixel Höhe bei 321 Pixel Inhalt. Kopf und Composer belegten die verfügbare Höhe. Gemessen in `/tmp/prio-critique-a/landscape.json`, dargestellt in `landscape-list-stable.png`. Ort: `src/ui/TaskPanel.tsx`, `WorkspaceScreen.tsx`. **Korrektur im laufenden Umfang:** Der zusammenhängende Arbeitsbereich scrollt. Der gezielte Test erreicht und öffnet die Aufgabe bei 844 × 390 und 1280 × 390. **Passender Befehl:** `impeccable adapt`.

2. **P1 — Abgehakte Aufgaben verlieren ihren Editorzugang.** Der Titel öffnete keinen Editor; Beschreibung und fachlich vorgesehenes erledigtes Verschieben waren unerreichbar. Probe: `/tmp/prio-critique-a/probe.json`, Bild `phone-completed.png`. Ort: `src/ui/CompletedTasksSection.tsx`. **Korrektur:** Der Titel öffnet die Aufgaben-ID im gemeinsamen Editor. Beschreibung, Bearbeitung und erledigtes Verschieben sind erreichbar; „Wieder öffnen“ bleibt als schnelle Aktion. Neue Kernabläufe bestehen auf beiden Oberflächen. **Passender Befehl:** `impeccable harden`.

3. **P2 — Einfache Erfassung zeigt zu viele Zusatzfelder.** Für eine Aufgabe genügt der Titel. Sofort sichtbare Beschreibung, Datum, deaktivierte Wiederholung, Erinnerungen, Erklärung und manuelles Synchronisieren erhöhen die Lernlast. Ort: `TaskFields.tsx`, `TaskEditor.tsx`; Bild `/tmp/prio-critique-a/phone-new-editor.png`. **Empfehlung:** Titel, sichtbares Ziel und Beschreibung zuerst; Zusatzangaben bedarfsgerecht aufklappen. Bereits vorhandene Angaben bleiben unmittelbar auffindbar. **Passender Befehl:** `impeccable distill`. **Status:** Gestaltungsentscheidung offen.

4. **P2 — Mobile Erfassung scrollt in der Gesamtansicht weg.** „Neue Aufgabe“ wanderte von y=168 zu y=-19; in der Listenansicht bleibt sie erreichbar. Ort: `OverviewPanel.tsx`, `mobile/MobileWorkspace.tsx`; Bild `/tmp/prio-critique-a/phone-overview-scrolled.png`. **Empfehlung:** Dauerhaft erreichbare Erfassung in der Daumenzone, mit unveränderter expliziter Zielwahl bzw. manuell gewählter Standardliste. **Passender Befehl:** `impeccable adapt`. **Status:** Offen.

5. **P2 — Leere Formulare ziehen zu viel Aufmerksamkeit auf sich.** Der Desktop-Composer ist 126 Pixel hoch und durchgehend gefüllt. „Liste anlegen“ bleibt leer als große violette Fläche sichtbar. Aufgaben werden weniger betont. Ort: `TaskComposer.tsx`, `styles.ts`, `index.css`; Bild `/tmp/prio-critique-a/desktop-list.png`. **Empfehlung:** Leerzustände und seltene Verwaltung optisch zurücknehmen; stärkere Flächen für aktive Bearbeitung und Violett für verfügbare Hauptaktionen. Feldgrenzen und Kontrast erhalten. **Passender Befehl:** `impeccable quieter`. **Status:** Gestaltungsentscheidung offen.

## Mentale Last und emotionaler Verlauf

Aufgabenzeilen haben niedrige mentale Last, Editor und Listenverwaltung moderate. Chunking, minimale Auswahl und progressive Offenlegung sind dort die drei schwachen Punkte. Fünf Verwaltungsaktionen und mehrere Formular-/Zusatzaktionsgruppen sind gleichzeitig sichtbar. Herkunft und die Trennung „Nur für dich“/„Für diese Liste“ reduzieren Gedächtnislast.

Der Überblick beginnt ruhig. Die einfache Erfassung führt zum langen Formular und erzeugt das stärkste Tal. Abhaken mit Rückgängig bietet einen guten Abschluss; eingeschränkte spätere Erreichbarkeit schwächte das Vertrauen. Sofortiges Offline-Speichern ist ein überzeugender Abschluss.

## Personas

- **Casey, unterwegs und unterbrochen:** Gute Entwurfsentscheidung; Erfassung nach Scrollen außerhalb der Daumenzone. Kurze Browserfenster verloren die Aufgabenfläche.
- **Alex, effizienter Nutzer:** Enter-Erfassung hilft. Desktop-„Details hinzufügen“ bietet nur Beschreibung und Datum; weitere Angaben erfordern einen zusätzlichen Bearbeitungsweg.
- **Jordan, erster Gebrauch:** Persönliche versus gemeinsame Einstellungen verständlich. Der Verlust der normalen Detailinteraktion beim Abhaken ist überraschend.

## Zusätzliche technische Evidenz

Der echte CLI-Aufruf `detect --json src/ui` hatte Exitcode 0 und Ausgabe `[]`: **0 Befunde**, keine gemeldeten Regeln/Fundstellen und folglich keine falschen Positiven. Das vorhandene Inventar umfasst 84 TS/TSX-Dateien; eine vom Detektor bestätigte Scanzahl wurde nicht ausgegeben. Die Patternanalyse beweist weder responsive Layouts noch vollständige Barrierefreiheit.

Die berechneten Text- und Hauptknopfkontraste bestehen. Weiß auf dem Hauptakzent erreicht 5,285:1, auf dessen Hover-Farbe 4,700:1. Sehr subtile `surface/40`-Flächen sind nur schwach vom schwarzen Grund getrennt; Rahmen, Abstand und Inhalt tragen ihre Gruppierung mit. Es wurde daraus kein automatischer WCAG-Verstoß konstruiert.

B konnte seinen frischen Browser-Tab nicht öffnen: Die Freigabeprüfung verweigerte den Zugriff mit dem Hinweis auf abgelehnte Nutzerfreigabe. B umging die Ablehnung nicht. Keine Browserbilder und kein Live-Overlay entstanden bei B. Seine Ersatz-Evidenz ist statisch, komponentenbezogen und rechnerisch. A lieferte die echten lokalen Browserbilder und Messwerte; native Tastatur und Emulator wurden nicht geprüft.

Bs P2-Codebefund zum Fokusrückweg der Listen-/Gesamteinstellungen führte zu passenden Fokuskennungen; neue Browserfälle prüfen beide Richtungen des Breitenwechsels. Ein anfänglich roter jsdom-Test erwartete exakt `inert === false`, obwohl jsdom die native Eigenschaft nicht bereitstellt. Die Zustandsprüfung bewahrt nun auch den nicht gesetzten ursprünglichen Wert; der aktuelle lokale Lauf mit 551 Unit-/Integrationstests besteht.

## Kleinere Beobachtungen

„Ohne Bereich“ erscheint mobil auch ohne angelegte Bereiche. Native Checkboxen wirken gegenüber den übrigen Controls wenig gestaltet. Update- und Abmeldeaktionen beanspruchen dauerhaft Platz im Desktopkopf. Ein zusätzlich gemessener Überlauf bei 200 % Schrift wurde durch eine schrumpfbare Feldgruppe und umbrechende Kopfaktionen korrigiert; die Abschlussprüfung ist im laufenden Gesamtpaket dokumentiert.

## Offene Gestaltungsfragen

1. Kompakt mit Titel, Ziel und Beschreibung beginnen und Zusatzangaben aufklappen, oder alle Felder klar in Themenblöcken sichtbar lassen?
2. Neutralere, nahezu schwarze Flächen mit sparsamem Violett, oder vorhandene kühle Farbrollen behalten und deren Größe/Gewicht zurücknehmen?

Die vollständige Paketabnahme und Auslieferungsgrenze stehen in `UI-OVERHAUL-PLAN.md` §16. Diese Kritik ersetzt keine native Abnahme oder spätere fachliche Entscheidungen zu Priorität, Checklisten, Hierarchie und MCP.
