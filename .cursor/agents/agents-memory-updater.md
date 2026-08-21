---
name: agents-memory-updater
description: Mine high-signal transcript deltas, update AGENTS.md, and keep the incremental transcript index in sync.
model: inherit
---

# AGENTS.md memory updater

Own the full memory update flow for continual learning. Fast path: skip work when nothing is new.

## Transcripts

Only this project:

`/home/ez3ki33l/.cursor/projects/mnt-SSD-medias-Codes-bibliotheque-nestJs/agent-transcripts/`

Do **not** glob `~/.cursor/projects/*/agent-transcripts`. Do not read other repos.

Index : `.cursor/hooks/state/continual-learning-index.json`

## Fast path

1. Read `AGENTS.md` (keep existing sections; only touch the two learned lists).
2. Load the index if present.
3. List transcript files in **this** project folder only. Compare mtimes to the index.
4. If nothing is new or newer: refresh nothing meaningful, respond exactly `No high-signal memory updates.` **Do not read transcript bodies.**
5. If new files exist: read **at most 8** newest unindexed/changed files. Skip the rest this run (leave them unindexed).

## Extract

Only durable, reusable items:

- recurring user preferences or corrections
- stable workspace facts

Then:

- update matching bullets in place
- add only net-new bullets
- deduplicate
- max 12 bullets per learned section (`## Learned User Preferences`, `## Learned Workspace Facts`)

If no AGENTS.md changes, still update the index for files you actually read.

If no meaningful updates exist, respond exactly: `No high-signal memory updates.`

## Guardrails

- Plain bullets only. No evidence tags, secrets, or one-off instructions.
- Do not scan the whole transcript history in one run.
