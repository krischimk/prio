/**
 * Winziges CDP-Werkzeug: führt im laufenden WebView einen Ausdruck aus.
 * Aufruf: node webview-eval.mjs '<javascript>'
 *
 * Die Debug-Schnittstelle schickt über dieselbe Verbindung auch Meldungen, die
 * nicht zur Frage gehören. Wer die erste davon nimmt, druckt gelegentlich
 * „undefined“, obwohl der Ausdruck sauber gelaufen ist. Deshalb wird hier auf
 * die Antwort mit der eigenen Anfragenummer gewartet und alles andere
 * verworfen.
 */
const ANFRAGE = 1
const ZEITGRENZE_MS = 20000

const ausdruck = process.argv[2]
if (!ausdruck || ausdruck.trim() === '') {
  console.error("Kein Ausdruck übergeben: npm run android:emu:eval -- '<javascript>'")
  process.exit(2)
}

const seiten = await (await fetch('http://127.0.0.1:9222/json')).json()
const ziel = seiten.find((s) => s.type === 'page') ?? seiten[0]
if (!ziel) {
  console.error('Kein Ziel gefunden. Läuft die App, und ist Port 9222 weitergeleitet?')
  process.exit(1)
}

const ws = new WebSocket(ziel.webSocketDebuggerUrl)

const ergebnis = await new Promise((fertig, fehler) => {
  const beenden = (fn, wert) => {
    clearTimeout(zeit)
    ws.close()
    fn(wert)
  }
  const zeit = setTimeout(
    () => beenden(fehler, new Error('Zeitüberschreitung: keine Antwort vom WebView')),
    ZEITGRENZE_MS,
  )

  ws.onopen = () =>
    ws.send(
      JSON.stringify({
        id: ANFRAGE,
        method: 'Runtime.evaluate',
        params: { expression: ausdruck, returnByValue: true, awaitPromise: true },
      }),
    )

  ws.onmessage = (nachricht) => {
    let daten
    try {
      daten = JSON.parse(nachricht.data)
    } catch {
      return
    }
    // Statusmeldungen und fremde Antworten ignorieren.
    if (daten.id !== ANFRAGE) return
    beenden(fertig, daten)
  }

  ws.onerror = () => beenden(fehler, new Error('Verbindung zum WebView fehlgeschlagen'))
})

const r = ergebnis.result ?? {}
if (ergebnis.error) {
  console.error('CDP-Fehler:', ergebnis.error.message ?? JSON.stringify(ergebnis.error))
  process.exit(1)
}
if (r.exceptionDetails) {
  console.log('FEHLER:', r.exceptionDetails.text, r.exceptionDetails.exception?.description ?? '')
  process.exit(1)
}

const wert = r.result?.value
if (wert === undefined) {
  // Kein stilles „undefined“: Das kann ein Ausdruck ohne Rückgabe sein oder
  // die falsche Seite – der Ziel-URL macht den Unterschied sichtbar.
  console.log(`undefined (der Ausdruck lieferte nichts) · Ziel: ${ziel.url}`)
} else {
  console.log(typeof wert === 'string' ? wert : JSON.stringify(wert, null, 2))
}
