export function normalizeUsername(value: string): string { return value.trim().replace(/^@/, '').toLowerCase() }
export function validUsername(value: string): boolean { return /^[a-z0-9][a-z0-9_]{2,29}$/.test(value) }
