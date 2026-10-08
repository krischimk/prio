import { useState } from 'react'

/**
 * Die Felder für einen eigenen Vorlauf: Tage, Stunden, Minuten und Richtung.
 *
 * Der Wert bleibt eine **einzige** Minutenzahl (negativ heißt „nachher"); die
 * drei Felder sind nur ihre Anzeige. Deshalb rechnet jede Änderung alle drei
 * neu – sonst liefen Anzeige und gespeicherter Wert auseinander.
 */
export function useCustomOffset({
  value,
  onChange,
}: {
  value: number
  onChange: (minutes: number) => void
}) {
  const nachher = value < 0
  const betrag = Math.abs(value)
  const tage = Math.floor(betrag / 1440)
  const stunden = Math.floor((betrag % 1440) / 60)
  const minuten = betrag % 60

  const [richtung, setRichtung] = useState<'vorher' | 'nachher'>(nachher ? 'nachher' : 'vorher')
  const [felder, setFelder] = useState({ tage, stunden, minuten })

  const setzen = (teil: Partial<typeof felder>, neueRichtung = richtung) => {
    const neu = { ...felder, ...teil }
    setFelder(neu)
    const gesamt = neu.tage * 1440 + neu.stunden * 60 + neu.minuten
    onChange(neueRichtung === 'nachher' ? -gesamt : gesamt)
  }

  const richtungWechseln = (neu: 'vorher' | 'nachher') => {
    setRichtung(neu)
    setzen({}, neu)
  }

  return { richtung, richtungWechseln, felder, setzen }
}
