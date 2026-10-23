import type { DayCapacity } from '../domain/calendar'

export const calendarCapacityText = (capacity?: DayCapacity) => capacity === 'low' ? 'Wenig Zeit' : capacity === 'none' ? 'Keine Zeit' : 'Normale Zeit'
