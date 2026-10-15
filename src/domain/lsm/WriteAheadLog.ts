import type { Mutation, WalEntry } from './types'

/** In-memory WAL with replayable, ordered records for deterministic recovery tests. */
export class WriteAheadLog {
  private entries: WalEntry[] = []

  append(mutation: Mutation): void {
    this.entries.push({ ...mutation })
  }

  replay(): WalEntry[] {
    return this.entries.map((entry) => ({ ...entry }))
  }

  get lastSequence(): number {
    return this.entries[this.entries.length - 1]?.sequence ?? 0
  }
}
