/**
 * Analysiert ein SVG-Symbol: Pfade, Zeichenart und Raster.
 *
 * Warum das nötig ist – drei Fallen, die alle schon zugeschlagen haben:
 *
 * 1. **Nicht nur Pfade.** Viele Sammlungen zeichnen auch mit `<circle>`,
 *    `<rect>`, `<line>` und Ähnlichem. Wer nur `d`-Attribute liest, verliert
 *    diese Teile stillschweigend – eine Waschmaschine ohne Trommel, ein
 *    Traktor ohne Räder.
 *
 * 2. **Strich oder Fläche steht nicht immer im Wurzelelement.** Bei Lucide und
 *    Tabler steht `stroke="currentColor"` oben, bei Iconify-Sammlungen direkt
 *    am Pfad (`<path fill="none" stroke="currentColor">`). Wer nur oben schaut,
 *    zeichnet ein Strichsymbol als gefüllten Klecks.
 *
 * 3. **Das Raster ist nicht immer 24×24.** Temaki etwa liefert
 *    `viewBox="0 0 50 50"`. Wer das übergeht, zeichnet das Symbol winzig in
 *    eine Ecke.
 *
 * Bewusst ohne Fremdbibliothek – es geht um sechs Grundformen und zwei
 * Attribute.
 */

/** Entfernt XML-Kommentare (Lizenzhinweise stehen oft vor dem Wurzelelement). */
function ohneKommentare(svgText) {
  return svgText.replace(/<!--[\s\S]*?-->/g, '')
}

/** Liest die Attribute eines Elements als Objekt. */
function attributeLesen(text) {
  const werte = {}
  for (const treffer of text.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
    werte[treffer[1]] = treffer[2]
  }
  return werte
}

const zahl = (wert, ersatz = 0) => {
  const n = Number.parseFloat(wert ?? '')
  return Number.isFinite(n) ? n : ersatz
}

/** Kreis als zwei Halbbögen – der Standardweg in SVG-Pfaden. */
function kreis(cx, cy, r) {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`
}

function ellipse(cx, cy, rx, ry) {
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`
}

function rechteck(x, y, breite, hoehe, rx, ry) {
  const ecken = rx > 0 ? rx : 0
  const eckenY = ry > 0 ? ry : ecken
  if (ecken === 0) {
    return `M ${x} ${y} H ${x + breite} V ${y + hoehe} H ${x} Z`
  }
  return [
    `M ${x + ecken} ${y}`,
    `H ${x + breite - ecken}`,
    `A ${ecken} ${eckenY} 0 0 1 ${x + breite} ${y + eckenY}`,
    `V ${y + hoehe - eckenY}`,
    `A ${ecken} ${eckenY} 0 0 1 ${x + breite - ecken} ${y + hoehe}`,
    `H ${x + ecken}`,
    `A ${ecken} ${eckenY} 0 0 1 ${x} ${y + hoehe - eckenY}`,
    `V ${y + eckenY}`,
    `A ${ecken} ${eckenY} 0 0 1 ${x + ecken} ${y}`,
    'Z',
  ].join(' ')
}

function punkteListe(punkte, schliessen) {
  const zahlen = (punkte ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(Number.isFinite)
  if (zahlen.length < 4) return ''
  const teile = [`M ${zahlen[0]} ${zahlen[1]}`]
  for (let i = 2; i + 1 < zahlen.length; i += 2) teile.push(`L ${zahlen[i]} ${zahlen[i + 1]}`)
  if (schliessen) teile.push('Z')
  return teile.join(' ')
}

/**
 * Liest Pfade, Zeichenart und Raster eines SVG.
 *
 * Rückgabe: `{ pfade, gefuellt, viewBox }`.
 *
 * Nicht umgesetzt sind `<text>`, `<image>` und Gruppentransformationen – diese
 * Formen kommen in Symbolsammlungen nicht vor.
 */
export function svgAnalysieren(svgText) {
  const text = ohneKommentare(svgText)
  const wurzel = attributeLesen(text.match(/<svg\b[^>]*>/)?.[0] ?? '')

  // Manche Sammlungen setzen `width="1em"` – dann trägt nur `viewBox` das Raster.
  const hatRaster = /[0-9.-]+\s+[0-9.-]+\s+[0-9.-]+\s+[0-9.-]+/.test(wurzel.viewBox ?? '')
  const viewBox = hatRaster ? wurzel.viewBox : `0 0 ${zahl(wurzel.width, 24)} ${zahl(wurzel.height, 24)}`

  // SVG-Vorgaben: Fläche schwarz, Strich aus. Fehlt ein Attribut an der Form,
  // gilt der Wert des Wurzelelements.
  const standardFuellung = wurzel.fill ?? 'black'
  const standardStrich = wurzel.stroke ?? 'none'

  const pfade = []
  let ersteFormGestrichen = null

  for (const treffer of text.matchAll(
    /<(path|circle|ellipse|rect|line|polyline|polygon)\b([^>]*)\/?>/g,
  )) {
    const art = treffer[1]
    const a = attributeLesen(treffer[2])

    /*
     * Unsichtbare Hilfsformen überspringen.
     *
     * Tabler und andere Sammlungen legen ein Rechteck über die ganze Fläche
     * (`d="M0 0h24v24H0z"`) und setzen darauf `fill="none" stroke="none"` – als
     * Klickfläche. Wer nur die Pfade einsammelt, zeichnet daraus einen Rahmen um
     * das ganze Symbol.
     */
    const fuellung = a.fill ?? standardFuellung
    const strich = a.stroke ?? standardStrich
    if (fuellung === 'none' && strich === 'none') continue

    let d = ''
    switch (art) {
      case 'path':
        d = a.d ?? ''
        break
      case 'circle':
        d = kreis(zahl(a.cx), zahl(a.cy), zahl(a.r))
        break
      case 'ellipse':
        d = ellipse(zahl(a.cx), zahl(a.cy), zahl(a.rx), zahl(a.ry))
        break
      case 'rect':
        d = rechteck(zahl(a.x), zahl(a.y), zahl(a.width), zahl(a.height), zahl(a.rx), zahl(a.ry))
        break
      case 'line':
        d = `M ${zahl(a.x1)} ${zahl(a.y1)} L ${zahl(a.x2)} ${zahl(a.y2)}`
        break
      case 'polyline':
        d = punkteListe(a.points, false)
        break
      case 'polygon':
        d = punkteListe(a.points, true)
        break
    }

    if (d.trim() === '') continue
    pfade.push(d)

    if (ersteFormGestrichen === null) {
      ersteFormGestrichen = strich !== 'none' && fuellung === 'none'
    }
  }

  return {
    pfade,
    // Die erste sichtbare Form bestimmt den Stil des ganzen Symbols.
    gefuellt: !(ersteFormGestrichen ?? false),
    viewBox,
  }
}
