export type ClassValue = string | number | null | undefined | false | ClassValue[] | Record<string, boolean | undefined | null>

export function clsx(...values: ClassValue[]): string {
  const out: string[] = []

  for (const value of values) {
    if (!value) continue
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value))
    } else if (Array.isArray(value)) {
      const nested = clsx(...value)
      if (nested) out.push(nested)
    } else if (typeof value === 'object') {
      for (const [key, enabled] of Object.entries(value)) {
        if (enabled) out.push(key)
      }
    }
  }
  return out.join(' ')
}
