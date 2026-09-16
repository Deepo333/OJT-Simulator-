# Career Forge — Stage 1

Turn a real job listing into a structured competency map. This repository
is Stage 1 of a 6-stage build; the goal here is to prove the architectural
pattern end-to-end with **one working feature**: Job Analysis.

## Tech stack

- **Next.js 15** (App Router, Server Actions, TypeScript strict mode)
- **Prisma** ORM on **SQLite** (schema designed to migrate cleanly to Postgres)
- **Tailwind CSS** + **shadcn/ui** primitives
- **Zod** for runtime validation
- **@anthropic-ai/sdk** for AI, using tool-use for structured outputs

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env.local
# then edit .env.local and set ANTHROPIC_API_KEY

# 3. Initialize the database (creates prisma/dev.db + Prisma client)
npx prisma migrate dev --name init

# 4. Seed the demo user (optional but recommended)
npm run db:seed

# 5. Run the dev server
npm run dev
```

Open http://localhost:3000, paste the sample listing from
`examples/sample-job.txt` into the form, submit, and you'll be redirected
to `/jobs/<id>` with a full competency map.

## Required environment variables

| Variable            | Purpose                                    | Required |
| ------------------- | ------------------------------------------ | -------- |
| `DATABASE_URL`      | Prisma datasource. Defaults to SQLite.     | yes      |
| `ANTHROPIC_API_KEY` | Anthropic API key for the analyzer.        | yes      |
| `ANTHROPIC_MODEL`   | Model id override for the analyzer.        | no       |

`GET /api/health` returns `200` when the DB is reachable and
`ANTHROPIC_API_KEY` is set; `503` otherwise.

## Project structure

```
app/                    Next.js routes and pages
  page.tsx              Home — the job-analysis form
  jobs/[id]/page.tsx    Results view for one analyzed listing
  api/health/route.ts   DB + env health check
components/
  ui/                   shadcn/ui primitives (button, card, input, …)
  features/             Feature components (JobAnalysisForm, JobAnalysisView)
lib/
  ai/                   Anthropic client, prompts, structured analyzer
  db/prisma.ts          Prisma singleton
  schemas/              Zod schemas shared between AI outputs and DB
modules/
  job-analysis/         Stage 1 module (Server Action + types)
  skills-gap/           Stage 2 stub
  curriculum/           Stage 3 stub
  assignments/          Stage 4 stub
  coach/                Stage 5a stub
  evaluation/           Stage 5b stub
  portfolio/            Stage 6 stub
prisma/
  schema.prisma         All models (Stage-1 uses User, JobListing, CompetencyMap)
  seed.ts               Demo user seed
examples/
  sample-job.txt        Ready-to-paste sample listing
```

The `modules/` directory is the "one feature per folder" contract: each
future stage adds a new module without touching the ones that came before.
The `CompetencyMap` DB row is the interface between Stage 1 and Stage 2 —
Stage 2 reads it, it doesn't reach into Stage 1's code.

## Data model

Even though Stage 1 only writes `User`, `JobListing`, and `CompetencyMap`,
the full schema for Stages 2–6 is declared in `prisma/schema.prisma`
today. This locks the shape in and avoids painful reshuffles later.

- `User` — email, name, currentRole, currentSkills (JSON string).
- `JobListing` — raw text plus optional sourceUrl.
- `CompetencyMap` — the analyzer's structured output (one per listing).
- `SkillsGap`, `Curriculum`, `Assignment`, `AssignmentSubmission`,
  `PortfolioItem` — declared with FKs, no logic yet.

SQLite has no native array type, so all list-shaped fields are stored as
JSON-encoded strings. Migrating to Postgres is a one-line change to the
Prisma datasource plus (optionally) flipping those columns to native `Json`
in a follow-up migration.

## How the AI call works

1. `analyzeAndPersistJob` (Server Action) validates the form with Zod,
   ensures the demo user exists, and creates a `JobListing` row up front
   so a failed AI call still leaves a record.
2. `lib/ai/analyze-job.ts` calls Claude with:
   - a rigorous system prompt (`lib/ai/prompts.ts`),
   - a JSON schema handed to the model as an Anthropic **tool** with
     `tool_choice: { type: "tool", name: "return_competency_map" }` — this
     forces the model to emit structured JSON,
   - one retry on schema-validation failure with the specific Zod errors
     fed back into the conversation.
3. The tool_use payload is validated against `competencyMapSchema`
   (Zod). Only a validated result is persisted.
4. The route redirects to `/jobs/[id]` where the results render.

## What's next

Stages 2–6 (one module per stage):

- **Stage 2 — Skills-gap analysis.** Compare `CompetencyMap` with
  `User.currentSkills` to produce a `SkillsGap` row with three buckets:
  has / partial / needs-to-learn.
- **Stage 3 — Curriculum generation.** Build a week-by-week OJT plan
  from the CompetencyMap + SkillsGap, in `TRADITIONAL` or `AI_AUGMENTED`
  mode.
- **Stage 4 — Assignments.** Instantiate realistic work assignments
  from the curriculum, with a submission → evaluation → iteration loop.
- **Stage 5 — Coach + Evaluation.** Streaming AI coach scoped to a
  single assignment; an evaluator that scores submissions and feeds
  back into the curriculum.
- **Stage 6 — Portfolio.** Turn evaluated submissions into a shareable
  portfolio that proves competency for the target role.
