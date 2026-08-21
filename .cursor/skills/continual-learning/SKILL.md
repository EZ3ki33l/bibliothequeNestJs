---
name: continual-learning
description: Orchestrate continual learning by delegating transcript mining and AGENTS.md updates to `agents-memory-updater`.
disable-model-invocation: true
---

# Continual Learning

Manuel uniquement (`/continual-learning`). Pas de hook `stop` : ne pas lancer ça tout seul en fin de tour.

## Workflow

1. Call `agents-memory-updater`.
2. Return the updater result.

## Guardrails

- Keep the parent skill orchestration-only.
- Do not mine transcripts or edit files in the parent flow.
- Do not bypass the subagent.
- Only add or update `## Learned User Preferences` and `## Learned Workspace Facts` in `AGENTS.md`. Do not rewrite `.cursor/rules/`.
