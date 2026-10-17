# Prio über MCP – Vorschlag zur Besprechung

Stand: 16. Oktober 2026. Dies ist ein Entwurf, noch kein implementierter Server.
Bestätigt ist der Zugriff auf den synchronisierten Cloud-Bestand bei geschlossener
App. Noch nicht hochgeladene Offline-Änderungen eines Geräts sind nicht enthalten.
ChatGPT im Web gehört ausdrücklich zum Zielumfang, zusätzlich zu Codex. Beide
verwenden denselben Server; die Verbindung im Web wird als Plugin eingerichtet.
[Offizielle OpenAI-Anbindung](https://learn.chatgpt.com/docs/extend/mcp#connect-an-existing-mcp-server).

## Nutzung und Umfang

Ein gehosteter Endpunkt erlaubt beispielsweise: „Zeige meine dringendsten offenen
Aufgaben mit dem Tag Uni“, „Verschiebe diese drei Aufgaben in Arbeit“, „Ergänze
die Checkliste“ oder „Hake die tägliche Aufgabe ab“. Ein solcher Abschluss muss
dieselben fachlichen Folgen haben wie in Prio, einschließlich der Wiederholung.

Ich empfehle Streamable HTTP für die Verbindung und eine Anmeldung mit dem
Prio-Konto. Das offizielle SDK empfiehlt diesen Transport für entfernte Server;
lokal gestartete Server verwenden typischerweise stdio.
[MCP TypeScript SDK: Server](https://ts.sdk.modelcontextprotocol.io/server).
Ein lokaler Vermittler wäre erst bei einem konkreten Client nötig, der den
entfernten Endpunkt nicht direkt anbinden kann.

Die Werkzeuge sollten fachliche Aktionen ausdrücken:

| Bereich | Lesend | Schreibend |
| --- | --- | --- |
| Aufgaben | Suchen, filtern, sortieren, Details samt Herkunft lesen | Anlegen, gezielt ändern, erledigen, wiederöffnen, verschieben, löschen |
| Checklisten und Tags | Punkte, Fortschritt, Gewichtung, vorhandene Tags | Punkte bearbeiten, abhaken, umsortieren, Gewichte und Kopplung setzen, Tags ändern |
| Bewertung und Termine | Gespeicherte Einschätzung und aktuell berechnete Werte | Wichtigkeit/Aufwand, Dringlichkeitsmodus, Termine, Wiederholung, Erinnerungsregeln ändern |
| Listen | Bereiche, Regeln und Mitgliedschaften lesen | Listen und Bereiche verwalten, Regeln ändern, berechtigt teilen |
| Persönliche Auswahl | Gesamtansicht, Sortierung, versteckte Listen lesen | Dieselben persönlichen Einstellungen wie in der App ändern |

Keine freie SQL-Schnittstelle. Gleichzeitig sollten Agenten mehrere passende
Aufgaben auf einmal lesen oder bearbeiten können, statt für jedes Feld einen
weiteren Aufruf zu brauchen. Filter sind strukturiert: Listenkennungen, Tags mit
UND-Verknüpfung, Status, Fälligkeitsbereich und Sortierung. Ergebnisse liefern
stabile Kennungen, lesbare Namen, begrenzte Seiten und einen Fortsetzungscursor.
Gleiche Aufgabennamen müssen eindeutig über Kennungen bearbeitbar bleiben.

## Zuverlässiges Schreiben

Der Server prüft bei jedem Befehl Benutzer- und Listenrechte. Eine Verbindung
soll widerrufbar und mindestens auf Lesen oder Lesen/Schreiben begrenzbar sein.
Freigaben und Löschaktionen verdienen getrennt begrenzbare Rechte. Welche
Bestätigungen der Agent anzeigt, hängt zusätzlich von seinem Client ab; Prio
braucht keinen Bestätigungsdialog für jede alltägliche Änderung.

OAuth-Zugangstokens müssen für diesen MCP-Endpunkt bestimmt sein; ein beliebiges
Token eines anderen Dienstes darf nicht genügen. Das folgt aus der offiziellen
[MCP-Autorisierung](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).
Als konkrete Grundlage ist inzwischen die offizielle
[Supabase-MCP-Vorlage](https://supabase.com/library/docs/headless/mcp) interessant:
Edge Function, benutzerbezogene Clients und OAuth für externe Agenten. Sie setzt
asymmetrische Signierschlüssel und den aktivierten Supabase-OAuth-Server voraus.
Der OAuth-Server ist derzeit Beta; die Eignung wird zuerst in einem kleinen
Prototyp geprüft.
[OAuth-Einrichtung](https://supabase.com/docs/guides/auth/oauth-server/getting-started).
Ein eigener langlebiger Compute-Dienst ist dafür zunächst nicht erforderlich.

Supabase-Scopes begrenzen Identitätsinformationen, nicht automatisch den
Datenzugriff. Einschränkungen je Verbindung müssen anhand der überprüften
Client-Kennung auch im Datenbankzugriff und in Fachbefehlen gelten; andernfalls
könnte ein direkter API-Aufruf sie umgehen.
[Supabase: Token-Sicherheit und RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security).
Ein globaler privilegierter Schlüssel ersetzt keine Benutzerprüfung.

Jede Änderung erhält eine eindeutige Auftragskennung und eine erwartete Revision.
Ein wiederholter identischer Auftrag liefert seine gespeicherte Antwort und legt
keine zweite Aufgabe an. Widersprüchliche Änderungen liefern einen verständlichen
Konflikt mit aktuellem Stand. Geänderte fremde Felder sollten erhalten bleiben.
Antworten nennen die gespeicherten Werte und fachlichen Nebenwirkungen.

Ein fachlicher Befehl ist atomar: entweder Abschluss **und** gültiger Nachfolger,
oder keine Änderung. Ein Sammelauftrag kann Ergebnisse je Aufgabe liefern, muss
Teilfehler jedoch ausdrücklich ausweisen. „Alles erfolgreich“ trotz eines
abgelehnten Eintrags wäre falsch. Sicherheitseigenschaften werden serverseitig
erzwungen; die offiziellen
[Tool-Annotationen sind Hinweise](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/)
für Clients und keine Berechtigungsprüfung.

## Was im Repository dafür noch fehlt

Prio besitzt bereits reine Bewertungs-, Checklisten-, Wiederholungs- und
Platzierungslogik sowie einen geschützten Zeilenabgleich. Der bestehende
`sync_push` bestätigt Zeilen einzeln; er macht aus mehreren Zeilen noch keinen
atomaren Fachbefehl. Die Dexie-Repositories sind außerdem ein lokaler Datenzugriff.
Das direkte Tabellen-Update im Supabase-Beispiel passt deshalb nicht zu Prio:
Die bestehenden Schreibsperren bleiben erhalten, Werkzeuge rufen die geprüften
Fachbefehle auf. Aus der Vorlage übernehmen wir Verbindung und Anmeldung.
Der [Supabase-Artikel](https://supabase.com/blog/select-2026-build-anything) ist
Anstoß zur Prüfung, keine Aufforderung zum Wechsel unseres Migrationsmodells.

Deshalb zuerst einen echten vertikalen Weg bauen: Aufgabe lesen, gezielt ändern
und eine wiederkehrende Aufgabe sicher abschließen. Dafür gemeinsame fachliche
Verträge und serverseitige Transaktionen ergänzen. Die benötigten reinen Regeln
werden von App und Server verwendet; Browserlaufzeit, IndexedDB und
Gerätebenachrichtigungen bleiben bei der App. Keine allgemeine Plugin-Architektur
und kein zweites unabhängig gepflegtes Fachmodell.

Abgeleitete Priorität und Restaufwand werden beim Lesen mit Berechnungszeitpunkt
geliefert. Termine brauchen eine eindeutige Zeitzone. Das Speichern einer
Erinnerungsregel ist von der tatsächlichen Zustellung auf einem Telefon zu
unterscheiden. MCP darf keine erfolgte Benachrichtigung behaupten.

## Bestätigte Entscheidungen und nächste Lieferung

Am 16. Oktober bestätigt: Eine Verbindung erhält Zugriff auf alle Listen, auf
die das Konto Zugriff hat, einschließlich der üblichen Schreibaktionen. Teilen
und Mitgliederverwaltung brauchen eine zusätzliche Freigabe für genau diese
Verbindung. Die E-Mail bleibt privat und dient auch der Passwort-Wiederherstellung;
Benutzernamen bleiben die sichtbare Identität beim Teilen.

1. Anmeldung und widerrufbare Verbindung; Listen und Aufgaben suchen/lesen.
2. Sichere Aufgabenbefehle samt Checklisten, Bewertung und Wiederholungen.
3. Restliche Listen-, Bereichs-, Freigabe- und persönlichen Funktionen ergänzen.

Abschlusskriterien: funktioniert bei geschlossener App; fremde Listen bleiben
unzugänglich; Wiederholung eines Auftrags erzeugt keine Duplikate; gleichzeitig
schreibende App und Agent verlieren keine Änderungen; Abschluss samt Nachfolger
ist atomar; Entzug der Verbindung sperrt weitere Zugriffe.

Die öffentliche OAuth-Erkennung des Projekts lieferte am 16. Oktober noch keine
Metadaten (HTTP 404); ein asymmetrischer ES256-Signierschlüssel ist vorhanden.
Der nächste externe Einrichtungsschritt ist deshalb der Supabase-OAuth-Server
unter Auth → OAuth Server. Die Anmeldung in der App muss dafür nicht ersetzt
werden. Hinzu kommen die Prio-Freigabeseite und die widerrufbaren Rechte in der
Datenbank. Die vorhandenen Supabase-Schlüssel im App-Bundle sind öffentlich und
reichen nicht zum Verwalten dieser Projekteinstellungen.

Die Passwort-Wiederherstellung ist im Code ergänzt und wird gegen den lokalen
Auth-Mock geprüft. Reale Mailzustellung sowie die Freigabe der Rückkehradresse
bleiben getrennte Einrichtungsschritte. Registrierung versendet derzeit keine
Bestätigungsmail (`mailer_autoconfirm=true`, öffentlich am 16. Oktober geprüft).
Keine dieser Angaben bedeutet, dass bereits ein MCP-Endpunkt veröffentlicht ist.

## Kurze Aufträge, die ohne Rückfragen funktionieren sollen

Vorschlag vom 17. Oktober. Die Beispiele beschreiben das Ziel, nicht schon
verfügbare Werkzeuge. Lesen und Schreiben verwenden dieselben Fachregeln wie
die App; Priorität und Restaufwand werden für den aktuellen Zeitpunkt berechnet.

| Kurzer Auftrag | Sinnvolle Ausführung |
| --- | --- |
| „Was sollte ich als Nächstes tun?“ | Eine offene Aufgabe aus den Listen der Gesamtansicht empfehlen, mit kurzer Begründung aus Fälligkeit, Priorität und Restaufwand; zwei Alternativen anbieten. |
| „Was steht heute an?“ | Heute fällige und überfällige Aufgaben nennen; bevorstehende Wiederholungen als solche kennzeichnen. |
| „Was kann noch warten?“ | Wenig dringliche offene Aufgaben samt Begründung zeigen, ohne Termine zu ändern. |
| „Gib mir etwas Kleines für zwischendurch.“ | Niedrigen Restaufwand bevorzugen; aus der relativen Skala keine erfundenen Minutenangaben machen. |
| „Was habe ich beim Projekt Umzug noch offen?“ | In Titeln, Notizen, Tags und Checklisten suchen, gruppiert nach Liste antworten. |
| „Was fehlt in meiner Packliste?“ | Offene Aufgaben und offene Checklistenpunkte zeigen, ohne deren unabhängige Zustände gleichzusetzen. |
| „Setz Milch auf die Einkaufsliste.“ | Passende Liste finden, ihre Namensregel beachten und einen eindeutigen bestehenden Eintrag bei Bedarf wieder öffnen statt eine Dublette zu erzeugen. |
| „Hake Milch ab.“ | Die im Gespräch eindeutig gemeinte Aufgabe abschließen; Wiederholungen nach den Regeln der App erzeugen. |
| „Mach das rückgängig.“ | Die letzte durch diese Verbindung ausgeführte Änderung anhand ihrer Auftragskennung zurücknehmen, soweit der aktuelle Stand das erlaubt. |
| „Verschiebe das nach Arbeit.“ | Die im Gespräch referenzierte Aufgabe verschieben; Notiz, Termine, Erinnerungen, Bewertung und Checkliste erhalten. |
| „Erinnere mich morgen um neun daran.“ | Für die referenzierte Aufgabe eine Erinnerung in der Kontozone anlegen; tatsächliche Geräte-Zustellung nicht behaupten. |
| „Öffne alle erledigten Aufgaben in der Packliste wieder.“ | Genau die Hauptaufgaben dieser Liste wieder öffnen; Checklistenpunkte gemäß der bestehenden Unabhängigkeit unverändert lassen. |
| „Markiere die drei mit Uni.“ | Die zuvor genannten Kennungen gemeinsam mit dem vorhandenen beziehungsweise normalisierten Tag versehen. |
| „Zerlege das in eine Checkliste.“ | Für die referenzierte Aufgabe sinnvolle kurze Schritte ergänzen; vorhandene Punkte erhalten und keine Hauptaufgabe automatisch abhaken. |
| „Wo gibt es doppelte Aufgabennamen?“ | Offene und erledigte Aufgaben je Liste vergleichen, die Treffer berichten und nichts ungefragt löschen. |

Damit die Kürze zuverlässig bleibt, liefert der Server dem Agenten die
Kontozone, aktuelle Uhrzeit, sichtbare Listenregeln und verständliche Feldregeln.
„Das“ und „die drei“ beziehen sich auf stabile Kennungen aus dem Gespräch, nicht
auf eine möglicherweise anders geöffnete App. Standardvorschläge verwenden die
Gesamtansicht, eine Suche dagegen alle zugänglichen Listen. Fehlende Bewertungen
bleiben als fehlend erkennbar; eine unbewertete überfällige Aufgabe wird nicht
stillschweigend als unwichtig behandelt. Leere Treffer und ausführbare Teile
werden direkt berichtet. Eine echte Mehrdeutigkeit bei schreibenden Aktionen
wird benannt, statt die falsche Aufgabe zu verändern. Teilen bleibt an die
bereits vereinbarte zusätzliche Freigabe je Verbindung gebunden.
