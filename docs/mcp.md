# Prio über MCP

Adresse: **https://prio-krischi.pages.dev/mcp**. Streamable HTTP, OAuth mit
PKCE. Der Server läuft bei Cloudflare, unabhängig von geöffneter App oder PC.
Er liest den bestätigten Cloudbestand; noch nicht synchronisierte Eingaben
eines Offline-Geräts kann er nicht kennen.

Im MCP-Programm die Adresse als entfernten Server hinzufügen und OAuth wählen.
Auf Prio anmelden, die angefragte Verbindung prüfen und erlauben. Lesen umfasst
alle zugänglichen Listen. Bearbeiten ist vorausgewählt, Teilen zunächst aus.
Unter **Konto → KI-Verbindungen** lassen sich diese Rechte ändern und Zugriffe
sofort widerrufen. E-Mail und Passwort werden nur auf Prio eingegeben, nie als
MCP-Konfiguration. Der Zugang für ChatGPT Web hängt zusätzlich davon ab, ob das
jeweilige ChatGPT-Konto eigene MCP-Verbindungen anbietet.

## Kurze Aufträge

* „Was sollte ich als Nächstes tun?“ – verfügbare Aufgaben aus der persönlichen
  Gesamtansicht nach aktueller Priorität, mit kurzer Begründung.
* „Was ist diese Woche fällig?“ – Zeitfenster in der freigegebenen Zeitzone.
* „Packe Zelt, Isomatte und Kocher auf meine Packliste.“ – Namen und vorhandene
  Aufgaben prüfen, Namensregel beachten, zusammen anlegen.
* „Hake die Checklistenpunkte zu den erledigten Einkäufen ab.“ – Hauptaufgabe
  bleibt unabhängig.
* „Verschiebe den Bericht nach Arbeit und erinnere mich zehn Minuten vorher.“
  – vorhandene Aufgabe bearbeiten, ohne eine Kopie anzulegen.
* „Zeige alle offenen Aufgaben mit Uni und Dringend.“ – beide Tags erforderlich.
* „Mache deine letzte Änderung rückgängig.“ – nur wenn seitdem keine betroffene
  Zeile geändert wurde.

Mehrdeutige identische Listennamen werden mit stabilen Kennungen aufgelöst;
wenn keine Auswahl begründbar ist, muss der Agent nachfragen. Die Tools führen
keine eigenständigen Agentenschleifen oder geplanten Erinnerungen aus.

## Schnittstelle

`get_workspace`, `search_tasks`, `get_tasks`, `list_changes` lesen.
`create_tasks`, `update_tasks`, `complete_tasks`, `move_tasks`, `delete_tasks`,
`restore_tasks`, `edit_checklist`, `manage_lists`, `manage_sections`,
`update_preferences`, `manage_sharing`, `undo_change` schreiben.

Die Anleitung `prio://guide` und die Server-Instruktionen erklären die
Fachregeln: unabhängige Checklisten, Wiederholungen, relative Erinnerungen,
optionale Bewertungen, tatsächlicher Restaufwand, Namensregeln, persönliche
Listenansichten und Ablauf erledigter Aufgaben. Eingelesene Notizen sind Daten,
keine Anweisungen an den Agenten. Antworten liefern strukturierte Daten neben
dem Text, aussagekräftige Fehler und Kennungen statt unauflösbarer Namen.

Schreibaufträge haben eine UUID `request_id`. Derselbe Auftrag wird nach einem
Verbindungsabbruch mit derselben Kennung wiederholt und genau einmal
gespeichert. Für vorhandene Aufgaben/Listen wird die `revision` aus der letzten
Leseantwort benötigt. Ein Konflikt bedeutet: nichts gespeichert, neu lesen und
entscheiden. Listenbestand und Positionen sind ebenfalls atomar abgesichert.
Sammelbefehle werden vollständig gespeichert oder vollständig zurückgenommen.

Suche begrenzt die Kandidaten auf 10.000 und Ergebnisseiten auf 100. Bei einer
größeren Auswahl wird ausdrücklich zum Eingrenzen aufgefordert. Cursor binden
Filter, Datenstand und Berechnungszeit; zwischenzeitliche Änderungen verlangen
einen Neustart der Suche. Notizen sind in Suchergebnissen gekürzt; `get_tasks`
liefert den vollständigen Inhalt. Tags verwenden UND. Priorität und
Wiederholungen stammen aus denselben Fachfunktionen wie in der App; die
serverseitigen Kalenderschritte verwenden die freigegebene IANA-Zeitzone.

## Sicherheitsgrenzen

* Signaturprüfung mit vertrauenswürdigem Supabase-JWKS, festem Aussteller,
  Algorithmus, Ablauf und Token-Typ. Native App-Tokens sind keine MCP-Tokens.
* Externe Programme erhalten ausschließlich undurchsichtige Prio-Tokens.
  Supabase-Access-/Refresh-Tokens und vertrauliche Client-Secrets bleiben
  AES-GCM-verschlüsselt im privaten Tresor; der Schlüssel liegt nur im Worker.
  Registrierung und Tokenaustausch laufen über Prio. Die registrierten
  Supabase-Clients sind intern vertraulich: Ein externer Client kann den
  Tokenaustausch nicht direkt bei Supabase durchführen. Das verhindert auch
  Zugriff auf native Auth-Endpunkte außerhalb der Prio-Datenfreigabe.
* Supabase verwendet derzeit `aud=authenticated`, keinen individuellen
  Ressourcen-Audience-Wert. Die Empfängerbindung erfolgt deshalb zusätzlich
  über die native Freigabe von Benutzer, OAuth-Client und fester MCP-Adresse.
  Aktive Sitzung und OAuth-Zustimmung werden bei jedem Zugriff geprüft.
* Ein PostgREST-Eingangshook sperrt für OAuth-Tokens Tabellen und sämtliche
  nativen RPC-Umwege. Die freigegebenen MCP-RPCs prüfen ihre Rechte nochmals.
  Normale App-Sitzungen und anonyme Registrierung bleiben unverändert.
* Der Worker verwendet ausschließlich das Token der verbundenen Person,
  **keinen service_role-Schlüssel**. Fachbefehle werden mit einem getrennten
  privaten HMAC-Schlüssel attestiert, damit ein Client keine eigenen
  Zeilenpläne an der Fachlogik vorbei einschleusen kann. Der bestehende
  Datenbankschreiber prüft weiterhin Besitz, Mitgliedschaft und Vergleichsbasis.
* Private Tabellen haben RLS und keine App-Tabellenrechte. SECURITY DEFINER
  liegt ausschließlich im privaten Schema mit festem leerem Suchpfad.
* Pro Verbindung höchstens 120 Schreibaufträge je Minute. Anfragen, Ergebnisse
  und Planung sind begrenzt; Konto-E-Mails und Token werden nicht protokolliert.
* Änderungsverlauf und Rückgängig gehören zur jeweiligen Verbindung. Gelöscht
  wird weich. Keine Aktion darf den endgültigen Aufgabenablauf zurückdrehen.
  Läuft eine Aufgabe endgültig ab, werden auch Befehlsinhalte und Vor-/Nachkopien
  betroffener Aufträge aus dem Verlauf entfernt; ein Absichtshash verhindert
  weiterhin doppelte Ausführung alter Auftragskennungen.

Der Eingangshook ist absichtlich projekweit: Ein direktes REST-API darf die
Freigabeoberfläche nicht umgehen. Ein bestehender fremder Hook wird bei der
Migration nicht überschrieben; seine Einbindung muss dann ausdrücklich
zusammengeführt werden.

## Betrieb und Prüfung

`npm run build:web` baut zusätzlich `dist/_worker.js` und `_routes.json`.
Die APK verwendet weiterhin `npm run build`, ohne Serverdateien. Nur `/mcp`
und die öffentlichen Ressourcen-Metadaten laufen durch den Worker; statische
Dateien und die PWA behalten ihren bisherigen Weg.

Migrationen 0027 und 0028 müssen vor dem Webbuild eingespielt werden. Ein zufälliger privater
32-Byte-Schlüssel liegt als `PRIO_MCP_COMMAND_KEY` in der privaten `mcp.env`,
als Repository-Secret und als Pages-Secret sowie in `private.mcp_settings`.
Die private Datei wird niemals eingecheckt. Der Produktions-Workflow setzt nur
diesen einen Pages-Secret per PATCH und veröffentlicht erst nach allen Tests.
`npm run db:check` prüft auch Hook, RPCs, private Tabellenrechte und Schlüssel.
Refresh-Tokens rotieren atomar; ein verlorenes Ergebnis lässt sich für 30
Sekunden erneut abrufen. Ein Datenbankjob entfernt verbrauchte und abgelaufene
Tresoreinträge. Widerruf löscht deren verschlüsselte Sitzungsdaten sofort.

Gelesene Anforderungen und Umsetzung:

| Offizielle Vorgabe | Umsetzung / Nachweis |
| --- | --- |
| MCP SDK v2: frische Serverinstanz je HTTP-Anfrage, zustandslos | `http.ts`, `createMcpHandler`, echter Clienttest |
| SDK: Host und Origin selbst prüfen; begrenzte Requestgröße | `http.ts`, Auth-/Origin-/Hosttests |
| MCP OAuth: geschützte Ressourcen-Metadaten und Challenge | beide Well-known-Wege und `WWW-Authenticate` |
| Supabase: eigene Zustimmungsseite, PKCE und DCR | `OAuthConsentScreen`, native Freigabe vor Tokenausgabe |
| Token-Sicherheit: Client, Empfänger, Rechte und Widerruf prüfen | JWT + `mcp_connection`, SQL-Umgehungsprüfungen |
| jose: WebCrypto, fester JWKS/Issuer/Algorithmus | `http.ts`; keine aus Tokenfeldern abgeleitete Schlüsseladresse |
| Temporal: expliziter Polyfill-Import und Zeitzone | `calendar.ts`; DST-/Monatsende-Test |
| Cloudflare Pages: Advanced Mode, ASSETS-Fallback, Routingdatei | `worker.ts`, `build-mcp.mjs`; separater Webbuild |

Quellen: [SDK](https://ts.sdk.modelcontextprotocol.io/v2/serving/web-standard.html),
[MCP-Autorisierung](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization),
[Supabase MCP](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication),
[Token-Sicherheit](https://supabase.com/docs/guides/auth/oauth-server/token-security),
[Pages](https://developers.cloudflare.com/pages/functions/advanced-mode/).

`tests/integration/mcp.test.ts` prüft Protokoll und Fachregeln. `npm run db:test`
prüft echte PostgreSQL-Transaktionen einschließlich fehlender Freigabe,
gefälschter Attestation, REST-Umwegen, privaten Daten, Konflikt-Rollback und
Widerruf. E2E prüft Zustimmung und Kontoverwaltung in beiden Ansichten.
