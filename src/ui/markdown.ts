/** Bewusst unterstützte Link-Protokolle, gemeinsam für Anzeige und Editor. */
export function markdownHref(href: string): string | null {
  try {
    const url = new URL(href)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}
