# Bediengeschwindigkeit

Vergleich von Version 0.35.1 (`3cb99df`) mit 0.35.2, gemessen am 28.10.2026.

## Messverfahren

- Gebauter Produktionscode mit isoliertem Supabase-Mock und einem frischen
  Browserkontext je Lauf; ausschließlich synthetische Konten und Daten.
- CachyOS Linux, Ryzen 5 3600, 16 GiB RAM, Node 26.12.1,
  Playwright 1.63.0 / Chromium 153.0.8010.12, ohne sichtbares Browserfenster.
- Zwei Listen, insgesamt 20, 100 oder 300 Aufgaben. Jede Aufgabe enthält eine
  formatierte mehrzeilige Notiz, fünf Checklistenpunkte, einen Tag, eine
  Bewertung und eine Fälligkeit. Zwei Tage haben eingeschränkte Verfügbarkeit.
  Aufklappen und Seitenleiste werden in der Gesamtansicht gemessen;
  Listenwechsel und Listensortierung betreffen jeweils die Hälfte des Bestands.
  Die zusätzlichen Bearbeitungsabläufe beginnen ebenfalls in einer Einzelliste.
- Schmale Ansicht: 390 × 844, CPU vierfach gedrosselt. Breite Ansicht:
  1280 × 900, ohne Drosselung. Dies sind Browsermessungen, keine Messungen auf
  einem echten Android-Gerät.
- Die Zeit läuft ab dem tatsächlichen Klick-/Eingabeereignis bis zum ersten
  Animation Frame mit dem erwarteten Zustand. Knopfsuche, Scrollvorbereitung
  und Browserautomatisierung vor dem Ereignis werden nicht mitgezählt.
  Bei Text beginnt die Messung mit `input`; bei der Seitenleiste zählt die
  erste Reaktion, nicht das Ende der anschließenden Animation. Dies ist keine
  standardisierte INP-Messung und kein Tastatur-bis-Bildschirm-Latenztest.
- Sieben Wiederholungen je Bedienaktion, beim Stresstest mit 300 Aufgaben drei.
  Die zusätzlichen Dialog-, Kalender- und Schreibabläufe haben je drei
  Wiederholungen. Ausgewiesen werden Median und höchster Messwert. Startzeiten
  werden je Lauf einmal erfasst und sind entsprechend Einzelmessungen.
- Lange Hauptthread-Aufgaben und IndexedDB-Abfragen stehen zusätzlich in den
  Rohdaten unter `test-results/performance/`. Die Zeitmessung läuft ohne
  CPU-Sampling; die separate Ursachenanalyse benutzt ein JavaScript-Profil.
- Die Läufe erfolgen nacheinander. Funktionale Browser- und Unit-Tests werden
  außerhalb der Zeitmessung ausgeführt.
- Einzelwerte bleiben in [tests/performance/results/0.35.2.json](tests/performance/results/0.35.2.json)
  erhalten. Vollständige lokale Diagnoseausgaben mit Lesezählern und langen
  Hauptthread-Aufgaben liegen zusätzlich im ignorierten Ergebnisordner.
  Diese Zähler erfassen das Messfenster, nicht den späteren Cloud-Durchlauf.

## Änderungen

Die lokale Datenbank bleibt die einzige Datenquelle. Unveränderte Zeilen
behalten beim erneuten Lesen ihre Objektidentität. Datenleser und schreibende
Aktionen abonnieren keine Synchronisationsmeldungen mehr. Lokale persönliche
Ansichtsänderungen lösen keine erneuten Abfragen der Aufgabeninhalte aus.
Menü und Dialoge haben eigene Abonnements, sodass deren Öffnen unveränderte
Aufgabenzeilen nicht erneut durchlaufen muss. Neue Cloud-Inhalte werden
weiterhin übernommen und neu gelesen.

Eine unbestätigte Klappabsicht erscheint sofort. Nach Bestätigung durch den
Datenbank-Leser endet dieser vorläufige Zustand; bei einem Schreibfehler wird
er zurückgenommen. Gespeicherte Ansichten und Änderungen anderer Geräte
bleiben maßgeblich.

Die aufwendigen Inhalte unveränderter Aufgabenzeilen werden wiederverwendet.
Hinweise teilen sich die von Ark UI unterstützte Steuerung für mehrere
Auslöser, innerhalb jeder Aufgabenzeile getrennt. Das erhält die Begrenzung von
Aktualisierungen auf die betroffene Zeile. Die Tagesgrenzen für die
Verfügbarkeitsberechnung werden anhand von Datum und Zeitzone wiederverwendet;
der Cache ist auf 512 Einträge begrenzt.

Beim Sortierwechsel bleiben dieselben Aufgabenzeilen erhalten. Berechnete
Sortierungen erlauben weiterhin das Ziehen in eine andere Liste; sie ändern
die gespeicherte manuelle Reihenfolge nicht.

Die Listenoberfläche bleibt während der Kalenderansicht erhalten.
[React Activity](https://react.dev/reference/react/Activity) meldet ihre Effekte
und damit die Zieh-Handler im verborgenen Zustand ab und stellt sie beim
Zurückkehren wieder her. Änderungen aus dem Kalender erscheinen anschließend
auch in der Liste. Die App läuft bereits im von React dafür empfohlenen StrictMode.

Ein Klappzustand der App erzeugt keine Widget-Neuberechnung und keine
Erinnerungsprüfung mehr. Die Integration misst vorher **zwei Widget-Aufrufe
und eine Erinnerungsprüfung je Klappänderung**, anschließend jeweils **null**.
Der Klappzustand wird trotzdem synchronisiert. Echte Aufgabenänderungen,
spätere Offline-Uploads und Änderungen während eines laufenden Uploads
behalten die erforderlichen Aktualisierungen.

Grundlagen für die Wiederverwendung: [React memo](https://react.dev/reference/react/memo),
[Ark Tooltip mit mehreren Auslösern](https://ark-ui.com/docs/components/tooltip)
und [dnd-kit useSortable](https://dndkit.com/react/hooks/use-sortable/).

## Erneut messen

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54341 VITE_SUPABASE_PUBLISHABLE_KEY=e2e-publishable-key \
  npm run build -- --outDir node_modules/.cache/prio-perf-after
npm run test:perf -- after 100 mobile 4 7
npm run test:perf -- after 100 desktop 1 7
npm run test:perf -- after 300 mobile 4 3
```

Für einen Vergleich wird der Ausgangsstand in einer getrennten Arbeitskopie
mit derselben Mock-Konfiguration nach
`node_modules/.cache/prio-perf-before` dieser Arbeitskopie gebaut. Anschließend
verwendet das Messprogramm `before` statt `after`. Der Zusatz `extras` nach der
Wiederholungszahl prüft zusätzliche Dialog- und Bearbeitungsabläufe.

Die bestehende Sortierung wird wirklich abgewartet, einschließlich der
ID-Reihenfolge bei gleicher Priorität und Erstellzeit. Zufällig gleich hohe
Bewertungen dürfen keine falschen Zeitüberschreitungen erzeugen.

## Messwerte

Alle Angaben in Millisekunden, auf ganze Millisekunden gerundet. „Maximum“ ist der höchste beobachtete Einzelwert, kein Perzentil.

### Telefonansicht, vierfach gedrosselte CPU – 100 Aufgaben

Hauptabläufe, je sieben Messungen. Der Bestand ist auf zwei Listen mit je 50 Aufgaben verteilt.

| Bedienaktion | Median vorher | Median jetzt | Maximum vorher | Maximum jetzt |
| --- | ---: | ---: | ---: | ---: |
| Checkliste aufklappen | 2524 | 37 | 2798 | 54 |
| Checklistenpunkt abhaken | 24 | 17 | 30 | 20 |
| Checklistenpunkt wieder öffnen | 16 | 12 | 24 | 14 |
| Checkliste einklappen | 1976 | 38 | 2019 | 50 |
| Notiz aufklappen | 2539 | 48 | 2616 | 63 |
| Notiz einklappen | 1940 | 38 | 2106 | 40 |
| Aufgabe öffnen | 820 | 178 | 1165 | 470 |
| Titel eingeben (ab input) | 28 | 14 | 37 | 16 |
| Aufgabe schließen | 714 | 176 | 773 | 194 |
| Seitenleiste öffnen | 1249 | 119 | 1283 | 124 |
| Seitenleiste schließen | 667 | 140 | 735 | 151 |
| Liste wechseln | 518 | 386 | 579 | 468 |
| Sortiermenü öffnen | 24 | 43 | 33 | 50 |
| Nach Priorität sortieren | 2663 | 150 | 2716 | 160 |
| Zur manuellen Reihenfolge wechseln | 2824 | 158 | 2879 | 177 |

### Breite Ansicht, ohne CPU-Drosselung – 100 Aufgaben

Hauptabläufe, je sieben Messungen. Der Bestand ist auf zwei Listen mit je 50 Aufgaben verteilt.

| Bedienaktion | Median vorher | Median jetzt | Maximum vorher | Maximum jetzt |
| --- | ---: | ---: | ---: | ---: |
| Checkliste aufklappen | 356 | 18 | 448 | 23 |
| Checklistenpunkt abhaken | 8 | 12 | 14 | 15 |
| Checklistenpunkt wieder öffnen | 14 | 7 | 193 | 8 |
| Checkliste einklappen | 413 | 18 | 658 | 20 |
| Notiz aufklappen | 692 | 21 | 1176 | 28 |
| Notiz einklappen | 357 | 19 | 865 | 26 |
| Aufgabe öffnen | 338 | 68 | 373 | 158 |
| Titel eingeben (ab input) | 17 | 26 | 23 | 27 |
| Aufgabe schließen | 199 | 46 | 216 | 60 |
| Liste wechseln | 134 | 119 | 172 | 145 |
| Sortiermenü öffnen | 9 | 21 | 21 | 24 |
| Nach Priorität sortieren | 480 | 64 | 562 | 68 |
| Zur manuellen Reihenfolge wechseln | 481 | 43 | 502 | 53 |

### Telefonansicht, vierfach gedrosselte CPU – 100 Aufgaben

zusätzliche Abläufe, je drei Messungen. Der Bestand ist auf zwei Listen mit je 50 Aufgaben verteilt.

| Bedienaktion | Median vorher | Median jetzt | Maximum vorher | Maximum jetzt |
| --- | ---: | ---: | ---: | ---: |
| Listeneinstellungen öffnen | 382 | 60 | 389 | 76 |
| Listeneinstellungen schließen | 356 | 86 | 363 | 91 |
| Konto öffnen | 407 | 115 | 435 | 132 |
| Konto schließen | 378 | 96 | 389 | 113 |
| Aufgabe für Notiz öffnen | 440 | 135 | 662 | 331 |
| Notiz eingeben (ab input) | 26 | 20 | 81 | 32 |
| Aufgabe speichern | 729 | 200 | 782 | 216 |
| Aufgabe abhaken | 1064 | 134 | 1120 | 154 |
| Abhaken rückgängig | 1034 | 159 | 1065 | 160 |
| Zur Gesamtansicht wechseln¹ | 963 | 702 | 963 | 702 |
| Kalender öffnen | 3310 | 250 | 3762 | 304 |
| Nächsten Monat anzeigen | 46 | 62 | 49 | 70 |
| Vorigen Monat anzeigen | 43 | 55 | 46 | 65 |
| Wenig Zeit setzen | 170 | 170 | 189 | 216 |
| Normale Zeit setzen | 348 | 180 | 369 | 189 |
| Zur Liste aus dem Kalender zurück | 933 | 311 | 1066 | 329 |

¹ Wechsel zur Gesamtansicht: eine Einzelmessung je Fassung, kein Median aus drei Versuchen.

### Breite Ansicht, ohne CPU-Drosselung – 100 Aufgaben

zusätzliche Abläufe, je drei Messungen. Der Bestand ist auf zwei Listen mit je 50 Aufgaben verteilt.

| Bedienaktion | Median vorher | Median jetzt | Maximum vorher | Maximum jetzt |
| --- | ---: | ---: | ---: | ---: |
| Listeneinstellungen öffnen | 102 | 30 | 140 | 36 |
| Listeneinstellungen schließen | 103 | 42 | 112 | 42 |
| Konto öffnen | 107 | 34 | 113 | 41 |
| Konto schließen | 115 | 31 | 129 | 33 |
| Aufgabe für Notiz öffnen | 147 | 58 | 225 | 151 |
| Notiz eingeben (ab input) | 33 | 38 | 40 | 43 |
| Aufgabe speichern | 332 | 89 | 357 | 98 |
| Aufgabe abhaken | 325 | 49 | 440 | 61 |
| Abhaken rückgängig | 288 | 46 | 339 | 65 |
| Zur Gesamtansicht wechseln¹ | 253 | 208 | 253 | 208 |
| Kalender öffnen | 247 | 79 | 258 | 81 |
| Nächsten Monat anzeigen | 17 | 25 | 18 | 29 |
| Vorigen Monat anzeigen | 18 | 22 | 19 | 24 |
| Wenig Zeit setzen | 64 | 61 | 65 | 65 |
| Normale Zeit setzen | 65 | 64 | 67 | 68 |
| Zur Liste aus dem Kalender zurück | 248 | 103 | 262 | 108 |

¹ Wechsel zur Gesamtansicht: eine Einzelmessung je Fassung, kein Median aus drei Versuchen.

### Unterschiedliche Bestandsgrößen

Telefonansicht mit vierfach gedrosselter CPU. Je Zelle: Median vorher → jetzt. Bei 20 und 100 Aufgaben sieben Messungen, bei 300 drei. In einer Einzelliste liegt jeweils die Hälfte des Bestands.

| Bedienaktion | 20 Aufgaben | 100 Aufgaben | 300 Aufgaben |
| --- | ---: | ---: | ---: |
| Checkliste aufklappen | 472 → 16 | 2524 → 37 | 7617 → 92 |
| Notiz aufklappen | 631 → 26 | 2539 → 48 | 7493 → 95 |
| Aufgabe öffnen | 262 → 84 | 820 → 178 | 2308 → 402 |
| Seitenleiste öffnen | 288 → 41 | 1249 → 119 | 4314 → 311 |
| Liste wechseln | 146 → 129 | 518 → 386 | 1618 → 1110 |
| Nach Priorität sortieren | 495 → 57 | 2663 → 150 | 6817 → 334 |
| Zur manuellen Reihenfolge wechseln | 515 → 62 | 2824 → 158 | 7343 → 408 |

### Starten

Einzelmessungen der Hauptläufe, keine statistisch belastbaren Startzeitvergleiche. Je Zelle: vorher → jetzt. Gemessen wird bis zum ersten Frame mit Aufgabenzeilen. Die Zusatzläufe enthalten weitere Startmessungen im JSON.

| Ansicht / Bestand | Erster Start | Cache vorhanden | Cache vorhanden, offline |
| --- | ---: | ---: | ---: |
| Telefon, CPU ×4, 20 Aufgaben | 1489 → 1272 | 779 → 701 | 787 → 602 |
| Telefon, CPU ×4, 100 Aufgaben | 2609 → 2046 | 1600 → 1300 | 1492 → 1106 |
| Telefon, CPU ×4, 300 Aufgaben | 5453 → 4170 | 5525 → 2236 | 3836 → 2791 |
| Breit, CPU ×1, 100 Aufgaben | 764 → 631 | 486 → 398 | 621 → 362 |

### Einordnung

Aufklappen und Sortieren verlieren den größten Teil ihrer Verzögerung. Große Listenwechsel und der erste Aufbau bleiben die teuersten Vorgänge. Bei 300 Aufgaben und vierfach gedrosselter CPU ist ein Listenwechsel weiterhin spürbar.

Kurze Eingaben, Sortiermenü und Monatsblättern waren bereits schnell. Einzelne Werte liegen nach den Änderungen höher. Aus drei beziehungsweise sieben Versuchen lässt sich für kleine Unterschiede keine belastbare statistische Aussage ableiten. Die Tabellen führen diese Werte ebenfalls auf.

Der Emulator wurde entsprechend der Nutzer-Vorgabe ausgelassen. Weder diese Zeitmessungen noch die simulierte CPU-Drosselung ersetzen eine Messung auf dem tatsächlichen Telefon. Widgets und Erinnerungen werden zusätzlich über die Laufzeit-Integration geprüft; ihre gemessenen Aufrufzahlen stehen oben.

## Funktionale Prüfung

- Typecheck, Lint, Hilfsskripte und Produktionsbuild sind grün.
- 812 Unit- und Integrationstests in 106 Dateien sind grün.
- Alle 280 Browserfälle sind grün, einschließlich PWA-Start ohne Netz,
  gespeicherter Ansichten, Listenwechsel, Ziehen und Kalenderwechsel.
- Telefonbilder in Hoch- und Querformat sowie hellem und dunklem Thema
  wurden angesehen.
