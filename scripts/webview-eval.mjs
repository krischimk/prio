/**
 * Winziges CDP-Werkzeug: führt im laufenden WebView einen Ausdruck aus.
 * Aufruf: node tmp-cdp.mjs '<javascript>'
 */
const seiten = await (await fetch('http://127.0.0.1:9222/json')).json()
const ziel = seiten.find((s) => s.type === 'page') ?? seiten[0]
const ws = new WebSocket(ziel.webSocketDebuggerUrl)

const ergebnis = await new Promise((fertig, fehler) => {
  const zeit = setTimeout(() => fehler(new Error('Zeitüberschreitung')), 20000)
  ws.onopen = () =>
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: process.argv[2], returnByValue: true, awaitPromise: true },
    }))
  ws.onmessage = (nachricht) => {
    clearTimeout(zeit)
    fertig(JSON.parse(nachricht.data))
  }
  ws.onerror = fehler
})

ws.close()
const r = ergebnis.result ?? {}
if (r.exceptionDetails) {
  console.log('FEHLER:', r.exceptionDetails.text, r.exceptionDetails.exception?.description ?? '')
} else {
  console.log(typeof r.result?.value === 'string' ? r.result.value : JSON.stringify(r.result?.value, null, 2))
}
