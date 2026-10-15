import type { Mutation } from './types'

export class MemTable {
  private readonly latestByKey = new Map<string, Mutation>()

  apply(mutation: Mutation): void {
    const current = this.latestByKey.get(mutation.key)
    if (!current || mutation.sequence > current.sequence) this.latestByKey.set(mutation.key, { ...mutation })
  }

  get(key: string): Mutation | undefined {
    const value = this.latestByKey.get(key)
    return value ? { ...value } : undefined
  }

  get size(): number { return this.latestByKey.size }

  drainSorted(): Mutation[] {
    const mutations = [...this.latestByKey.values()].sort((a, b) => a.key.localeCompare(b.key))
    this.latestByKey.clear()
    return mutations.map((mutation) => ({ ...mutation }))
  }

  sortedEntries(): Mutation[] {
    return [...this.latestByKey.values()].sort((a, b) => a.key.localeCompare(b.key)).map((mutation) => ({ ...mutation }))
  }
}
