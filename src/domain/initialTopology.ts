import type { SimulationTopology } from './simulation'

export const initialTopology: SimulationTopology = {
  components: [
    { id: 'client', kind: 'client', label: 'Client', category: 'traffic', position: { x: 30, y: 220 }, description: 'Generates reads and writes.' },
    { id: 'lsm-engine', kind: 'lsm-engine', label: 'LSM Engine', category: 'compute', position: { x: 240, y: 220 }, description: 'Coordinates read and write paths.' },
    { id: 'memtable', kind: 'memtable', label: 'MemTable', category: 'data', position: { x: 460, y: 110 }, description: 'An in-memory write buffer.' },
    { id: 'wal', kind: 'wal', label: 'WAL', category: 'data', position: { x: 240, y: 65 }, description: 'Ordered replayable mutations.' },
    { id: 'sstables', kind: 'sstable', label: 'SSTables', category: 'data', position: { x: 660, y: 110 }, description: 'Sorted immutable table objects.' },
    { id: 'compaction', kind: 'lsm-engine', label: 'Compaction', category: 'compute', position: { x: 660, y: 310 }, description: 'Merges active table versions.' },
    { id: 'object-storage', kind: 'object-storage', label: 'Object Storage', category: 'data', position: { x: 860, y: 310 }, description: 'Simulated durable SSTable storage.' },
  ],
  connections: [
    { id: 'client-engine', sourceId: 'client', targetId: 'lsm-engine', label: 'requests', status: 'idle' },
    { id: 'engine-wal', sourceId: 'lsm-engine', targetId: 'wal', label: 'append', status: 'idle' },
    { id: 'engine-memtable', sourceId: 'lsm-engine', targetId: 'memtable', label: 'buffer', status: 'idle' },
    { id: 'memtable-sstables', sourceId: 'memtable', targetId: 'sstables', label: 'flush', status: 'idle' },
    { id: 'sstables-storage', sourceId: 'sstables', targetId: 'object-storage', label: 'objects', status: 'idle' },
    { id: 'sstables-compaction', sourceId: 'sstables', targetId: 'compaction', label: 'merge', status: 'idle' },
    { id: 'compaction-storage', sourceId: 'compaction', targetId: 'object-storage', label: 'replace', status: 'idle' },
    { id: 'engine-storage', sourceId: 'lsm-engine', targetId: 'object-storage', label: 'SSTables', status: 'idle' },
  ],
}
