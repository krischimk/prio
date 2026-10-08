import { Button } from './components/Button'
import { appBackground, errorMessage } from './styles'

/**
 * Wenn die lokale Datenbank nicht geöffnet werden kann.
 *
 * Vorher blieb in diesem Fall die Ladeanzeige stehen – für immer. Ein Fehler,
 * der nicht als Fehler erscheint, ist der schlimmste Zustand: Man wartet auf
 * etwas, das nie kommt. Der Fehlerzustand ist einer der vier, die jeder
 * Bildschirm haben soll (`DESIGN.md` P34); dieser hier stand als einziger
 * nirgends.
 *
 * Der Text sagt, was zu tun ist, nicht was schiefging (P37).
 */
export function WorkspaceError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center ${appBackground}`}
    >
      <p className={errorMessage} role="alert">
        Die lokalen Daten ließen sich nicht öffnen. Bitte versuch es noch einmal.
      </p>
      <Button variant="primary" onClick={onRetry}>
        Erneut versuchen
      </Button>
    </div>
  )
}
