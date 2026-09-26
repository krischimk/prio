import type { ListIconDefinition } from './listIcons'

/**
 * Listensymbole aus fremden Sammlungen.
 *
 * **Erzeugte Datei – nicht von Hand bearbeiten.** Quelle ist
 * `scripts/generate-list-icons.mjs` (npm run icons:generate). Die Lizenztexte
 * liegen in THIRD-PARTY.md.
 *
 * Warum fremde Symbole: Von Hand gezeichnete Symbole für Motive wie
 * Schachfigur, Violine oder Bagger werden auf 24 Pixeln zu Klecksen. Hier
 * kommen sie in gleichbleibender Qualität – und weil das Ergebnis im Repository
 * liegt, kennt die App zur Laufzeit keine Fremdquelle.
 *
 * Je Symbol ist vermerkt, ob es als Strich oder als Fläche zu zeichnen ist und
 * auf welchem Raster es liegt: Lucide und Tabler zeichnen Striche, Material
 * Design Icons Flächen, und nicht jede Sammlung zeichnet auf 24×24.
 */
export const LIST_ICONS_MDI: ListIconDefinition[] = [
  {
    id: 'std:check',
    label: 'Erledigt',
    source: 'lucide/check',
    group: 'Allgemein',
    paths: [
      'M20 6 9 17l-5-5',
    ],
  },
  {
    id: 'std:star',
    label: 'Wichtig',
    source: 'mdi/star-outline',
    group: 'Allgemein',
    filled: true,
    paths: [
      'M12,15.39L8.24,17.66L9.23,13.38L5.91,10.5L10.29,10.13L12,6.09L13.71,10.13L18.09,10.5L14.77,13.38L15.76,17.66M22,9.24L14.81,8.63L12,2L9.19,8.63L2,9.24L7.45,13.97L5.82,21L12,17.27L18.18,21L16.54,13.97L22,9.24Z',
    ],
  },
  {
    id: 'std:heart',
    label: 'Favoriten',
    source: 'mdi/heart-outline',
    group: 'Allgemein',
    filled: true,
    paths: [
      'M12.1,18.55L12,18.65L11.89,18.55C7.14,14.24 4,11.39 4,8.5C4,6.5 5.5,5 7.5,5C9.04,5 10.54,6 11.07,7.36H12.93C13.46,6 14.96,5 16.5,5C18.5,5 20,6.5 20,8.5C20,11.39 16.86,14.24 12.1,18.55M16.5,3C14.76,3 13.09,3.81 12,5.08C10.91,3.81 9.24,3 7.5,3C4.42,3 2,5.41 2,8.5C2,12.27 5.4,15.36 10.55,20.03L12,21.35L13.45,20.03C18.6,15.36 22,12.27 22,8.5C22,5.41 19.58,3 16.5,3Z',
    ],
  },
  {
    id: 'std:flag',
    label: 'Merken',
    source: 'lucide/flag',
    group: 'Allgemein',
    paths: [
      'M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528',
    ],
  },
  {
    id: 'std:calendar',
    label: 'Termine',
    source: 'mdi/calendar-outline',
    group: 'Allgemein',
    filled: true,
    paths: [
      'M12 12H17V17H12V12M19 3H18V1H16V3H8V1H6V3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 5V7H5V5H19M5 19V9H19V19H5Z',
    ],
  },
  {
    id: 'std:people',
    label: 'Personen',
    source: 'lucide/user',
    group: 'Allgemein',
    paths: [
      'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2',
      'M 8 7 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0 Z',
    ],
  },
  {
    id: 'std:group',
    label: 'Gruppe',
    source: 'lucide/users',
    group: 'Allgemein',
    paths: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M16 3.128a4 4 0 0 1 0 7.744',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M 5 7 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0 Z',
    ],
  },
  {
    id: 'std:megaphone',
    label: 'Ankündigung',
    source: 'mdi/bullhorn-outline',
    group: 'Allgemein',
    filled: true,
    paths: [
      'M12,8H4A2,2 0 0,0 2,10V14A2,2 0 0,0 4,16H5V20A1,1 0 0,0 6,21H8A1,1 0 0,0 9,20V16H12L17,20V4L12,8M15,15.6L13,14H4V10H13L15,8.4V15.6M21.5,12C21.5,13.71 20.54,15.26 19,16V8C20.53,8.75 21.5,10.3 21.5,12Z',
    ],
  },
  {
    id: 'std:ideas',
    label: 'Ideen',
    source: 'mdi/lightbulb-outline',
    group: 'Allgemein',
    filled: true,
    paths: [
      'M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,21V20H15V21A1,1 0 0,1 14,22H10A1,1 0 0,1 9,21M12,4A5,5 0 0,0 7,9C7,11.05 8.23,12.81 10,13.58V16H14V13.58C15.77,12.81 17,11.05 17,9A5,5 0 0,0 12,4Z',
    ],
  },
  {
    id: 'std:send',
    label: 'Senden',
    source: 'lucide/send',
    group: 'Allgemein',
    paths: [
      'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z',
      'm21.854 2.147-10.94 10.939',
    ],
  },
  {
    id: 'std:search',
    label: 'Suche',
    source: 'mdi/magnify',
    group: 'Allgemein',
    filled: true,
    paths: [
      'M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z',
    ],
  },
  {
    id: 'std:refresh',
    label: 'Wiederholen',
    source: 'lucide/refresh-cw',
    group: 'Allgemein',
    paths: [
      'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
      'M21 3v5h-5',
      'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
      'M8 16H3v5',
    ],
  },
  {
    id: 'std:flash',
    label: 'Blitz',
    source: 'lucide/zap',
    group: 'Allgemein',
    paths: [
      'M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z',
    ],
  },
  {
    id: 'std:folder',
    label: 'Sonstiges',
    source: 'mdi/folder-outline',
    group: 'Allgemein',
    filled: true,
    paths: [
      'M20,18H4V8H20M20,6H12L10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6Z',
    ],
  },
  {
    id: 'std:hammer-sickle',
    label: 'Hammer und Sichel',
    source: 'mdi/hammer-sickle',
    group: 'Allgemein',
    filled: true,
    paths: [
      'M22 20.59L20.59 22L17.45 18.86C16.89 19.23 16.3 19.56 15.66 19.78C14 20.36 12.2 20.4 10.53 19.88C9.5 19.58 8.56 19.05 7.75 18.37L4.56 21.56C4 22.15 3.03 22.15 2.44 21.56C1.86 21 1.86 20 2.44 19.44L5.82 16.06L8.47 15.54C9.19 16.45 10.19 17.13 11.28 17.5C12.44 17.85 13.72 17.84 14.87 17.46C15.16 17.37 15.44 17.26 15.7 17.12L7.6 9L5.83 10.78L3 7.95L7.95 3L12.19 4.41L9 7.6L17.31 15.89C17.5 15.71 17.65 15.53 17.8 15.33C19.3 13.36 19.42 10.42 18.09 8C16.78 5.57 14.5 3.55 12 2C13.41 2.5 14.76 3.17 16 4.04C17.24 4.91 18.43 5.93 19.33 7.25C20.23 8.54 20.87 10.12 21 11.79C21.1 13.47 20.66 15.23 19.7 16.65C19.5 17 19.24 17.28 19 17.56L22 20.59Z',
    ],
  },
  {
    id: 'std:home',
    label: 'Haushalt',
    source: 'mdi/home-outline',
    group: 'Privates',
    filled: true,
    paths: [
      'M12 5.69L17 10.19V18H15V12H9V18H7V10.19L12 5.69M12 3L2 12H5V20H11V14H13V20H19V12H22',
    ],
  },
  {
    id: 'std:shopping',
    label: 'Einkauf',
    source: 'mdi/cart-outline',
    group: 'Privates',
    filled: true,
    paths: [
      'M17,18A2,2 0 0,1 19,20A2,2 0 0,1 17,22C15.89,22 15,21.1 15,20C15,18.89 15.89,18 17,18M1,2H4.27L5.21,4H20A1,1 0 0,1 21,5C21,5.17 20.95,5.34 20.88,5.5L17.3,11.97C16.96,12.58 16.3,13 15.55,13H8.1L7.2,14.63L7.17,14.75A0.25,0.25 0 0,0 7.42,15H19V17H7C5.89,17 5,16.1 5,15C5,14.65 5.09,14.32 5.24,14.04L6.6,11.59L3,4H1V2M7,18A2,2 0 0,1 9,20A2,2 0 0,1 7,22C5.89,22 5,21.1 5,20C5,18.89 5.89,18 7,18M16,11L18.78,6H6.14L8.5,11H16Z',
    ],
  },
  {
    id: 'std:money',
    label: 'Finanzen',
    source: 'mdi/cash',
    group: 'Privates',
    filled: true,
    paths: [
      'M3,6H21V18H3V6M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M7,8A2,2 0 0,1 5,10V14A2,2 0 0,1 7,16H17A2,2 0 0,1 19,14V10A2,2 0 0,1 17,8H7Z',
    ],
  },
  {
    id: 'std:hanger',
    label: 'Kleidung',
    source: 'mdi/hanger',
    group: 'Privates',
    filled: true,
    paths: [
      'M12 4A3.5 3.5 0 0 0 8.5 7.5H10.5A1.5 1.5 0 0 1 12 6A1.5 1.5 0 0 1 13.5 7.5A1.5 1.5 0 0 1 12 9C11.45 9 11 9.45 11 10V11.75L2.4 18.2A1 1 0 0 0 3 20H21A1 1 0 0 0 21.6 18.2L13 11.75V10.85A3.5 3.5 0 0 0 15.5 7.5A3.5 3.5 0 0 0 12 4M12 13.5L18 18H6Z',
    ],
  },
  {
    id: 'std:shirt',
    label: 'T-Shirt',
    source: 'lucide/shirt',
    group: 'Privates',
    paths: [
      'M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z',
    ],
  },
  {
    id: 'std:cleaning',
    label: 'Putzen',
    source: 'lucide/broom-sparkles',
    group: 'Privates',
    paths: [
      'M11 2v2',
      'M12 3h-2',
      'M13.5 10.5 22 2',
      'M14.734 13.841a2 2 0 00-.314-2.42L12.58 9.58a2 2 0 00-2.421-.314l-7.657 4.461A1 1 0 002.3 15.3l6.403 6.403a1 1 0 001.571-.204z',
      'M20 15v4',
      'M22 17h-4',
      'M4 4v4',
      'm5 18 2-2',
      'M6 6H2',
      'm7.699 10.7 5.602 5.601',
    ],
  },
  {
    id: 'std:garden',
    label: 'Garten',
    source: 'lucide/shovel',
    group: 'Privates',
    paths: [
      'M21.56 4.56a1.5 1.5 0 0 1 0 2.122l-.47.47a3 3 0 0 1-4.212-.03 3 3 0 0 1 0-4.243l.44-.44a1.5 1.5 0 0 1 2.121 0z',
      'M3 22a1 1 0 0 1-1-1v-3.586a1 1 0 0 1 .293-.707l3.355-3.355a1.205 1.205 0 0 1 1.704 0l3.296 3.296a1.205 1.205 0 0 1 0 1.704l-3.355 3.355a1 1 0 0 1-.707.293z',
      'm9 15 7.879-7.878',
    ],
  },
  {
    id: 'std:plant',
    label: 'Pflanzen',
    source: 'lucide/plant-pot',
    group: 'Privates',
    paths: [
      'M14 8.536V6a4 4 0 014-4h1.5a.5.5 0 01.5.5V4a4 4 0 01-4 4 4 4 0 00-4 4 5 5 0 01-8-4 5 5 0 018 4c0 2 1 3 1 5',
      'm18 17-1.085 3.58A2 2 0 0115 22H9.002a2 2 0 01-1.913-1.418L6 17',
      'M5 17h14',
    ],
  },
  {
    id: 'std:chef',
    label: 'Kochen',
    source: 'lucide/chef-hat',
    group: 'Privates',
    paths: [
      'M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z',
      'M6 17h12',
    ],
  },
  {
    id: 'std:food',
    label: 'Essen',
    source: 'lucide/utensils',
    group: 'Privates',
    paths: [
      'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2',
      'M7 2v20',
      'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7',
    ],
  },
  {
    id: 'std:medical',
    label: 'Gesundheit',
    source: 'mdi/hospital-box-outline',
    group: 'Privates',
    filled: true,
    paths: [
      'M18 14H14V18H10V14H6V10H10V6H14V10H18M20 2H4C2.9 2 2 2.9 2 4V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V4C22 2.9 21.1 2 20 2M20 20H4V4H20V20Z',
    ],
  },
  {
    id: 'std:tools',
    label: 'Werkzeug',
    source: 'lucide/wrench',
    group: 'Privates',
    paths: [
      'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z',
    ],
  },
  {
    id: 'std:birthday',
    label: 'Geburtstag',
    source: 'mdi/cake-variant-outline',
    group: 'Privates',
    filled: true,
    paths: [
      'M12 6C13.11 6 14 5.1 14 4C14 3.62 13.9 3.27 13.71 2.97L12 0L10.29 2.97C10.1 3.27 10 3.62 10 4C10 5.1 10.9 6 12 6M18 9H13V7H11V9H6C4.34 9 3 10.34 3 12V21C3 21.55 3.45 22 4 22H20C20.55 22 21 21.55 21 21V12C21 10.34 19.66 9 18 9M19 20H5V17C5.9 17 6.76 16.63 7.4 16L8.5 14.92L9.56 16C10.87 17.3 13.15 17.29 14.45 16L15.53 14.92L16.6 16C17.24 16.63 18.1 17 19 17V20M19 15.5C18.5 15.5 18 15.3 17.65 14.93L15.5 12.8L13.38 14.93C12.64 15.67 11.35 15.67 10.61 14.93L8.5 12.8L6.34 14.93C6 15.29 5.5 15.5 5 15.5V12C5 11.45 5.45 11 6 11H18C18.55 11 19 11.45 19 12V15.5Z',
    ],
  },
  {
    id: 'std:gift',
    label: 'Geschenk',
    source: 'lucide/gift',
    group: 'Privates',
    paths: [
      'M12 7v14',
      'M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8',
      'M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5',
      'M 4 7 H 20 A 1 1 0 0 1 21 8 V 10 A 1 1 0 0 1 20 11 H 4 A 1 1 0 0 1 3 10 V 8 A 1 1 0 0 1 4 7 Z',
    ],
  },
  {
    id: 'std:work',
    label: 'Arbeit',
    source: 'mdi/briefcase-outline',
    group: 'Arbeit und Lernen',
    filled: true,
    paths: [
      'M20,6C20.58,6 21.05,6.2 21.42,6.59C21.8,7 22,7.45 22,8V19C22,19.55 21.8,20 21.42,20.41C21.05,20.8 20.58,21 20,21H4C3.42,21 2.95,20.8 2.58,20.41C2.2,20 2,19.55 2,19V8C2,7.45 2.2,7 2.58,6.59C2.95,6.2 3.42,6 4,6H8V4C8,3.42 8.2,2.95 8.58,2.58C8.95,2.2 9.42,2 10,2H14C14.58,2 15.05,2.2 15.42,2.58C15.8,2.95 16,3.42 16,4V6H20M4,8V19H20V8H4M14,6V4H10V6H14Z',
    ],
  },
  {
    id: 'std:graduation',
    label: 'Studium',
    source: 'lucide/graduation-cap',
    group: 'Arbeit und Lernen',
    paths: [
      'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z',
      'M22 10v6',
      'M6 12.5V16a6 3 0 0 0 12 0v-3.5',
    ],
  },
  {
    id: 'std:study',
    label: 'Lernen',
    source: 'mdi/book-open-variant-outline',
    group: 'Arbeit und Lernen',
    filled: true,
    paths: [
      'M12 21.5C10.65 20.65 8.2 20 6.5 20C4.85 20 3.15 20.3 1.75 21.05C1.65 21.1 1.6 21.1 1.5 21.1C1.25 21.1 1 20.85 1 20.6V6C1.6 5.55 2.25 5.25 3 5C4.11 4.65 5.33 4.5 6.5 4.5C8.45 4.5 10.55 4.9 12 6C13.45 4.9 15.55 4.5 17.5 4.5C18.67 4.5 19.89 4.65 21 5C21.75 5.25 22.4 5.55 23 6V20.6C23 20.85 22.75 21.1 22.5 21.1C22.4 21.1 22.35 21.1 22.25 21.05C20.85 20.3 19.15 20 17.5 20C15.8 20 13.35 20.65 12 21.5M11 7.5C9.64 6.9 7.84 6.5 6.5 6.5C5.3 6.5 4.1 6.65 3 7V18.5C4.1 18.15 5.3 18 6.5 18C7.84 18 9.64 18.4 11 19V7.5M13 19C14.36 18.4 16.16 18 17.5 18C18.7 18 19.9 18.15 21 18.5V7C19.9 6.65 18.7 6.5 17.5 6.5C16.16 6.5 14.36 6.9 13 7.5V19M14 16.35C14.96 16 16.12 15.83 17.5 15.83C18.54 15.83 19.38 15.91 20 16.07V14.57C19.13 14.41 18.29 14.33 17.5 14.33C16.16 14.33 15 14.5 14 14.76V16.35M14 13.69C14.96 13.34 16.12 13.16 17.5 13.16C18.54 13.16 19.38 13.24 20 13.4V11.9C19.13 11.74 18.29 11.67 17.5 11.67C16.22 11.67 15.05 11.82 14 12.12V13.69M14 11C14.96 10.67 16.12 10.5 17.5 10.5C18.41 10.5 19.26 10.59 20 10.78V9.23C19.13 9.08 18.29 9 17.5 9C16.18 9 15 9.15 14 9.46V11Z',
    ],
  },
  {
    id: 'std:notebook',
    label: 'Notizbuch',
    source: 'mdi/notebook-outline',
    group: 'Arbeit und Lernen',
    filled: true,
    paths: [
      'M17,4V10L15,8L13,10V4H9V20H19V4H17M3,7V5H5V4C5,2.89 5.9,2 7,2H19C20.05,2 21,2.95 21,4V20C21,21.05 20.05,22 19,22H7C5.95,22 5,21.05 5,20V19H3V17H5V13H3V11H5V7H3M5,5V7H7V5H5M5,19H7V17H5V19M5,13H7V11H5V13Z',
    ],
  },
  {
    id: 'std:pencil',
    label: 'Stift',
    source: 'lucide/pencil',
    group: 'Arbeit und Lernen',
    paths: [
      'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
      'm15 5 4 4',
    ],
  },
  {
    id: 'std:scroll',
    label: 'Schriftstück',
    source: 'mdi/feather',
    group: 'Arbeit und Lernen',
    filled: true,
    paths: [
      'M22,2C22,2 14.36,1.63 8.34,9.88C3.72,16.21 2,22 2,22L3.94,21C5.38,18.5 6.13,17.47 7.54,16C10.07,16.74 12.71,16.65 15,14C13,13.44 11.4,13.57 9.04,13.81C11.69,12 13.5,11.6 16,12L17,10C15.2,9.66 14,9.63 12.22,10.04C14.19,8.65 15.56,7.87 18,8L19.21,6.07C17.65,5.96 16.71,6.13 14.92,6.57C16.53,5.11 18,4.45 20.14,4.32C20.14,4.32 21.19,2.43 22,2Z',
    ],
  },
  {
    id: 'std:checklist',
    label: 'Checkliste',
    source: 'mdi/checkbox-multiple-marked-outline',
    group: 'Arbeit und Lernen',
    filled: true,
    paths: [
      'M20,16V10H22V16A2,2 0 0,1 20,18H8C6.89,18 6,17.1 6,16V4C6,2.89 6.89,2 8,2H16V4H8V16H20M10.91,7.08L14,10.17L20.59,3.58L22,5L14,13L9.5,8.5L10.91,7.08M16,20V22H4A2,2 0 0,1 2,20V7H4V20H16Z',
    ],
  },
  {
    id: 'std:deadlines',
    label: 'Fristen',
    source: 'mdi/clipboard-clock-outline',
    group: 'Arbeit und Lernen',
    filled: true,
    paths: [
      'M21 11.11V5C21 3.9 20.11 3 19 3H14.82C14.4 1.84 13.3 1 12 1S9.6 1.84 9.18 3H5C3.9 3 3 3.9 3 5V19C3 20.11 3.9 21 5 21H11.11C12.37 22.24 14.09 23 16 23C19.87 23 23 19.87 23 16C23 14.09 22.24 12.37 21 11.11M12 3C12.55 3 13 3.45 13 4S12.55 5 12 5 11 4.55 11 4 11.45 3 12 3M5 19V5H7V7H17V5H19V9.68C18.09 9.25 17.08 9 16 9C12.13 9 9 12.13 9 16C9 17.08 9.25 18.09 9.68 19H5M16 21C13.24 21 11 18.76 11 16S13.24 11 16 11 21 13.24 21 16 18.76 21 16 21M16.5 16.25L19.36 17.94L18.61 19.16L15 17V12H16.5V16.25Z',
    ],
  },
  {
    id: 'std:computer',
    label: 'Computer',
    source: 'mdi/monitor',
    group: 'Arbeit und Lernen',
    filled: true,
    paths: [
      'M21,16H3V4H21M21,2H3C1.89,2 1,2.89 1,4V16A2,2 0 0,0 3,18H10V20H8V22H16V20H14V18H21A2,2 0 0,0 23,16V4C23,2.89 22.1,2 21,2Z',
    ],
  },
  {
    id: 'std:code',
    label: 'Programmieren',
    source: 'lucide/code-xml',
    group: 'Arbeit und Lernen',
    paths: [
      'm18 16 4-4-4-4',
      'm6 8-4 4 4 4',
      'm14.5 4-5 16',
    ],
  },
  {
    id: 'std:terminal',
    label: 'Konsole',
    source: 'mdi/console',
    group: 'Arbeit und Lernen',
    filled: true,
    paths: [
      'M20,19V7H4V19H20M20,3A2,2 0 0,1 22,5V19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5C2,3.89 2.9,3 4,3H20M13,17V15H18V17H13M9.58,13L5.57,9H8.4L11.7,12.3C12.09,12.69 12.09,13.33 11.7,13.72L8.42,17H5.59L9.58,13Z',
    ],
  },
  {
    id: 'std:server',
    label: 'Server',
    source: 'mdi/server-outline',
    group: 'Arbeit und Lernen',
    filled: true,
    paths: [
      'M2 4.6V9.4C2 10.3 2.5 11 3.2 11H20.9C21.5 11 22.1 10.3 22.1 9.4V4.6C22 3.7 21.5 3 20.8 3H3.2C2.5 3 2 3.7 2 4.6M10 8V6H9V8H10M5 8H7V6H5V8M20 9H4V5H20V9M2 14.6V19.4C2 20.3 2.5 21 3.2 21H20.9C21.5 21 22.1 20.3 22.1 19.4V14.6C22.1 13.7 21.6 13 20.9 13H3.2C2.5 13 2 13.7 2 14.6M10 18V16H9V18H10M5 18H7V16H5V18M20 19H4V15H20V19Z',
    ],
  },
  {
    id: 'std:cloud',
    label: 'Cloud',
    source: 'mdi/cloud-outline',
    group: 'Arbeit und Lernen',
    filled: true,
    paths: [
      'M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58 1 12.63 2.17 11.1 3.35 9.57 5.25 9.15 5.88 6.85 7.75 5.43 9.63 4 12 4 14.93 4 16.96 6.04 19 8.07 19 11 20.73 11.2 21.86 12.5 23 13.78 23 15.5 23 17.38 21.69 18.69 20.38 20 18.5 20M6.5 18H18.5Q19.55 18 20.27 17.27 21 16.55 21 15.5 21 14.45 20.27 13.73 19.55 13 18.5 13H17V11Q17 8.93 15.54 7.46 14.08 6 12 6 9.93 6 8.46 7.46 7 8.93 7 11H6.5Q5.05 11 4.03 12.03 3 13.05 3 14.5 3 15.95 4.03 17 5.05 18 6.5 18M12 12Z',
    ],
  },
  {
    id: 'std:tree',
    label: 'Baum',
    source: 'lucide/folder-tree',
    group: 'Arbeit und Lernen',
    paths: [
      'M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z',
      'M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.42-.85a1 1 0 0 0-.92-.6H13a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z',
      'M3 5a2 2 0 0 0 2 2h3',
      'M3 3v13a2 2 0 0 0 2 2h3',
    ],
  },
  {
    id: 'std:graph',
    label: 'Graph',
    source: 'lucide/network',
    group: 'Arbeit und Lernen',
    paths: [
      'M 17 16 H 21 A 1 1 0 0 1 22 17 V 21 A 1 1 0 0 1 21 22 H 17 A 1 1 0 0 1 16 21 V 17 A 1 1 0 0 1 17 16 Z',
      'M 3 16 H 7 A 1 1 0 0 1 8 17 V 21 A 1 1 0 0 1 7 22 H 3 A 1 1 0 0 1 2 21 V 17 A 1 1 0 0 1 3 16 Z',
      'M 10 2 H 14 A 1 1 0 0 1 15 3 V 7 A 1 1 0 0 1 14 8 H 10 A 1 1 0 0 1 9 7 V 3 A 1 1 0 0 1 10 2 Z',
      'M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3',
      'M12 12V8',
    ],
  },
  {
    id: 'std:math',
    label: 'Mathematik',
    source: 'mdi/calculator-variant-outline',
    group: 'Arbeit und Lernen',
    filled: true,
    paths: [
      'M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 19H5V5H19V19M6.2 7.7H11.2V9.2H6.2V7.7M13 15.8H18V17.3H13V15.8M13 13.2H18V14.7H13V13.2M8 18H9.5V16H11.5V14.5H9.5V12.5H8V14.5H6V16H8V18M14.1 10.9L15.5 9.5L16.9 10.9L18 9.9L16.6 8.5L18 7.1L16.9 6L15.5 7.4L14.1 6L13 7.1L14.4 8.5L13 9.9L14.1 10.9Z',
    ],
  },
  {
    id: 'std:travel',
    label: 'Reise',
    source: 'lucide/plane',
    group: 'Reisen',
    paths: [
      'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
    ],
  },
  {
    id: 'std:car',
    label: 'Auto',
    source: 'mdi/car-outline',
    group: 'Reisen',
    filled: true,
    paths: [
      'M18.9 6C18.7 5.4 18.1 5 17.5 5H6.5C5.8 5 5.3 5.4 5.1 6L3 12V20C3 20.5 3.5 21 4 21H5C5.6 21 6 20.5 6 20V19H18V20C18 20.5 18.5 21 19 21H20C20.5 21 21 20.5 21 20V12L18.9 6M6.8 7H17.1L18.2 10H5.8L6.8 7M19 17H5V12H19V17M7.5 13C8.3 13 9 13.7 9 14.5S8.3 16 7.5 16 6 15.3 6 14.5 6.7 13 7.5 13M16.5 13C17.3 13 18 13.7 18 14.5S17.3 16 16.5 16C15.7 16 15 15.3 15 14.5S15.7 13 16.5 13Z',
    ],
  },
  {
    id: 'std:suitcase',
    label: 'Koffer',
    source: 'mdi/bag-suitcase-outline',
    group: 'Reisen',
    filled: true,
    paths: [
      'M9.5 18V9H8V18M12.75 18V9H11.25V18M16 18V9H14.5V18M17.03 6C18.11 6 19 6.88 19 8V19C19 20.13 18.11 21 17.03 21C17.03 21.58 16.56 22 16 22C15.5 22 15 21.58 15 21H9C9 21.58 8.5 22 8 22C7.44 22 6.97 21.58 6.97 21C5.89 21 5 20.13 5 19V8C5 6.88 5.89 6 6.97 6H9V3C9 2.42 9.46 2 10 2H14C14.54 2 15 2.42 15 3V6M10.5 3.5V6H13.5V3.5M17.03 19V8H6.97V19',
    ],
  },
  {
    id: 'std:mountain',
    label: 'Berge',
    source: 'mdi/image-filter-hdr-outline',
    group: 'Reisen',
    filled: true,
    paths: [
      'M23 18H1L8.25 8.33L10.25 11L14 6L23 18M11.5 12.67L14 16L19 16L14 9.33L11.5 12.67M5 16L11.5 16L8.25 11.67L5 16Z',
    ],
  },
  {
    id: 'std:stone',
    label: 'Fels',
    source: 'lucide/stone',
    group: 'Reisen',
    paths: [
      'M11.264 2.205A4 4 0 0 0 6.42 4.211l-4 8a4 4 0 0 0 1.359 5.117l6 4a4 4 0 0 0 4.438 0l6-4a4 4 0 0 0 1.576-4.592l-2-6a4 4 0 0 0-2.53-2.53z',
      'M11.99 22 14 12l7.822 3.184',
      'M14 12 8.47 2.302',
    ],
  },
  {
    id: 'std:japan',
    label: 'Japan',
    source: 'tabler/torii',
    group: 'Reisen',
    paths: [
      'M4 4c5.333 1.333 10.667 1.333 16 0',
      'M4 8h16',
      'M12 5v3',
      'M18 4.5v15.5',
      'M6 4.5v15.5',
    ],
  },
  {
    id: 'std:translate',
    label: 'Sprache',
    source: 'mdi/translate',
    group: 'Reisen',
    filled: true,
    paths: [
      'M12.87,15.07L10.33,12.56L10.36,12.53C12.1,10.59 13.34,8.36 14.07,6H17V4H10V2H8V4H1V6H12.17C11.5,7.92 10.44,9.75 9,11.35C8.07,10.32 7.3,9.19 6.69,8H4.69C5.42,9.63 6.42,11.17 7.67,12.56L2.58,17.58L4,19L9,14L12.11,17.11L12.87,15.07M18.5,10H16.5L12,22H14L15.12,19H19.87L21,22H23L18.5,10M15.88,17L17.5,12.67L19.12,17H15.88Z',
    ],
  },
  {
    id: 'std:sport',
    label: 'Sport',
    source: 'mdi/dumbbell',
    group: 'Hobbies',
    filled: true,
    paths: [
      'M20.57,14.86L22,13.43L20.57,12L17,15.57L8.43,7L12,3.43L10.57,2L9.14,3.43L7.71,2L5.57,4.14L4.14,2.71L2.71,4.14L4.14,5.57L2,7.71L3.43,9.14L2,10.57L3.43,12L7,8.43L15.57,17L12,20.57L13.43,22L14.86,20.57L16.29,22L18.43,19.86L19.86,21.29L21.29,19.86L19.86,18.43L22,16.29L20.57,14.86Z',
    ],
  },
  {
    id: 'std:climb',
    label: 'Klettern',
    source: 'mdi/carabiner',
    group: 'Hobbies',
    filled: true,
    paths: [
      'M8 17.5C8 18.33 7.33 19 6.5 19S5 18.33 5 17.5 5.67 16 6.5 16 8 16.67 8 17.5M18 5.59C17.79 3.54 16.18 2 14.24 2H8.88C6.95 2 5.36 3.5 5.15 5.53L5 6.59C4.92 7.34 5.5 8 6.24 8C6.87 8 7.39 7.53 7.47 6.91L7.61 5.82C7.68 5.07 8.23 4.5 8.88 4.5H14.24C14.89 4.5 15.44 5.07 15.5 5.82L16.5 16.88C16.59 17.74 16 18.5 15.25 18.5L10.04 17.82C9.95 18.77 9.5 19.6 8.8 20.18L14.93 21L15.09 21H15.25C16.27 21 17.26 20.56 17.96 19.78C18.71 18.94 19.09 17.8 19 16.65L18 5.59M11.66 7.94C11.08 7.57 10.31 7.75 9.94 8.34L6.39 14C6.43 14 6.46 14 6.5 14C7.38 14 8.18 14.34 8.8 14.88L12.06 9.66C12.43 9.08 12.25 8.31 11.66 7.94Z',
    ],
  },
  {
    id: 'std:sailing',
    label: 'Segeln',
    source: 'mdi/sail-boat',
    group: 'Hobbies',
    filled: true,
    paths: [
      'M3 13.5L11 2.03V13.5H3M12.5 13.5C13.85 9.75 13.67 4.71 12.5 1C17.26 2.54 20.9 8.4 20.96 13.5H12.5M21.1 17.08C20.69 17.72 20.21 18.27 19.65 18.74C19 18.45 18.42 18 17.96 17.5C16.47 19.43 13.46 19.43 11.97 17.5C10.5 19.43 7.47 19.43 6 17.5C5.5 18 4.95 18.45 4.3 18.74C3.16 17.8 2.3 16.46 2 15H21.94C21.78 15.75 21.5 16.44 21.1 17.08M20.96 23C19.9 23 18.9 22.75 17.96 22.25C16.12 23.25 13.81 23.25 11.97 22.25C10.13 23.25 7.82 23.25 6 22.25C4.77 22.94 3.36 23.05 2 23V21C3.41 21.05 4.77 20.9 6 20C7.74 21.25 10.21 21.25 11.97 20C13.74 21.25 16.2 21.25 17.96 20C19.17 20.9 20.54 21.05 21.94 21V23H20.96Z',
    ],
  },
  {
    id: 'std:music',
    label: 'Musik',
    source: 'lucide/music',
    group: 'Hobbies',
    paths: [
      'M9 18V5l12-2v13',
      'M 3 18 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 Z',
      'M 15 16 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 Z',
    ],
  },
  {
    id: 'std:piano',
    label: 'Klavier',
    source: 'mdi/piano',
    group: 'Hobbies',
    filled: true,
    paths: [
      'M20 2H4C2.9 2 2 2.9 2 4V20C2 21.11 2.9 22 4 22H20C21.11 22 22 21.11 22 20V4C22 2.9 21.11 2 20 2M14.74 14H15V20H9V14H9.31C9.86 14 10.3 13.56 10.3 13V4H13.75V13C13.75 13.56 14.19 14 14.74 14M4 4H6.8V13C6.8 13.56 7.24 14 7.79 14H8V20H4V4M20 20H16V14H16.26C16.81 14 17.25 13.56 17.25 13V4H20V20Z',
    ],
  },
  {
    id: 'std:chess',
    label: 'Schach',
    source: 'lucide/chess-queen',
    group: 'Hobbies',
    paths: [
      'M4 20a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z',
      'm12.474 5.943 1.567 5.34a1 1 0 0 0 1.75.328l2.616-3.402',
      'm20 9-3 9',
      'm5.594 8.209 2.615 3.403a1 1 0 0 0 1.75-.329l1.567-5.34',
      'M7 18 4 9',
      'M 10 4 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 Z',
      'M 18 7 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 Z',
      'M 2 7 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0 Z',
    ],
  },
  {
    id: 'std:art',
    label: 'Kunst',
    source: 'mdi/palette-outline',
    group: 'Hobbies',
    filled: true,
    paths: [
      'M12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2C17.5,2 22,6 22,11A6,6 0 0,1 16,17H14.2C13.9,17 13.7,17.2 13.7,17.5C13.7,17.6 13.8,17.7 13.8,17.8C14.2,18.3 14.4,18.9 14.4,19.5C14.5,20.9 13.4,22 12,22M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C12.3,20 12.5,19.8 12.5,19.5C12.5,19.3 12.4,19.2 12.4,19.1C12,18.6 11.8,18.1 11.8,17.5C11.8,16.1 12.9,15 14.3,15H16A4,4 0 0,0 20,11C20,7.1 16.4,4 12,4M6.5,10C7.3,10 8,10.7 8,11.5C8,12.3 7.3,13 6.5,13C5.7,13 5,12.3 5,11.5C5,10.7 5.7,10 6.5,10M9.5,6C10.3,6 11,6.7 11,7.5C11,8.3 10.3,9 9.5,9C8.7,9 8,8.3 8,7.5C8,6.7 8.7,6 9.5,6M14.5,6C15.3,6 16,6.7 16,7.5C16,8.3 15.3,9 14.5,9C13.7,9 13,8.3 13,7.5C13,6.7 13.7,6 14.5,6M17.5,10C18.3,10 19,10.7 19,11.5C19,12.3 18.3,13 17.5,13C16.7,13 16,12.3 16,11.5C16,10.7 16.7,10 17.5,10Z',
    ],
  },
  {
    id: 'std:sewing',
    label: 'Nähen',
    source: 'tabler/needle-thread',
    group: 'Hobbies',
    paths: [
      'M3 21c-.667 -.667 3.262 -6.236 11.785 -16.709a3.5 3.5 0 1 1 5.078 4.791c-10.575 8.612 -16.196 12.585 -16.863 11.918',
      'M17.5 6.5l-1 1',
      'M17 7c-2.333 -2.667 -3.5 -4 -5 -4s-2 1 -2 2c0 4 8.161 8.406 6 11c-1.056 1.268 -3.363 1.285 -5.75 .808',
      'M5.739 15.425c-1.393 -.565 -3.739 -1.925 -3.739 -3.425',
      'M19.5 9.5l1.5 1.5',
    ],
  },
]
