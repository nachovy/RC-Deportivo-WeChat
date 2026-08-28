export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}
