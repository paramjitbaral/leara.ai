# Leara Platform Engine (Backend-Only)

This module adds non-UI platform capabilities while keeping the existing frontend layout unchanged.

## Added Feature Areas

1. Source Control Engine
- Endpoints: `/api/scm/*`
- Supports: status, diff, stage/unstage, commit, push/pull, branches, checkout, stash, conflicts.

2. Problems / Diagnostics Aggregator
- Endpoint: `GET /api/problems`
- Runs and normalizes diagnostics from `tsc`, `eslint`, and tests.

3. Task Runner Profiles
- Endpoints: `/api/tasks`, `/api/tasks/run`
- Project task config stored at `.leara/tasks.json`.

4. File Watcher + Incremental Indexing
- Endpoints: `/api/index/*`
- Symbol index is held in-memory and can be rebuilt/watched.

5. Semantic Intelligence APIs
- Endpoints: `/api/symbols/search`, `/api/symbols/info`, `/api/symbols/references`

6. Test Intelligence
- Endpoints: `/api/tests/discover`, `/api/tests/run`

7. Checkpoints + Rollback
- Endpoints: `/api/checkpoints/*`
- Snapshots under `.leara/checkpoints/`.

8. Policy/Safety Engine
- Internal policy used by managed command execution and guarded SCM push route.

9. Secrets Manager
- Endpoints: `/api/secrets/*`
- Stored in `.leara/secrets.json`.

10. Session/Project Memory
- Endpoints: `/api/memory`, `/api/memory/task`, `/api/memory/fix`

11. Terminal Orchestration
- Endpoints: `/api/terminals/*`
- Track running/completed jobs with stdout/stderr.

12. Action Transparency Log
- Endpoint: `GET /api/actions/logs`
- JSONL log at `.leara/action-log.jsonl`.

## Notes
- These are backend APIs and services. UI can consume them without any required visual/layout change.
- Existing agent endpoint `/api/agent/run` now records memory and action logs automatically.
