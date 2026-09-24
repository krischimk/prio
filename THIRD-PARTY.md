# Fremde Inhalte

## Material Design Icons (Pictogrammers)

Ein Teil der Listensymbole stammt aus **Material Design Icons**, gepflegt von
[Pictogrammers](https://pictogrammers.com/).

* Quelle: <https://github.com/Templarian/MaterialDesign> (npm: `@mdi/svg`)
* Lizenz: **Apache License 2.0**

Die Symbole liegen als erzeugte Datei in `src/ui/listIconsMdi.ts`; erzeugt
werden sie mit `npm run icons:generate` aus `scripts/generate-mdi-icons.mjs`.
Zur Laufzeit kennt die App keine Fremdquelle – sie liest nur die erzeugten
Pfade. Welche Symbole verwendet werden und unter welchem MDI-Namen, steht im
genannten Skript.

### Lizenztext (Apache License 2.0)

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

Der vollständige Lizenztext liegt im Paket `@mdi/svg` unter `LICENSE` und unter
<https://www.apache.org/licenses/LICENSE-2.0>.

## Nicht verwendete Sammlungen

**Font Awesome** wurde bewusst **nicht** aufgenommen: Die Symbole stehen unter
CC BY 4.0 und verlangen eine sichtbare Namensnennung in der App.
