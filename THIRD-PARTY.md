# Fremde Inhalte

Die Listensymbole stammen zum größeren Teil aus fremden Sammlungen. Alle
verwendeten stehen unter **MIT, ISC oder Apache-2.0** – Lizenzen, die nur den
Lizenztext verlangen, **keine sichtbare Namensnennung** in der App.

Die Auswahl und die Zuordnung stehen in `scripts/generate-list-icons.mjs`. Die
Symbole werden einmalig erzeugt (`npm run icons:generate`) und liegen als
`src/ui/listIconsMdi.ts` im Repository – zur Laufzeit kennt die App also keine
Fremdquelle.

## Verwendete Sammlungen

| Sammlung | Paket | Lizenz | Verwendet für |
| --- | --- | --- | --- |
| Material Design Icons (Pictogrammers) | `@mdi/svg` | Apache-2.0 | die meisten Symbole |
| Lucide | `lucide-static` | ISC | Schach, Pflanzen, Garten, Fels, Putzen, Senden |
| Tabler Icons | `@tabler/icons` | MIT | Nähen |

Die vollständigen Lizenztexte liegen in den jeweiligen Paketen unter `LICENSE`
und sind abrufbar unter:

* Apache-2.0 – <https://www.apache.org/licenses/LICENSE-2.0>
* ISC – <https://opensource.org/license/isc-license-txt>
* MIT – <https://opensource.org/license/mit>

## Bewusst nicht verwendet

* **Font Awesome** – Symbole unter **CC BY 4.0**. Diese Lizenz verlangt eine
  sichtbare Namensnennung in der App.
* **guidance/climbing-wall** (Streamline) – ebenfalls CC BY 4.0. Stattdessen
  wird für „Klettern" der Karabiner aus Material Design Icons verwendet.
