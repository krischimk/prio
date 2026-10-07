import { useState, type ReactNode } from 'react'
import { BackLayerProvider } from '../../app/BackLayerProvider'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { IconButton } from '../components/IconButton'
import { Screen } from '../components/Screen'
import { Sheet } from '../components/Sheet'
import { CloseIcon, MenuIcon, PlusIcon, RepeatIcon, TrashIcon } from '../icons'
import { Markdown } from '../Markdown'
import { SectionHeader } from '../SectionHeader'
import {
  appBackground,
  attentionDot,
  attentionText,
  card,
  cardSoft,
  dangerText,
  emptyState,
  errorBox,
  errorMessage,
  input,
  link,
  mutedText,
  numberInput,
  statusTone,
  successBox,
  successMessage,
} from '../styles'

/**
 * Bauteilübersicht – nur im Entwicklungsbuild (`npm run dev`, dann `?kueche=1`).
 *
 * Warum es sie gibt (`DESIGN.md` §12): In einer echten Liste sieht man einen
 * Bauteil immer nur in **einem** Zustand. Unterschiede, die dort nicht
 * auffallen – zwei Grüntöne, drei Abstände für dieselbe Rolle, ein fehlender
 * Fokusring –, stehen hier nebeneinander und fallen sofort auf. Sie kostet eine
 * Route und spart einen Überhaul.
 *
 * Sie wird **vor** der Anmeldung gerendert und braucht weder Datenbank noch
 * Cloud: alle Bauteile bekommen ihre Werte direkt.
 */
export function Kitchen() {
  const [blatt, setBlatt] = useState(false)
  const [flaeche, setFlaeche] = useState(false)

  return (
    <BackLayerProvider>
      <div className={`min-h-screen ${appBackground} px-6 py-8 text-ink`} data-testid="kitchen">
        <h1 className="text-display font-semibold text-ink-strong">Bauteile</h1>
        <p className={`mt-1 text-body ${mutedText}`}>
          Alles, was die Oberfläche benutzt – in jeder Variante und in den Zuständen, die man in
          einer echten Liste nie nebeneinander sieht.
        </p>

        <Teil titel="Knöpfe">
          <Reihe>
            <Button variant="primary">primär</Button>
            <Button variant="secondary">sekundär</Button>
            <Button variant="ghost">ghost</Button>
            <Button variant="danger">Gefahr</Button>
            <Button variant="attention">Aufmerksamkeit</Button>
          </Reihe>
          <Reihe>
            <Button variant="primary" size="sm">
              primär klein
            </Button>
            <Button variant="secondary" size="sm">
              sekundär klein
            </Button>
            <Button variant="ghost" size="sm">
              ghost klein
            </Button>
            <Button variant="danger" size="sm">
              Gefahr klein
            </Button>
          </Reihe>
          <Reihe>
            <Button variant="secondary" size="block">
              Blockknopf
            </Button>
          </Reihe>
          <Reihe>
            <Button variant="primary" disabled>
              deaktiviert
            </Button>
            <Button variant="secondary" disabled>
              deaktiviert
            </Button>
            <Button variant="ghost" disabled>
              deaktiviert
            </Button>
          </Reihe>
          <Reihe>
            <p className={`mr-2 text-meta ${mutedText}`}>Symbolknöpfe:</p>
            <IconButton aria-label="Menü">
              <MenuIcon />
            </IconButton>
            <IconButton aria-label="Schließen">
              <CloseIcon />
            </IconButton>
            <IconButton aria-label="Löschen" variant="iconMuted">
              <TrashIcon />
            </IconButton>
            <IconButton aria-label="Aktiv" variant="iconActive">
              <RepeatIcon />
            </IconButton>
            <IconButton aria-label="Heller" variant="iconBright">
              <PlusIcon />
            </IconButton>
          </Reihe>
        </Teil>

        <Teil titel="Felder">
          <div className="max-w-md space-y-3">
            <Field id="k-titel" label="Titel">
              <input id="k-titel" className={input} defaultValue="Milch kaufen" />
            </Field>
            <Field id="k-hinweis" label="Mit Hinweis" hint="Der Hinweis steht unter dem Feld.">
              <input id="k-hinweis" className={input} placeholder="Platzhalter ist kein Label" />
            </Field>
            <Field id="k-zahl" label="Zahl (schmal)">
              <input id="k-zahl" className={numberInput} defaultValue="1440" />
            </Field>
            <Field id="k-auswahl" label="Auswahl">
              <select id="k-auswahl" className={input} defaultValue="taeglich">
                <option value="taeglich">täglich</option>
                <option value="woechentlich">wöchentlich</option>
              </select>
            </Field>
            <Field id="k-notiz" label="Mehrzeilig">
              <textarea id="k-notiz" className={input} rows={2} defaultValue="Zwei Zeilen." />
            </Field>
            <Field id="k-gesperrt" label="Deaktiviert">
              <input id="k-gesperrt" className={input} disabled defaultValue="gesperrt" />
            </Field>
          </div>
        </Teil>

        <Teil titel="Flächen">
          <div className="grid gap-3 md:grid-cols-2">
            <div className={card}>
              <p className="text-body text-ink">card – Panels und Dialoginhalte</p>
              <p className={`mt-1 text-meta ${mutedText}`}>Eine Fläche über dem Grund.</p>
            </div>
            <div className={`${cardSoft} flex items-start gap-3`}>
              <p className="text-body text-ink">cardSoft – Zeilen und Karten in Karten</p>
            </div>
            <p className={emptyState}>emptyState – hier steht noch nichts.</p>
            <div className={`${cardSoft} space-y-2`}>
              <p className="break-words text-body text-ink">
                Sehr langer Text, um den Umbruch zu sehen: Wäsche waschen, zusammenlegen, in den
                Schrank räumen, dabei die Hemden bügeln und die Socken sortieren.
              </p>
              <p className={`truncate text-meta ${mutedText}`}>
                Und dieselbe Zeile gekürzt: Wäsche waschen, zusammenlegen, in den Schrank räumen …
              </p>
            </div>
          </div>
        </Teil>

        <Teil titel="Schriftrollen">
          <p className="text-display text-ink-strong">display – 24 px</p>
          <p className="text-heading text-ink-strong">heading – 20 px</p>
          <p className="text-title text-ink">title – 16 px</p>
          <p className="text-body text-ink">body – 14 px, der Fließtext</p>
          <p className={`text-meta ${mutedText}`}>meta – 12 px, Metadaten und Hinweise</p>
          <p className={`text-label ${mutedText}`}>label – 11 px, kleinste Auszeichnung</p>
        </Teil>

        <Teil titel="Bedeutungsfarben">
          <Reihe>
            {(['ok', 'pending', 'error'] as const).map((ton) => (
              <span key={ton} className={`flex items-center gap-2 text-meta ${statusTone[ton].text}`}>
                <span className={`h-2 w-2 rounded-full ${statusTone[ton].dot}`} />
                {statusTone[ton].label}
              </span>
            ))}
          </Reihe>
          <Reihe>
            <span className={`text-meta ${dangerText}`}>überfällig</span>
            <span className={`flex items-center gap-1 text-meta ${attentionText}`}>
              <span className={`h-2 w-2 rounded-full ${attentionDot}`} />
              neue Fassung
            </span>
            <span className={`text-meta ${mutedText}`}>zurückgenommen</span>
            <a className={link} href="#kueche">
              Verweis
            </a>
          </Reihe>
          <Reihe>
            <p className={errorMessage}>Fehlermeldung unter einem Feld</p>
            <p className={successMessage}>Erfolgsmeldung unter einem Feld</p>
          </Reihe>
          <Reihe>
            <p className={errorBox}>Meldungsbox mit Fehler</p>
            <p className={successBox}>Meldungsbox mit Erfolg</p>
          </Reihe>
        </Teil>

        <Teil titel="Abschnittskopf und Markdown">
          <SectionHeader name="Obst" anzahl={3} offen onToggle={() => {}} />
          <div className={`${card} max-w-md`}>
            {/*
              Bewusst ohne Verweis: Der Umsetzer kennt Überschrift, Liste, fett
              und Code – mehr nicht (`markdown.ts`). Was er nicht kennt, bleibt
              stehen; das ist seine Absprache.
            */}
            <Markdown text={'## Fett und Code\n\n**Fett** und `Code`.\n\n- eins\n- zwei'} />
          </div>
        </Teil>

        <Teil titel="Dialoge">
          <Reihe>
            <Button variant="secondary" onClick={() => setBlatt(true)}>
              Blatt öffnen
            </Button>
            <Button variant="secondary" onClick={() => setFlaeche(true)}>
              Fläche öffnen
            </Button>
          </Reihe>

          {blatt ? (
            <Sheet
              label="Beispiel-Blatt"
              title="Beispiel-Blatt"
              subtitle="Blatt von unten, breit mittig"
              onClose={() => setBlatt(false)}
              footer={
                <Button variant="ghost" layout="w-full" onClick={() => setBlatt(false)}>
                  Schließen
                </Button>
              }
            >
              <p className="px-4 py-4 text-body text-ink">
                Escape und die Zurück-Taste schließen, der Fokus bleibt im Dialog.
              </p>
            </Sheet>
          ) : null}

          {flaeche ? (
            <Screen
              label="Beispiel-Fläche"
              onClose={() => setFlaeche(false)}
              header={
                <header className="safe-top flex min-h-16 shrink-0 items-center gap-2 border-b border-line px-2 py-1">
                  <IconButton aria-label="Schließen" onClick={() => setFlaeche(false)}>
                    <CloseIcon />
                  </IconButton>
                  <h2 className="min-w-0 flex-1 truncate text-title font-medium text-ink">
                    Beispiel-Fläche
                  </h2>
                </header>
              }
            >
              <p className="px-4 py-4 text-body text-ink">
                Eine ganze Fläche als Dialog – die Form der Aufgaben-Detailansicht.
              </p>
            </Screen>
          ) : null}
        </Teil>
      </div>
    </BackLayerProvider>
  )
}

/** Ein Abschnitt der Übersicht. */
function Teil({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="mt-8 border-t border-line pt-4">
      <h2 className="mb-3 text-meta font-semibold uppercase tracking-wide text-ink-faint">{titel}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

/** Eine Zeile mit Bauteilen nebeneinander. */
function Reihe({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}
