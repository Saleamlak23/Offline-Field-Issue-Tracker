# Fieldnote: Offline Field Issue Tracker

Fieldnote is an offline-ready issue reporting app for field workers and coordinators. Field workers can create and review reports without a connection; reports are stored in the browser and synchronized with a local Express/SQLite API when connectivity returns. Coordinators review server-side reports and advance them through a status workflow.

## Requirements

- Node.js and npm
- A modern browser with IndexedDB support

## Setup and Run

From the repository root, install dependencies:

```sh
npm install
```

Start the backend and frontend in separate terminals, both from the repository root:

```sh
npm run dev:backend
```

```sh
npm run dev:frontend
```

Open <http://localhost:5173>. The backend listens on port `3000`; Vite forwards `/api` requests to it. The backend creates its SQLite schema automatically. By default, its database is `backend/data/reports.sqlite`.

Optional environment settings:

- `PORT` changes the backend port (default `3000`).
- `DB_PATH` changes the SQLite file path. Relative paths are resolved from the backend package directory.

## Demo Data

Run the seed script from the repository root:

```sh
npm run seed
```

It creates six example reports with different categories, priorities, statuses, and event histories. The command creates the database and schema if needed. It is safe to run again: examples already present are skipped.

## Tests and Builds

Run the test suites from the repository root:

```sh
npm run test:backend
npm run test:frontend
```

The backend tests cover validation, allowed status transitions, API behavior, and duplicate/concurrent report creation. The frontend tests cover local persistence, sync behavior, and coordinator interactions.

The tests prioritize data safety and workflow boundaries: validation and local persistence help catch malformed or lost reports, idempotency tests guard against duplicates after interrupted requests, and transition tests protect coordinator decisions. The frontend retry tests cover recovery after temporary connectivity failures.

Build each application with:

```sh
npm run build:backend
npm run build:frontend
```

There is no root `npm test` script; run the two test commands above.

## Architecture

The repository is an npm workspace with three packages:

- `frontend/`: React, TypeScript, and Vite UI.
- `backend/`: Express API and SQLite persistence via `better-sqlite3`.
- `shared/`: shared report types, validation, and status transition rules.

The browser's Dexie/IndexedDB database is the durable store for field-worker reports and their local events. The frontend reads reports from that store, while `syncService` handles delivery and retry policy. `apiClient` handles HTTP calls. The backend validates requests, applies workflow rules, and records reports and events in SQLite.

```text
Field-worker UI -> IndexedDB/localStore -> syncService -> Express API -> SQLite
Coordinator UI ---------------------------------------> Express API
```

The coordinator view uses the server API directly and does not have an offline cache. The role switch is for navigation only; it is not authentication or authorization.

## Synchronization Strategy

1. Creating a report writes it and its history to IndexedDB before any network request. Drafts remain on the device until submitted; submitted reports are immediately visible locally and queued for sync.
2. Sync runs when the app is online at startup, when connectivity changes back to online, every 15 seconds while online, or when the user requests a sync.
3. Each report is sent individually to `POST /api/reports`. Its client-generated UUID is a stable idempotency key; the server enforces uniqueness and returns the existing report for a repeated request rather than inserting a duplicate.
4. Successful reports remain in IndexedDB and are marked synced. Transient failures are marked failed and retried with exponential delays capped at 30 seconds. Non-transient failures are retained for manual correction/retry. A sync timeout is set to 8 seconds.

Each report syncs independently, so one failed request does not prevent other reports from being sent. The coordinator changes status on the server; the client does not pull coordinator changes into an offline cache.

## Status Workflow

```text
Draft -> Submitted -> Assigned -> In Progress -> Resolved
                         |            |
                         +------------+-> Rejected
Resolved -> In Progress       Rejected -> Submitted
```

The shared transition rules are enforced by the API. Rejection requires a reason. Reopening a resolved report moves it to `In Progress`; reopening a rejected report moves it to `Submitted`. Successful transitions are recorded in the report event history.

## Assumptions and Design Decisions

- Field-worker reports must be durable and viewable offline; coordinator actions require a live backend connection.
- Drafts are stored only on the field device; submitting a draft queues it for the normal idempotent sync flow.
- A client UUID identifies one logical report across retries and prevents duplicate server records.
- Report content can be edited locally only before the server has accepted it. After sync, the coordinator controls status; there is no content-edit or merge workflow.
- The simulated role switch has no security boundary. This app is a local demonstration, not a production access-control system.
- SQLite keeps local development self-contained and requires no separate database service.

## Known Limitations

- No authentication or server-side role authorization.
- Coordinator workflows do not work offline; there is no inbound synchronization.
- No post-sync content editing or conflict-resolution UI.
- No attachments, camera uploads, or GPS capture.
- Sync sends one report per request and is intended for demonstration-scale use.
- SQLite is file-based and suited to a single local server process, not a multi-instance deployment.
- IndexedDB availability and browser storage eviction are not specially handled.

## Manual QA Checklist

- [ ] Create a report online; verify it appears locally and reaches the synced state.
- [ ] Turn on the app's offline simulation, create multiple reports, and refresh; verify they remain visible.
- [ ] Restore connectivity; verify pending reports sync and do not create duplicates in Coordinator.
- [ ] Open Coordinator while offline; verify the UI reports that connectivity is required.
- [ ] Advance a report through valid status changes and verify its history updates.
- [ ] Attempt an invalid transition through the API; verify it is rejected without changing status.
- [ ] Reject a report without a reason; verify the UI/API requires one.
- [ ] Reopen resolved and rejected reports; verify the destination status and `REOPENED` event.
- [ ] Stop the backend, attempt a sync, then restart it; verify the failure is visible and retry succeeds.
- [ ] Submit invalid field values; verify client-side validation prevents saving or sending them.
- [ ] Save a report as a draft, refresh, and verify it remains a local draft without being sent to the server.
- [ ] Edit a saved draft, submit it, then verify it enters the sync queue and reaches Coordinator after connectivity is available.

## Time and Future Improvements

Approximate time spent: **1.5 hours**.

With more time, I would add authentication and server-enforced roles, offline coordinator support with inbound synchronization and revision-based conflict detection, background sync, audit records for rejected transition attempts, batched sync, and attachment/GPS support.

## AI and Development-Tool Disclosure

ChatGPT (Codex), **GPT 6 Luna Medium**, was used for development assistance across both the frontend and backend. In this review, Codex compared the exercise requirements with the repository and identified that workers could not save drafts, and that the README needed clearer testing priorities and disclosure details.

The accepted recommendations in this review were to add a locally saved, editable draft that enters the sync queue only after submission, document the Draft → Submitted path, and explain why tests prioritize persistence, idempotency, validation, workflow transitions, and sync recovery. The documentation and feature work were developed on `fix/submission-documentation` and `feature/draft-report-workflow`, then the feature branch was merged into the documentation branch. No suggestions were explicitly rejected during this review.

The implementation was reviewed against the shared status rules and local persistence and sync code. The frontend production build completed successfully; automated test suites were not run during this review. Development tools included VS Code, Node.js/npm, TypeScript, Vite, Vitest, and SQLite. The project author is responsible for reviewing and validating all submitted code.
