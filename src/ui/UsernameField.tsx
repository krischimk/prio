import { input } from './styles'

export function UsernameField({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="block space-y-1 text-body text-ink-soft">
    <span>Benutzername</span>
    <input aria-label="Benutzername" value={value} onChange={event => onChange(event.target.value)} required minLength={3} maxLength={30}
      autoComplete="nickname" autoCapitalize="none" spellCheck={false} disabled={disabled} className={input} />
    <span className="block text-meta text-ink-muted">3–30 Zeichen: a–z, Ziffern und Unterstrich. Groß- und Kleinschreibung zählen gleich.</span>
  </label>
}
