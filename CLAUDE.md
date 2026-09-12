# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Learning app: **stacks** (e.g. React) contain **categories**, which contain **entries** (fiches). Two independent apps — not a pnpm workspace:

| Dir         | Role                                          | Port |
| ----------- | --------------------------------------------- | ---- |
| `backend/`  | NestJS 11 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL | 4000 |
| `frontend/` | Vite + React 19 + HeroUI 3 + Tailwind 4 SPA   | 5173 |

Each has its own `package.json` and its own `pnpm-workspace.yaml` (for `allowBuilds`/overrides) — run all commands from inside `backend/` or `frontend/`, never from root. Auth is [better-auth](https://www.better-auth.com/) (email/password, session cookie). Public reads are open; **reviews** live under `/reviews/...` (session, not admin); **quizzes** under `/quizzes/...` (session, not admin); admin writes/reads under `/admin/...` (session + admin role).

## Commands

### Backend (`cd backend`)

- `pnpm start:dev` — API in watch mode
- `pnpm build` / `pnpm start:prod` — build then run prod
- `pnpm test` — unit tests (services, `slugify`, `scheduleReview`, `scoreQuiz`, `LlmQuizGenerator`); coverage threshold is 90% on `**/*.service.ts` and `common/**/*.ts`
- `pnpm test -- <path or -t "name">` — run a single test file or test name (Jest passthrough)
- `pnpm test:cov` — coverage report
- `pnpm test:e2e` — e2e tests (401 admin guards, reviews, quizzes) — Prisma and `getSession` are mocked in e2e because Prisma 7 WASM + better-auth ESM break under Jest
- `pnpm db:generate` — regenerate Prisma client into `src/generated` (gitignored)
- `pnpm db:migrate` — apply migrations
- `pnpm db:seed` — demo data + promotes `ADMIN_EMAIL` to admin (register the account first, then reseed)
- `pnpm lint` / `pnpm format` — ESLint / Prettier

### Frontend (`cd frontend`)

- `pnpm dev` — Vite dev server
- `pnpm build` — `tsc -b && vite build`
- `pnpm lint` — oxlint
- `pnpm format` — Prettier (root `prettier.config.mjs` resolves `prettier-plugin-tailwindcss` from `frontend/` — don't add that plugin to the backend, it would break `pnpm format` there)

Root `.env` for frontend: `VITE_API_URL=http://localhost:4000`. Backend `.env` (never commit) needs `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `FRONTEND_ORIGIN`, `ADMIN_EMAIL`, and optionally `QUIZ_LLM_API_KEY`/`QUIZ_LLM_BASE_URL`/`QUIZ_LLM_MODEL` (missing key → 503 at generation time, not at boot).

## Architecture

### Backend: feature modules

One domain = one folder under `backend/src/` (`stacks/`, `categories/`, `entries/`, `reviews/`, `quizzes/`, `auth/`, `common/`), each with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`. Admin writes/reads live in separate `admin-*.controller.ts` files inside the same feature folder (public GETs stay in the plain controller). Every feature module is imported into `AppModule`. Controllers stay thin (HTTP only); business logic is in services; Prisma is only ever called from services, never controllers. DTOs are `class-validator` classes, not Zod, not raw interfaces (interfaces vanish at runtime — validation needs a class).

Flow: request → global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) + DTO → controller → service → Prisma → response DTO (never a raw Prisma model — `password`/hashes/tokens must never leak).

`backend/src/common/` holds cross-cutting pure logic reused by services: `slugify`, `scheduleReview` (SM-2 spaced-repetition calendar), `scoreQuiz`.

Slug and `position` are always computed **server-side** (`position` only at creation). Entry slugs are unique globally. PATCH endpoints never accept a parent-changing field (`stackId`/`categoryId` absent from update DTOs) — reparenting isn't supported.

### Auth & security (`backend/src/main.ts`, `backend/src/auth/`)

No `AuthModule` — better-auth is mounted directly in `main.ts` via `toNodeHandler` at `/api/auth/*`, alongside `SessionGuard`/`AdminGuard`. `main.ts` creates the Nest app with `bodyParser: false` because better-auth needs the raw request body; the JSON body parser is re-attached after for the rest of the API — middleware order matters here. Order in `main.ts`: `helmet()` first, then CORS (single explicit `FRONTEND_ORIGIN` origin + `credentials: true` — never `origin: '*'` with credentials), then the global `ValidationPipe`. Rate limiting: `ThrottlerModule` (100 req/min on Nest routes) plus `express-rate-limit` (10 POST/15min) specifically on `/api/auth/sign-in` and `sign-up`.

`SessionGuard` gates `reviews/` and `quizzes/` (any logged-in user); `AdminGuard` gates `admin/*` routes. IDOR is prevented by scoping every review/quiz lookup to the session's `userId` and returning **404** (not 403) for another user's resource, an unknown one, or one no longer eligible — this avoids revealing existence. There's no "forgot password" flow (`sendResetPassword` not wired); the seed only promotes `ADMIN_EMAIL`, it never touches password hashes.

### Quizzes (LLM generation)

`POST /quizzes/start` generates a QCM from the published entry's `bodyMdx` (Groq, OpenAI-compatible) only if there's no attempt in progress; an in-progress attempt is resumed without a new generation call. Body under 80 chars (trimmed) → `{ attempt: null }` (empty state, no row created). Any generator failure (missing key, timeout, provider error, invalid JSON) → **503**, fail-closed, no attempt persisted. `ConfigModule` reads `.env` at boot — restart the server after changing quiz LLM env vars.

### Frontend: pages = routes

`App.tsx` is the route table; one page = one file in `frontend/src/pages/` (admin pages under `pages/admin/`). Layouts nest via `<Outlet />`: `AppLayout` (sidebar + footer) wraps the public catalogue, learner pages (`/review`, `/entries/:slug/exam`) and `/recherche`; `AuthLayout` and `AdminLayout` sit on top of it. HeroUI 3 dark theme requires `class="dark"` on `<html>` in `frontend/index.html` (`color-scheme: dark` alone isn't enough) — don't redefine `--background`/`--foreground` outside a layer, it overrides HeroUI tokens.

Guards are route-specific and never rely on `useSession()` alone:
- Learner routes (`/review`, `/entries/:slug/exam`) check `GET /me` (401 → `/login`).
- Admin routes check `GET /admin/me` (401 → `/login`, 403 → refuse).

`frontend/src/lib/` holds one file per API concern (`stacks.ts`, `admin.ts`, `reviews.ts`, `quizzes.ts`) built on `apiFetch` with `credentials: 'include'`; `frontend/src/lib/auth.ts` is the better-auth client (must stay on the same major/minor as the backend's better-auth). Entry bodies render through `EntryMdx` (`react-markdown` `MarkdownHooks` + `rehype-pretty-code`/Shiki — the synchronous `Markdown` component breaks with this async plugin chain); a Sandpack `Playground` renders below the content when `kind !== CONCEPT` and `files` isn't empty. Admin forms for `files`/`dependencies` use `AdminKeyValueList` (path+code, package+version) and a Sandpack template `<select>` — never raw escaped JSON.

### Migration context

This project was migrated from a Next.js sibling app (`bibliotheque/`) — domain names (stacks/categories/entries) and frontend visual design intentionally mirror it, but there is no App Router, no Next-style `src/app/.../page.tsx`, and no SSR here.

### Speckit workflow

Features are specified under `specs/00N-feature-name/` (spec/plan/tasks) using the Speckit templates in `.specify/`. When asked to implement "phase N" of a spec, check the actual working tree against `tasks.md` checkboxes first (an unchecked box doesn't always mean the code is missing).

## Conventions (from `.cursor/rules/`)

- **French, impersonal tone** in UI text and explanatory comments: neither `tu` nor `vous` — rephrase around the neutral subject (e.g. "le formulaire" not "vous devez").
- **Security is not optional**: every feature ships its guard with it (DTO validation, ownership checks) — don't add an endpoint "insecure for now, hardened later." Prefer fail-closed over fail-open. Never use `$queryRawUnsafe` with interpolated input; never return password hashes/tokens; passwords are Argon2id only.
- TypeScript strict, no `any`; Nest exceptions (`NotFoundException`, etc.), not `throw new Error()`; `Logger`, not `console.log`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
