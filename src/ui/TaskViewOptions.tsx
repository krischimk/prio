import { useState } from 'react'
import { useIsDesktop } from '../app/useIsDesktop'
import { Popover } from '@ark-ui/react/popover'
import type { OverviewMode, ListSortMode } from '../domain/types'
import { parseTags, tagKey } from '../domain/tags'
import { useView } from './useView'
import { useBackLayer } from '../app/useBackLayer'
import { useTaskTags } from '../app/hooks'
import { IconButton } from './components/IconButton'
import { Button } from './components/Button'
import { BulletListIcon, ClockIcon, FilterIcon, GripIcon, PriorityIcon, SectionsIcon, SortIcon, TagIcon } from './icons'
import { overviewModeLabel } from './overviewMode'
import { listSortModeLabel } from './listSortMode'
import { focusRing, layer } from './styles'

/** Gleicher Tagfilter in Einzel- und Gesamtansicht; deren Listenwahl bleibt unverändert. */
export function TaskViewOptions({ tags, mode, busy = false, onModeChange, listMode, hasSections = false, onListModeChange }: {
  tags: string[]; mode?: OverviewMode; busy?: boolean; onModeChange?: (mode: OverviewMode) => void
  listMode?: ListSortMode; hasSections?: boolean; onListModeChange?: (mode: ListSortMode) => void
}) {
  const desktop = useIsDesktop()
  const { tagFilter, setTagFilter } = useView()
  const known = useTaskTags()
  const [open, setOpen] = useState(false)
  useBackLayer(open, () => setOpen(false), 'aufgaben-ansicht')
  const choices = parseTags([...tagFilter, ...tags, ...known]).sort((a, b) => a.localeCompare(b, 'de'))
  const listModes: Partial<Record<ListSortMode, string>> = hasSections
    ? listSortModeLabel
    : { manual: 'Manuelle Reihenfolge', priority: 'Höchste Priorität zuerst' }
  const sorting = mode !== undefined || listMode !== undefined
  const selectedListMode = !hasSections && listMode === 'priority_flat' ? 'priority' : listMode
  return <Popover.Root open={open} onOpenChange={details => setOpen(details.open)}
    onEscapeKeyDown={event => { event.preventDefault(); setOpen(false) }} positioning={{ strategy: 'fixed', placement: 'bottom-end' }} lazyMount unmountOnExit>
    <Popover.Trigger asChild><IconButton size={desktop ? 'iconSm' : 'toolbarIcon'} aria-label={sorting ? 'Sortierung ändern' : 'Nach Tags filtern'} variant={tagFilter.length ? 'iconActive' : 'icon'}
      title={sorting ? `Sortierung ändern und nach Tags filtern. Aktuell: ${mode ? overviewModeLabel[mode] : listModes[selectedListMode!]}.` : 'Aufgaben nach Tags filtern.'}>
      {sorting ? <SortIcon className="size-icon-meta" /> : <FilterIcon className="size-icon-meta" />}
    </IconButton></Popover.Trigger>
    <Popover.Positioner className={layer.raised}><Popover.Content className="w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-card border border-line-strong bg-raised p-3 shadow-lg shadow-page/50">
      {mode && onModeChange ? <fieldset aria-label="Ansicht der Gesamtansicht" className="space-y-1">
        <legend className="sr-only">Ansicht der Gesamtansicht</legend>
        {Object.entries(overviewModeLabel).map(([value, label]) => <label key={value} className={`${focusRing} flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-body hover:bg-surface`}>
          <input type="radio" name="overview-sort" className="size-4 accent-brand" checked={mode === value} disabled={busy}
            onChange={() => { onModeChange(value as OverviewMode); setOpen(false) }} />
          {value === 'by_list' ? <BulletListIcon /> : value === 'newest' ? <ClockIcon /> : <PriorityIcon />}{label}
        </label>)}
      </fieldset> : null}
      {listMode && onListModeChange ? <fieldset aria-label="Sortierung der Liste" className="space-y-1">
        <legend className="sr-only">Sortierung der Liste</legend>
        {Object.entries(listModes).map(([value, label]) => <label key={value} className={`${focusRing} flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-body hover:bg-surface`}>
          <input type="radio" name="list-sort" className="size-4 accent-brand" checked={selectedListMode === value} disabled={busy}
            onChange={() => { onListModeChange(value as ListSortMode); setOpen(false) }} />
          {value === 'manual' ? <GripIcon /> : value === 'priority' && hasSections ? <SectionsIcon /> : <PriorityIcon />}{label}
        </label>)}
      </fieldset> : null}
      <fieldset className="space-y-1"><legend className="mb-1 flex items-center gap-2 text-meta text-ink-muted"><TagIcon className="size-icon-meta" />Nach Tags filtern</legend>
        {choices.length ? <div className="max-h-60 overflow-y-auto">{choices.map(tag => <label key={tagKey(tag)} className={`${focusRing} flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-body text-ink hover:bg-surface`}>
          <input type="checkbox" className="size-5 shrink-0 accent-brand" aria-label={`Tagfilter: ${tag}`} checked={tagFilter.some(value => tagKey(value) === tagKey(tag))}
            onChange={event => setTagFilter(event.target.checked ? [...tagFilter, tag] : tagFilter.filter(value => tagKey(value) !== tagKey(tag)))} />
          <span className="break-words">{tag}</span>
        </label>)}</div> : <p className="py-2 text-body text-ink-muted">Hier gibt es noch keine Tags.</p>}
      </fieldset>
      {tagFilter.length ? <Button variant="ghost" size="sm" layout="w-full" onClick={() => setTagFilter([])}>Filter zurücksetzen</Button> : null}
    </Popover.Content></Popover.Positioner>
  </Popover.Root>
}

export function ActiveTagFilters() {
  const { tagFilter, setTagFilter } = useView()
  return tagFilter.length ? <div role="group" aria-label="Aktive Tagfilter" className="mt-2 flex flex-wrap gap-1">{tagFilter.map(tag => <Button key={tagKey(tag)} variant="secondary" size="sm"
    aria-label={`Tagfilter entfernen: ${tag}`} onClick={() => setTagFilter(tagFilter.filter(value => tagKey(value) !== tagKey(tag)))}>
    <TagIcon className="size-icon-meta" />{tag}<span aria-hidden="true">×</span>
  </Button>)}</div> : null
}
