import type { ListIconDefinition } from './listIcons'

/**
 * Listensymbole aus Material Design Icons (Pictogrammers).
 *
 * **Erzeugte Datei – nicht von Hand bearbeiten.** Quelle ist
 * `scripts/generate-mdi-icons.mjs` (npm run icons:generate). Die Lizenz
 * (Apache-2.0) liegt in THIRD-PARTY.md.
 *
 * Warum überhaupt fremde Symbole: Motive wie Bagger, Schachfigur oder Violine
 * werden von Hand auf 24 Pixeln zu Klecksen. Hier kommen sie in
 * gleichbleibender Qualität – und weil das Ergebnis im Repository liegt, kennt
 * die App zur Laufzeit keine Fremdquelle.
 *
 * Diese Symbole werden gefüllt gezeichnet, die handgezeichneten gestrichen.
 */
export const LIST_ICONS_MDI: ListIconDefinition[] = [
  {
    id: 'std:suitcase',
    label: 'Koffer',
    source: 'bag-suitcase-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M9.5 18V9H8V18M12.75 18V9H11.25V18M16 18V9H14.5V18M17.03 6C18.11 6 19 6.88 19 8V19C19 20.13 18.11 21 17.03 21C17.03 21.58 16.56 22 16 22C15.5 22 15 21.58 15 21H9C9 21.58 8.5 22 8 22C7.44 22 6.97 21.58 6.97 21C5.89 21 5 20.13 5 19V8C5 6.88 5.89 6 6.97 6H9V3C9 2.42 9.46 2 10 2H14C14.54 2 15 2.42 15 3V6M10.5 3.5V6H13.5V3.5M17.03 19V8H6.97V19',
    ],
  },
  {
    id: 'std:computer',
    label: 'Computer',
    source: 'monitor',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z',
    ],
  },
  {
    id: 'std:graduation',
    label: 'Studium',
    source: 'school-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L21 10.09V17H23V9L12 3M18.82 9L12 12.72L5.18 9L12 5.28L18.82 9M17 16L12 18.72L7 16V12.27L12 15L17 12.27V16Z',
    ],
  },
  {
    id: 'std:gift',
    label: 'Geschenk',
    source: 'gift-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M22,12V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V12A1,1 0 0,1 1,11V8A2,2 0 0,1 3,6H6.17C6.06,5.69 6,5.35 6,5A3,3 0 0,1 9,2C10,2 10.88,2.5 11.43,3.24V3.23L12,4L12.57,3.23V3.24C13.12,2.5 14,2 15,2A3,3 0 0,1 18,5C18,5.35 17.94,5.69 17.83,6H21A2,2 0 0,1 23,8V11A1,1 0 0,1 22,12M4,20H11V12H4V20M20,20V12H13V20H20M9,4A1,1 0 0,0 8,5A1,1 0 0,0 9,6A1,1 0 0,0 10,5A1,1 0 0,0 9,4M15,4A1,1 0 0,0 14,5A1,1 0 0,0 15,6A1,1 0 0,0 16,5A1,1 0 0,0 15,4M3,8V10H11V8H3M13,8V10H21V8H13Z',
    ],
  },
  {
    id: 'std:code',
    label: 'Programmieren',
    source: 'code-tags',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6Z',
    ],
  },
  {
    id: 'std:terminal',
    label: 'Konsole',
    source: 'console',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M20,19V7H4V19H20M20,3A2,2 0 0,1 22,5V19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5C2,3.89 2.9,3 4,3H20M13,17V15H18V17H13M9.58,13L5.57,9H8.4L11.7,12.3C12.09,12.69 12.09,13.33 11.7,13.72L8.42,17H5.59L9.58,13Z',
    ],
  },
  {
    id: 'std:tools',
    label: 'Werkzeug',
    source: 'wrench-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M22.61,19L13.53,9.91C14.46,7.57 14,4.81 12.09,2.91C9.79,0.61 6.21,0.4 3.66,2.26L7.5,6.11L6.08,7.5L2.25,3.69C0.39,6.23 0.6,9.82 2.9,12.11C4.76,13.97 7.47,14.46 9.79,13.59L18.9,22.7C19.29,23.09 19.92,23.09 20.31,22.7L22.61,20.4C23,20 23,19.39 22.61,19M19.61,20.59L10.15,11.13C9.54,11.58 8.86,11.85 8.15,11.95C6.79,12.15 5.36,11.74 4.32,10.7C3.37,9.76 2.93,8.5 3,7.26L6.09,10.35L10.33,6.11L7.24,3C8.5,2.95 9.73,3.39 10.68,4.33C11.76,5.41 12.17,6.9 11.92,8.29C11.8,9 11.5,9.66 11.04,10.25L20.5,19.7L19.61,20.59Z',
    ],
  },
  {
    id: 'std:pencil',
    label: 'Stift',
    source: 'pencil-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z',
    ],
  },
  {
    id: 'std:search',
    label: 'Suche',
    source: 'magnify',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z',
    ],
  },
  {
    id: 'std:medical',
    label: 'Gesundheit',
    source: 'hospital-box-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M18 14H14V18H10V14H6V10H10V6H14V10H18M20 2H4C2.9 2 2 2.9 2 4V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V4C22 2.9 21.1 2 20 2M20 20H4V4H20V20Z',
    ],
  },
  {
    id: 'std:refresh',
    label: 'Wiederholen',
    source: 'reload',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M2 12C2 16.97 6.03 21 11 21C13.39 21 15.68 20.06 17.4 18.4L15.9 16.9C14.63 18.25 12.86 19 11 19C4.76 19 1.64 11.46 6.05 7.05C10.46 2.64 18 5.77 18 12H15L19 16H19.1L23 12H20C20 7.03 15.97 3 11 3C6.03 3 2 7.03 2 12Z',
    ],
  },
  {
    id: 'std:shovel',
    label: 'Garten',
    source: 'shovel',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M15.1,1.81L12.27,4.64C11.5,5.42 11.5,6.69 12.27,7.47L13.68,8.88L9.13,13.43L6.31,10.6L4.89,12C-0.06,17 3.5,20.5 3.5,20.5C3.5,20.5 7,24 12,19.09L13.41,17.68L10.61,14.88L15.15,10.34L16.54,11.73C17.32,12.5 18.59,12.5 19.37,11.73L22.2,8.9L15.1,1.81M17.93,10.28L16.55,8.9L15.11,7.46L13.71,6.06L15.12,4.65L19.35,8.88L17.93,10.28Z',
    ],
  },
  {
    id: 'std:server',
    label: 'Server',
    source: 'server',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M4,1H20A1,1 0 0,1 21,2V6A1,1 0 0,1 20,7H4A1,1 0 0,1 3,6V2A1,1 0 0,1 4,1M4,9H20A1,1 0 0,1 21,10V14A1,1 0 0,1 20,15H4A1,1 0 0,1 3,14V10A1,1 0 0,1 4,9M4,17H20A1,1 0 0,1 21,18V22A1,1 0 0,1 20,23H4A1,1 0 0,1 3,22V18A1,1 0 0,1 4,17M9,5H10V3H9V5M9,13H10V11H9V13M9,21H10V19H9V21M5,3V5H7V3H5M5,11V13H7V11H5M5,19V21H7V19H5Z',
    ],
  },
  {
    id: 'std:notebook',
    label: 'Notizbuch',
    source: 'notebook-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M17,4V10L15,8L13,10V4H9V20H19V4H17M3,7V5H5V4C5,2.89 5.9,2 7,2H19C20.05,2 21,2.95 21,4V20C21,21.05 20.05,22 19,22H7C5.95,22 5,21.05 5,20V19H3V17H5V13H3V11H5V7H3M5,5V7H7V5H5M5,19H7V17H5V19M5,13H7V11H5V13Z',
    ],
  },
  {
    id: 'std:send',
    label: 'Senden',
    source: 'send-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M4 6.03L11.5 9.25L4 8.25L4 6.03M11.5 14.75L4 17.97V15.75L11.5 14.75M2 3L2 10L17 12L2 14L2 21L23 12L2 3Z',
    ],
  },
  {
    id: 'std:car',
    label: 'Auto',
    source: 'car-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M18.9 6C18.7 5.4 18.1 5 17.5 5H6.5C5.8 5 5.3 5.4 5.1 6L3 12V20C3 20.5 3.5 21 4 21H5C5.6 21 6 20.5 6 20V19H18V20C18 20.5 18.5 21 19 21H20C20.5 21 21 20.5 21 20V12L18.9 6M6.8 7H17.1L18.2 10H5.8L6.8 7M19 17H5V12H19V17M7.5 13C8.3 13 9 13.7 9 14.5S8.3 16 7.5 16 6 15.3 6 14.5 6.7 13 7.5 13M16.5 13C17.3 13 18 13.7 18 14.5S17.3 16 16.5 16C15.7 16 15 15.3 15 14.5S15.7 13 16.5 13Z',
    ],
  },
  {
    id: 'std:cleaning',
    label: 'Putzen',
    source: 'spray-bottle',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M16.72 10.43C14.68 8.39 14.5 4.66 14.5 4H13V6H9V4H7C7 2.9 7.9 2 9 2H16V3C16 3.08 16.04 7.63 17.78 9.37L16.72 10.43M17 2V4H18V2H17M15 12C13 10 13 7 13 7H9V9C9 10 9 10 8 11S7 13 7 13V20C7 21.1 7.9 22 9 22H13C14.1 22 15 21.1 15 20V12Z',
    ],
  },
  {
    id: 'std:strings',
    label: 'Streichinstrument',
    source: 'violin',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M11,2A1,1 0 0,0 10,3V5L10,9A0.5,0.5 0 0,0 10.5,9.5H12A0.5,0.5 0 0,1 12.5,10A0.5,0.5 0 0,1 12,10.5H10.5C9.73,10.5 9,9.77 9,9V5.16C7.27,5.6 6,7.13 6,9V10.5A2.5,2.5 0 0,1 8.5,13A2.5,2.5 0 0,1 6,15.5V17C6,19.77 8.23,22 11,22H13C15.77,22 18,19.77 18,17V15.5A2.5,2.5 0 0,1 15.5,13A2.5,2.5 0 0,1 18,10.5V9C18,6.78 16.22,5 14,5V3A1,1 0 0,0 13,2H11M10.75,16.5H13.25L12.75,20H11.25L10.75,16.5Z',
    ],
  },
  {
    id: 'std:piano',
    label: 'Klavier',
    source: 'piano',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M20 2H4C2.9 2 2 2.9 2 4V20C2 21.11 2.9 22 4 22H20C21.11 22 22 21.11 22 20V4C22 2.9 21.11 2 20 2M14.74 14H15V20H9V14H9.31C9.86 14 10.3 13.56 10.3 13V4H13.75V13C13.75 13.56 14.19 14 14.74 14M4 4H6.8V13C6.8 13.56 7.24 14 7.79 14H8V20H4V4M20 20H16V14H16.26C16.81 14 17.25 13.56 17.25 13V4H20V20Z',
    ],
  },
  {
    id: 'std:needle',
    label: 'Nähen',
    source: 'needle',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M11.15,15.18L9.73,13.77L11.15,12.35L12.56,13.77L13.97,12.35L12.56,10.94L13.97,9.53L15.39,10.94L16.8,9.53L13.97,6.7L6.9,13.77L9.73,16.6L11.15,15.18M3.08,19L6.2,15.89L4.08,13.77L13.97,3.87L16.1,6L17.5,4.58L16.1,3.16L17.5,1.75L21.75,6L20.34,7.4L18.92,6L17.5,7.4L19.63,9.53L9.73,19.42L7.61,17.3L3.08,21.84V19Z',
    ],
  },
  {
    id: 'std:hanger',
    label: 'Kleidung',
    source: 'hanger',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M12 4A3.5 3.5 0 0 0 8.5 7.5H10.5A1.5 1.5 0 0 1 12 6A1.5 1.5 0 0 1 13.5 7.5A1.5 1.5 0 0 1 12 9C11.45 9 11 9.45 11 10V11.75L2.4 18.2A1 1 0 0 0 3 20H21A1 1 0 0 0 21.6 18.2L13 11.75V10.85A3.5 3.5 0 0 0 15.5 7.5A3.5 3.5 0 0 0 12 4M12 13.5L18 18H6Z',
    ],
  },
  {
    id: 'std:money',
    label: 'Finanzen',
    source: 'cash',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M3,6H21V18H3V6M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M7,8A2,2 0 0,1 5,10V14A2,2 0 0,1 7,16H17A2,2 0 0,1 19,14V10A2,2 0 0,1 17,8H7Z',
    ],
  },
  {
    id: 'std:megaphone',
    label: 'Ankündigung',
    source: 'bullhorn-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M12,8H4A2,2 0 0,0 2,10V14A2,2 0 0,0 4,16H5V20A1,1 0 0,0 6,21H8A1,1 0 0,0 9,20V16H12L17,20V4L12,8M15,15.6L13,14H4V10H13L15,8.4V15.6M21.5,12C21.5,13.71 20.54,15.26 19,16V8C20.53,8.75 21.5,10.3 21.5,12Z',
    ],
  },
  {
    id: 'std:chess',
    label: 'Schach',
    source: 'chess-knight',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M19,22H5V20H19V22M13,2V2C11.75,2 10.58,2.62 9.89,3.66L7,8L9,10L11.06,8.63C11.5,8.32 12.14,8.44 12.45,8.9C12.47,8.93 12.5,8.96 12.5,9V9C12.8,9.59 12.69,10.3 12.22,10.77L7.42,15.57C6.87,16.13 6.87,17.03 7.43,17.58C7.69,17.84 8.05,18 8.42,18H17V6A4,4 0 0,0 13,2Z',
    ],
  },
  {
    id: 'std:sailing',
    label: 'Segeln',
    source: 'sail-boat',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M3 13.5L11 2.03V13.5H3M12.5 13.5C13.85 9.75 13.67 4.71 12.5 1C17.26 2.54 20.9 8.4 20.96 13.5H12.5M21.1 17.08C20.69 17.72 20.21 18.27 19.65 18.74C19 18.45 18.42 18 17.96 17.5C16.47 19.43 13.46 19.43 11.97 17.5C10.5 19.43 7.47 19.43 6 17.5C5.5 18 4.95 18.45 4.3 18.74C3.16 17.8 2.3 16.46 2 15H21.94C21.78 15.75 21.5 16.44 21.1 17.08M20.96 23C19.9 23 18.9 22.75 17.96 22.25C16.12 23.25 13.81 23.25 11.97 22.25C10.13 23.25 7.82 23.25 6 22.25C4.77 22.94 3.36 23.05 2 23V21C3.41 21.05 4.77 20.9 6 20C7.74 21.25 10.21 21.25 11.97 20C13.74 21.25 16.2 21.25 17.96 20C19.17 20.9 20.54 21.05 21.94 21V23H20.96Z',
    ],
  },
  {
    id: 'std:translate',
    label: 'Sprache',
    source: 'translate',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M12.87,15.07L10.33,12.56L10.36,12.53C12.1,10.59 13.34,8.36 14.07,6H17V4H10V2H8V4H1V6H12.17C11.5,7.92 10.44,9.75 9,11.35C8.07,10.32 7.3,9.19 6.69,8H4.69C5.42,9.63 6.42,11.17 7.67,12.56L2.58,17.58L4,19L9,14L12.11,17.11L12.87,15.07M18.5,10H16.5L12,22H14L15.12,19H19.87L21,22H23L18.5,10M15.88,17L17.5,12.67L19.12,17H15.88Z',
    ],
  },
  {
    id: 'std:graph',
    label: 'Graph',
    source: 'graph-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M19.5 17C19.36 17 19.24 17 19.11 17.04L17.5 13.8C17.95 13.35 18.25 12.71 18.25 12C18.25 10.62 17.13 9.5 15.75 9.5C15.61 9.5 15.5 9.5 15.35 9.54L13.74 6.3C14.21 5.84 14.5 5.21 14.5 4.5C14.5 3.12 13.38 2 12 2S9.5 3.12 9.5 4.5C9.5 5.2 9.79 5.84 10.26 6.29L8.65 9.54C8.5 9.5 8.39 9.5 8.25 9.5C6.87 9.5 5.75 10.62 5.75 12C5.75 12.71 6.04 13.34 6.5 13.79L4.89 17.04C4.76 17 4.64 17 4.5 17C3.12 17 2 18.12 2 19.5C2 20.88 3.12 22 4.5 22S7 20.88 7 19.5C7 18.8 6.71 18.16 6.24 17.71L7.86 14.46C8 14.5 8.12 14.5 8.25 14.5C8.38 14.5 8.5 14.5 8.63 14.46L10.26 17.71C9.79 18.16 9.5 18.8 9.5 19.5C9.5 20.88 10.62 22 12 22S14.5 20.88 14.5 19.5C14.5 18.12 13.38 17 12 17C11.87 17 11.74 17 11.61 17.04L10 13.8C10.45 13.35 10.75 12.71 10.75 12C10.75 11.3 10.46 10.67 10 10.21L11.61 6.96C11.74 7 11.87 7 12 7C12.13 7 12.26 7 12.39 6.96L14 10.21C13.54 10.66 13.25 11.3 13.25 12C13.25 13.38 14.37 14.5 15.75 14.5C15.88 14.5 16 14.5 16.13 14.46L17.76 17.71C17.29 18.16 17 18.8 17 19.5C17 20.88 18.12 22 19.5 22S22 20.88 22 19.5C22 18.12 20.88 17 19.5 17M4.5 20.5C3.95 20.5 3.5 20.05 3.5 19.5S3.95 18.5 4.5 18.5 5.5 18.95 5.5 19.5 5.05 20.5 4.5 20.5M13 19.5C13 20.05 12.55 20.5 12 20.5S11 20.05 11 19.5 11.45 18.5 12 18.5 13 18.95 13 19.5M7.25 12C7.25 11.45 7.7 11 8.25 11S9.25 11.45 9.25 12 8.8 13 8.25 13 7.25 12.55 7.25 12M11 4.5C11 3.95 11.45 3.5 12 3.5S13 3.95 13 4.5 12.55 5.5 12 5.5 11 5.05 11 4.5M14.75 12C14.75 11.45 15.2 11 15.75 11S16.75 11.45 16.75 12 16.3 13 15.75 13 14.75 12.55 14.75 12M19.5 20.5C18.95 20.5 18.5 20.05 18.5 19.5S18.95 18.5 19.5 18.5 20.5 18.95 20.5 19.5 20.05 20.5 19.5 20.5Z',
    ],
  },
  {
    id: 'std:excavator',
    label: 'Bagger',
    source: 'excavator',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M18.5 18.5C19.04 18.5 19.5 18.96 19.5 19.5S19.04 20.5 18.5 20.5H6.5C5.96 20.5 5.5 20.04 5.5 19.5S5.96 18.5 6.5 18.5H18.5M18.5 17H6.5C5.13 17 4 18.13 4 19.5S5.13 22 6.5 22H18.5C19.88 22 21 20.88 21 19.5S19.88 17 18.5 17M21 11H18V7H13L10 11V16H22L21 11M11.54 11L13.5 8.5H16V11H11.54M9.76 3.41L4.76 2L2 11.83C1.66 13.11 2.41 14.44 3.7 14.8L4.86 15.12L8.15 12.29L4.27 11.21L6.15 4.46L8.94 5.24C9.5 5.53 10.71 6.34 11.47 7.37L12.5 6H12.94C11.68 4.41 9.85 3.46 9.76 3.41Z',
    ],
  },
  {
    id: 'std:math',
    label: 'Mathematik',
    source: 'calculator-variant-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 19H5V5H19V19M6.2 7.7H11.2V9.2H6.2V7.7M13 15.8H18V17.3H13V15.8M13 13.2H18V14.7H13V13.2M8 18H9.5V16H11.5V14.5H9.5V12.5H8V14.5H6V16H8V18M14.1 10.9L15.5 9.5L16.9 10.9L18 9.9L16.6 8.5L18 7.1L16.9 6L15.5 7.4L14.1 6L13 7.1L14.4 8.5L13 9.9L14.1 10.9Z',
    ],
  },
  {
    id: 'std:chef',
    label: 'Kochen',
    source: 'chef-hat',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M12.5,1.5C10.73,1.5 9.17,2.67 8.67,4.37C8.14,4.13 7.58,4 7,4A4,4 0 0,0 3,8C3,9.82 4.24,11.41 6,11.87V19H19V11.87C20.76,11.41 22,9.82 22,8A4,4 0 0,0 18,4C17.42,4 16.86,4.13 16.33,4.37C15.83,2.67 14.27,1.5 12.5,1.5M12,10.5H13V17.5H12V10.5M9,12.5H10V17.5H9V12.5M15,12.5H16V17.5H15V12.5M6,20V21A1,1 0 0,0 7,22H18A1,1 0 0,0 19,21V20H6Z',
    ],
  },
  {
    id: 'std:tree',
    label: 'Baum',
    source: 'file-tree-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M12 13H7V18H12V20H5V10H7V11H12V13M8 4V6H4V4H8M10 2H2V8H10V2M20 11V13H16V11H20M22 9H14V15H22V9M20 18V20H16V18H20M22 16H14V22H22V16Z',
    ],
  },
  {
    id: 'std:hammer-sickle',
    label: 'Hammer und Sichel',
    source: 'hammer-sickle',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M22 20.59L20.59 22L17.45 18.86C16.89 19.23 16.3 19.56 15.66 19.78C14 20.36 12.2 20.4 10.53 19.88C9.5 19.58 8.56 19.05 7.75 18.37L4.56 21.56C4 22.15 3.03 22.15 2.44 21.56C1.86 21 1.86 20 2.44 19.44L5.82 16.06L8.47 15.54C9.19 16.45 10.19 17.13 11.28 17.5C12.44 17.85 13.72 17.84 14.87 17.46C15.16 17.37 15.44 17.26 15.7 17.12L7.6 9L5.83 10.78L3 7.95L7.95 3L12.19 4.41L9 7.6L17.31 15.89C17.5 15.71 17.65 15.53 17.8 15.33C19.3 13.36 19.42 10.42 18.09 8C16.78 5.57 14.5 3.55 12 2C13.41 2.5 14.76 3.17 16 4.04C17.24 4.91 18.43 5.93 19.33 7.25C20.23 8.54 20.87 10.12 21 11.79C21.1 13.47 20.66 15.23 19.7 16.65C19.5 17 19.24 17.28 19 17.56L22 20.59Z',
    ],
  },
  {
    id: 'std:plant',
    label: 'Pflanzen',
    source: 'sprout',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M2,22V20C2,20 7,18 12,18C17,18 22,20 22,20V22H2M11.3,9.1C10.1,5.2 4,6.1 4,6.1C4,6.1 4.2,13.9 9.9,12.7C9.5,9.8 8,9 8,9C10.8,9 11,12.4 11,12.4V17C11.3,17 11.7,17 12,17C12.3,17 12.7,17 13,17V12.8C13,12.8 13,8.9 16,7.9C16,7.9 14,10.9 14,12.9C21,13.6 21,4 21,4C21,4 12.1,3 11.3,9.1Z',
    ],
  },
  {
    id: 'std:scroll',
    label: 'Schriftstück',
    source: 'script-text-outline',
    // MDI zeichnet Flächen, nicht Striche.
    filled: true,
    paths: [
      'M15,20A1,1 0 0,0 16,19V4H8A1,1 0 0,0 7,5V16H5V5A3,3 0 0,1 8,2H19A3,3 0 0,1 22,5V6H20V5A1,1 0 0,0 19,4A1,1 0 0,0 18,5V9L18,19A3,3 0 0,1 15,22H5A3,3 0 0,1 2,19V18H13A2,2 0 0,0 15,20M9,6H14V8H9V6M9,10H14V12H9V10M9,14H14V16H9V14Z',
    ],
  },
]
