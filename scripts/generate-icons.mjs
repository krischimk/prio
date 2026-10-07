/**
 * Erzeugt die App-Icons als PNG: für die PWA **und** für die Android-App.
 *
 * Beide aus einer Quelle, damit das Symbol überall dasselbe ist. Die Android-
 * Ausgaben landen direkt in `android/app/src/main/res/`: die klassischen
 * Kacheln (je Bildschirmdichte), die runden Varianten und der Vordergrund des
 * adaptiven Symbols. Den Hintergrund des adaptiven Symbols setzt
 * `values/ic_launcher_background.xml` (schwarz).
 *
 * Bewusst ohne Bildbibliothek: Ein PNG besteht nur aus wenigen Chunks, und
 * Node bringt die nötige Komprimierung (zlib) mit. Dadurch bleibt die
 * Abhängigkeitsliste kurz – und die Icons sind jederzeit reproduzierbar.
 *
 * Aufruf: npm run icons
 *
 * Das Motiv zeigt drei abnehmende Balken – eine priorisierte Liste.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'icons')
const ANDROID_RES = join(ROOT, 'android', 'app', 'src', 'main', 'res')

/**
 * Android-Bildschirmdichten.
 *
 * `kachel` ist die Größe des klassischen Symbols, `adaptiv` die des
 * Vordergrunds im adaptiven Symbol (108dp-Raster, die sichtbare Fläche ist
 * kleiner – das Motiv liegt von sich aus in der sicheren Zone).
 */
const DICHTEN = [
  { ordner: 'mipmap-mdpi', kachel: 48, adaptiv: 108 },
  { ordner: 'mipmap-hdpi', kachel: 72, adaptiv: 162 },
  { ordner: 'mipmap-xhdpi', kachel: 96, adaptiv: 216 },
  { ordner: 'mipmap-xxhdpi', kachel: 144, adaptiv: 324 },
  { ordner: 'mipmap-xxxhdpi', kachel: 192, adaptiv: 432 },
]

const BACKGROUND = [0x00, 0x00, 0x00, 0xff]
const BAR_COLORS = [
  [0xf5, 0xf5, 0xf5, 0xff],
  [0xa5, 0xb4, 0xfc, 0xff],
  [0x63, 0x66, 0xf1, 0xff],
]
const BAR_WIDTH_FACTORS = [1, 0.72, 0.46]

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // Bittiefe
  header[9] = 6 // Farbtyp RGBA
  const raw = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (1 + size * 4)
    raw[rowStart] = 0 // Filtertyp "None"
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function createCanvas(size, background) {
  const pixels = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i += 1) {
    pixels.set(background, i * 4)
  }
  return pixels
}

function fillRoundRect(pixels, size, rect) {
  const { x, y, width, height, radius, color } = rect
  const x1 = x + width
  const y1 = y + height
  for (let py = Math.max(0, Math.floor(y)); py < Math.min(size, Math.ceil(y1)); py += 1) {
    for (let px = Math.max(0, Math.floor(x)); px < Math.min(size, Math.ceil(x1)); px += 1) {
      const dx = Math.max(x + radius - px, 0, px - (x1 - radius))
      const dy = Math.max(y + radius - py, 0, py - (y1 - radius))
      if (dx * dx + dy * dy <= radius * radius) {
        pixels.set(color, (py * size + px) * 4)
      }
    }
  }
}

/** Zeichnet das Motiv mittig; `markScale` verkleinert es für maskierbare Icons. */
function drawMark(pixels, size, markScale) {
  const barHeight = size * 0.11 * markScale
  const gap = size * 0.075 * markScale
  const radius = barHeight / 2
  const available = size * 0.56 * markScale
  const totalHeight = barHeight * 3 + gap * 2
  const startY = (size - totalHeight) / 2
  const startX = (size - available) / 2

  BAR_COLORS.forEach((color, index) => {
    fillRoundRect(pixels, size, {
      x: startX,
      y: startY + index * (barHeight + gap),
      width: available * BAR_WIDTH_FACTORS[index],
      height: barHeight,
      radius,
      color,
    })
  })
}

function fillCircle(pixels, size, color) {
  const radius = size / 2
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const dx = px + 0.5 - radius
      const dy = py + 0.5 - radius
      if (dx * dx + dy * dy <= radius * radius) {
        pixels.set(color, (py * size + px) * 4)
      }
    }
  }
}

function writePng(file, size, pixels) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, encodePng(size, pixels))
  console.log(`geschrieben: ${file} (${size}×${size})`)
}

function writeIcon(fileName, size, markScale) {
  const pixels = createCanvas(size, BACKGROUND)
  drawMark(pixels, size, markScale)
  writePng(join(OUT_DIR, fileName), size, pixels)
}

/** Die Symbole der Android-App: Kachel, runde Kachel und adaptiver Vordergrund. */
function writeAndroidIcons() {
  for (const { ordner, kachel, adaptiv } of DICHTEN) {
    const ziel = join(ANDROID_RES, ordner)

    // Klassische Kachel: abgerundetes Quadrat, damit sie auch dort sitzt, wo
    // das System keine Form darüberlegt.
    const quadrat = createCanvas(kachel, [0, 0, 0, 0])
    fillRoundRect(quadrat, kachel, {
      x: 0,
      y: 0,
      width: kachel,
      height: kachel,
      radius: kachel * 0.22,
      color: BACKGROUND,
    })
    drawMark(quadrat, kachel, 1)
    writePng(join(ziel, 'ic_launcher.png'), kachel, quadrat)

    const rund = createCanvas(kachel, [0, 0, 0, 0])
    fillCircle(rund, kachel, BACKGROUND)
    drawMark(rund, kachel, 1)
    writePng(join(ziel, 'ic_launcher_round.png'), kachel, rund)

    // Adaptiver Vordergrund: ohne Hintergrund, das System legt seine Form
    // darüber. Das Motiv bleibt in der sicheren Zone.
    const vordergrund = createCanvas(adaptiv, [0, 0, 0, 0])
    drawMark(vordergrund, adaptiv, 1)
    writePng(join(ziel, 'ic_launcher_foreground.png'), adaptiv, vordergrund)
  }
}

mkdirSync(OUT_DIR, { recursive: true })
writeIcon('icon-192.png', 192, 1)
writeIcon('icon-512.png', 512, 1)
// Maskierbare Icons werden vom System beschnitten – das Motiv bleibt daher
// kleiner und vollständig innerhalb der sicheren Zone.
writeIcon('icon-maskable-512.png', 512, 0.62)
writeIcon('apple-touch-icon.png', 180, 1)
writeAndroidIcons()
