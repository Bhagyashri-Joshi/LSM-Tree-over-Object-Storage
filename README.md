# LSM Lab

LSM Lab is an educational, browser-based system-design simulator for exploring an LSM-tree storage engine over **simulated, in-memory object storage**. It visualizes a deterministic write/read lifecycle, WAL, MemTable, SSTable flushes, full-catalogue compaction, metrics, and guided experiments. It has no cloud provider, backend, credentials, or external persistence.

## Architecture

The project deliberately separates its concerns:

- `src/domain/lsm/`: WAL, MemTable, SSTable serialization, and the deterministic LSM engine.
- `src/domain/object-storage/`: the explicitly simulated in-memory object store and failure injection.
- `src/simulation/`: workload generation, clock, controller, metrics, flow mapping, and experiment comparisons.
- `src/canvas/` and `src/ui/`: React/SVG rendering, controls, inspector, events, and educational panels.

React components render controller snapshots; they do not contain storage-engine behavior. The custom SVG canvas is a visualization of the actual simulation state.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Run locally

```bash
npm ci
npm run dev
```

Open the local address Vite prints in the terminal.

## Commands

```bash
npm run dev       # development server
npm run build     # TypeScript check and production build
npm run preview   # preview a production build
npm test          # run the Vitest suite once
```

## Current capabilities

- Responsive dark application shell with component palette and metrics toolbar
- SVG topology canvas with connected Client, LSM Engine, MemTable, and Object Storage nodes
- Working canvas pan, zoom, and reset-view controls
- Editable offered-load setting and functional Start, Pause, Step, and Reset controls
- Initial domain types for topology, status, connections, and metric snapshots
- Simulated in-memory object storage with prefix listing, bytes/operation accounting, fixed latency, and deterministic failure injection
- WAL-backed `PUT`, `UPDATE`, `DELETE` (tombstone), `GET`, memtable flushing, SSTable serialization, and explicit compaction
- Deterministic, repeatable workloads: Write-heavy, Read-heavy, Burst writes, and Compaction pressure
- Functional Start, Pause, Step, and Reset controls with a simulated clock, live event log, topology highlights, and actual engine/storage metrics

## Running a simulation

Start the development server with `npm run dev`. Choose a workload in the toolbar, then use:

- **Start** to execute operations at the selected offered-load cadence.
- **Pause** to stop automatic execution without clearing state.
- **Step** to run exactly one deterministic operation.
- **Reset** to recreate the engine, simulated object store, clock, and workload from the same seed.

The event log records chronological simulated timestamps, operation details, flush/compaction events, and storage failures. The canvas highlights active topology paths based on the actual operation just completed.

## Interactive architecture canvas

The canvas retains pan, zoom, and reset-view controls. Select any topology component with a mouse click, `Enter`, or `Space` to open its read-only inspector:

- **Client:** completed, successful, and failed operation counters.
- **LSM Engine:** runtime status, MemTable/SSTable counts, and implemented request types.
- **MemTable:** currently buffered mutations, including tombstones and sequence numbers.
- **WAL:** recent replayable mutation records.
- **SSTables:** active table IDs, levels, entry counts, and object sizes.
- **Compaction:** actual flush/compaction counts and write amplification.
- **Object Storage:** simulated object keys and sizes.

The legend distinguishes write, read, flush, compaction, and failed paths. Active paths animate with a restrained dashed motion based on the most recent real event; the animation is disabled when the browser requests reduced motion.

## Educational scenarios and parameter tuning

The **Experiments** panel is part of the live simulator view. It contains four guided scenarios: Smaller MemTable, Write-heavy vs read-heavy, Burst writes, and Compaction cost. Every scenario states an objective, setup, hypothesis, and conclusion; hypotheses describe what to look for and are not promises about every configuration.

Supported tuning inputs reset the live simulation before taking effect:

- **MemTable entries:** the actual unique-key threshold that triggers a flush.
- **Operation count:** the number of deterministic workload operations to generate.
- **Seed:** the deterministic workload generator seed.

The current engine flushes the entire MemTable as one SSTable, so an independent SSTable byte/batch limit is intentionally marked unavailable. Its compaction strategy is a fixed full-catalogue merge, so alternate strategy controls are also intentionally unavailable.

Use **Compare** to run two isolated configurations. Both sides use the same selected workload, seed, and operation count; only the active tuning configuration and scenario baseline can differ. Results never replace the live canvas run and report completed/failed operations, flushes, compactions, throughput, p99 latency, simulated object operations and bytes, and write amplification.

The comparison uses the same metric formulas as the live run. In particular, write amplification is `SSTable bytes uploaded ÷ logical bytes in successful client writes`; it includes compaction rewrites. These are deterministic educational simulations, not production benchmarks.

## Live metric formulas

- **Completed / successful / failed operations:** counted from actual controller results.
- **Throughput:** `successful operations ÷ simulated elapsed seconds`.
- **Latency:** deterministic logical operation time: `1 ms + object-store operations caused by that request`; p99 is the 99th percentile of these samples.
- **Flushes / compactions:** lifecycle events emitted by the LSM engine.
- **Object operations and bytes:** counters from the simulated object store, including upload, read, list, delete, stored, and uploaded bytes.
- **Write amplification:** `SSTable bytes uploaded to simulated object storage ÷ logical bytes in successful client write requests`. It includes compaction rewrites and remains `0` before the first successful logical write.

## Storage lifecycle

Each write is single-threaded and deterministic:

1. The engine assigns a strictly increasing sequence number.
2. It appends the mutation to the supplied Write-Ahead Log (WAL).
3. It applies the mutation to the MemTable.
4. When the configured unique-key threshold is reached, the engine serializes a stable, key-sorted SSTable and uploads it to the simulated object store.
5. Only after upload success does it publish SSTable metadata and clear the MemTable entries.

Reads first consider the MemTable, then every active SSTable, choosing the highest sequence number. Tombstones therefore remain authoritative across flushes. Compaction reads the complete active catalogue, writes the replacement table before publishing it, and only then deletes obsolete objects. Because every active table participates, tombstones may be removed safely when no live values remain.

## Durability assumptions and limitations

- The `WriteAheadLog` is an in-memory, replayable model. Restart recovery is demonstrated only when the same WAL instance is supplied to a new engine instance.
- The object store is explicitly simulated and in-memory. It does not claim S3/MinIO compatibility, network durability, or real crash safety.
- SSTable catalogue metadata is held in the engine process. WAL replay restores the latest mutations into a fresh MemTable, but catalogue persistence is not yet modeled.
- Operations are deliberately synchronous from the engine's point of view; no background flushing, concurrent writes, range scans, Bloom filters, or production compaction policy are included.
- The simulated clock and latency are educational models, not wall-clock benchmarks. The Stage 3 runner has no request queue, backpressure model, or persistent scenario storage.
- The inspector exposes only the current in-memory engine catalogue and simulated-store metadata. It does not reconstruct historical SSTables, provide table-block contents, or create controls for unsupported manual storage operations.
- Comparison runs are synchronous isolated simulations. They do not model concurrent clients, queues, cloud latency distributions, or persistent experiment history.

## Tests

The Vitest suite covers app rendering, canvas inspection and failure states, flow mapping, deterministic workloads, comparisons, parameter validation, reset/reproducibility behavior, empty workloads, overlapping-step protection, object-store prefix filtering, missing-object errors, injected failures, PUT/GET, updates, tombstones, flush thresholds, serialization, compaction, failed uploads, and WAL replay.

## Deployment with Vercel

The repository includes `vercel.json` with a single-page-app rewrite to `index.html`. No environment variables, cloud credentials, or backend configuration are required.

1. Create a GitHub repository and push this project:

   ```bash
   git init
   git add .
   git commit -m "Initial LSM Lab simulator"
   git branch -M main
   git remote add origin https://github.com/<your-account>/<your-repository>.git
   git push -u origin main
   ```

2. In the [Vercel dashboard](https://vercel.com/new), select **Add New → Project** and import the GitHub repository.
3. Leave the detected framework as **Vite**. Vercel should use `npm run build` and publish `dist`.
4. Do not add environment variables; the simulator has no secrets or remote service configuration.
5. Select **Deploy**. After Vercel reports a successful deployment, open the generated URL and verify that the canvas, Start/Step controls, inspector, and experiment panel load.
6. Subsequent pushes to `main` trigger new deployments; preview deployments are created for pull requests when enabled in Vercel.

This repository is configured for deployment, but it has not been deployed by this task.

## Security and configuration

No API keys, AWS credentials, database passwords, or environment files are required or included. Keep any future local environment files outside version control; `.local` files and `.vercel` metadata are ignored.
