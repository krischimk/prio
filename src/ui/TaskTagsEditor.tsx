import { useTaskTags } from '../app/hooks'
import { parseTags, tagKey } from '../domain/tags'
import { CloseIcon, PlusIcon, TagIcon } from './icons'
import { Button } from './components/Button'
import { IconButton } from './components/IconButton'
import { input } from './styles'
import type { TaskForm } from './useTaskForm'

export function TaskTagsEditor({ form }: { form: TaskForm }) {
  const known = useTaskTags()
  const selected = new Set(form.werte.tags.map(tagKey))
  const suggestions = known.filter(tag => !selected.has(tagKey(tag)) && tagKey(tag).includes(tagKey(form.werte.tagText)))
  const add = (tag: string) => {
    if (!tag.trim()) return
    form.setzen('tags', parseTags([...form.werte.tags, known.find(value => tagKey(value) === tagKey(tag)) ?? tag]))
    form.setzen('tagText', '')
  }
  return <div className="min-w-0">
    <div className="flex min-h-11 items-center gap-3 px-2 text-body text-ink-muted"><TagIcon /><span>Tags</span></div>
    <div className="space-y-2 pl-10">
      {form.werte.tags.length ? <div role="group" className="flex flex-wrap gap-1" aria-label="Ausgewählte Tags">{form.werte.tags.map(tag => <Button key={tagKey(tag)} variant="secondary" size="sm" layout="max-w-full"
        aria-label={`Tag entfernen: ${tag}`} onClick={() => form.setzen('tags', form.werte.tags.filter(value => tagKey(value) !== tagKey(tag)))}><span className="min-w-0 break-words">{tag}</span><CloseIcon className="size-icon-meta" /></Button>)}</div> : null}
      <div className="flex min-w-0 items-center gap-1">
        <input aria-label="Neuer Tag" placeholder="Tag hinzufügen…" className={`${input} min-w-0 flex-1`} value={form.werte.tagText}
          onChange={event => form.setzen('tagText', event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); add(form.werte.tagText) } }} />
        <IconButton aria-label="Tag hinzufügen" variant="iconMuted" disabled={!form.werte.tagText.trim() || form.busy} onClick={() => add(form.werte.tagText)}><PlusIcon /></IconButton>
      </div>
      {suggestions.length ? <div role="group" className="flex flex-wrap gap-1" aria-label="Vorhandene Tags">{suggestions.map(tag => <Button key={tagKey(tag)} size="sm" variant="ghost" layout="max-w-full" title={`Tag „${tag}“ hinzufügen`}
        onClick={() => add(tag)}><span className="min-w-0 break-words">{tag}</span></Button>)}</div> : null}
    </div>
  </div>
}
