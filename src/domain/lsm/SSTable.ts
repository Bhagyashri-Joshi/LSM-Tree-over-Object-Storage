import type { Mutation, SSTableData, SSTableMetadata } from './types'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function serializeSSTable(entries: Mutation[]): Uint8Array {
  const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key) || a.sequence - b.sequence)
  const payload: SSTableData = { format: 'lsm-lab/sstable-v1', entries: sorted }
  return encoder.encode(JSON.stringify(payload))
}

export function deserializeSSTable(data: Uint8Array): SSTableData {
  let parsed: unknown
  try { parsed = JSON.parse(decoder.decode(data)) } catch { throw new Error('Invalid SSTable payload: not JSON') }
  if (!parsed || typeof parsed !== 'object' || (parsed as SSTableData).format !== 'lsm-lab/sstable-v1' || !Array.isArray((parsed as SSTableData).entries)) {
    throw new Error('Invalid SSTable payload: unsupported format')
  }
  const entries = (parsed as SSTableData).entries
  for (const entry of entries) {
    if (!entry || typeof entry.key !== 'string' || typeof entry.sequence !== 'number' || !['put', 'delete'].includes(entry.kind) || (entry.kind === 'put' && typeof entry.value !== 'string') || (entry.kind === 'delete' && entry.value !== null)) {
      throw new Error('Invalid SSTable payload: invalid entry')
    }
  }
  return { format: 'lsm-lab/sstable-v1', entries: entries.map((entry) => ({ ...entry })) }
}

export function createSSTableMetadata(id: string, objectKey: string, level: number, entries: Mutation[], sizeBytes: number): SSTableMetadata {
  if (entries.length === 0) throw new Error('Cannot create an SSTable with no entries')
  const sequences = entries.map((entry) => entry.sequence)
  return { id, objectKey, level, entryCount: entries.length, minSequence: Math.min(...sequences), maxSequence: Math.max(...sequences), sizeBytes }
}
