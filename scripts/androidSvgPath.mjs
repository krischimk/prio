/** SVG erlaubt zusammengezogene Bogen-Flags; Android benötigt einzelne Zahlen. */
export function androidSvgPath(path) {
  const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }
  const tokens = []; let offset = 0; let command = ''; let count = 0
  const finish = () => { if (command && (arity[command.toUpperCase()] ? !count || count % arity[command.toUpperCase()] : count)) throw new Error(`Unvollständiger SVG-Pfad: ${path}`) }
  while (offset < path.length) {
    if (/[\s,]/.test(path[offset])) { offset++; continue }
    const next = path[offset]
    if (Object.hasOwn(arity, next.toUpperCase())) {
      finish(); command = next; count = 0; tokens.push(next); offset++; continue
    }
    if (!command || !arity[command.toUpperCase()]) throw new Error(`Ungültiger SVG-Pfad: ${path}`)
    const flag = command.toUpperCase() === 'A' && [3, 4].includes(count % 7)
    const number = (flag ? /^[01]/ : /^[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/).exec(path.slice(offset))?.[0]
    if (!number || !Number.isFinite(Number(number))) throw new Error(`Ungültige SVG-Zahl: ${path.slice(offset)}`)
    tokens.push(number); offset += number.length; count++
  }
  finish(); return tokens.join(' ')
}
