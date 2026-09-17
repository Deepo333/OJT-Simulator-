# Career Forge — Stages 1 & 2

Turn a real job listing into a personalized on-the-job-training curriculum.

**Stage 1** analyzes a pasted job listing into a structured competency map.
**Stage 2** builds the user's profile from a resume upload, calibrates real
confidence via a 15-question questionnaire, and produces a personalized
curriculum roadmap. Stages 3–6 (lesson content, assignments, coach,
portfolio) plug in on top.

## Tech stack

- **Next.js 15** (App Router, Server Actions, TypeScript strict mode)
- **Prisma** ORM on **Postgres** (Prisma Postgres on Vercel in prod)
- **Tailwind CSS** + shadcn/ui primitives
- **Zod** for runtime validation everywhere the AI writes
- **@anthropic-ai/sdk** — Claude via tool-use for structured outputs
- **pdf-parse** + **mammoth** for resume text extraction

## Getting started

```bash
cp .env.example .env.local
# then edit .env.local: set DATABASE_URL to your Postgres URL and
# set ANTHROPIC_API_KEY.

npm install
npx prisma db push        # applies the schema to your DB
npm run db:seed           # optional — creates the demo user
npm run dev
```

Open http://localhost:3000, paste `examples/sample-job.txt`, and follow
the flow through to your curriculum.

## Build & deploy (Vercel)

The `build` script is `prisma generate && prisma db push && next build` —
`prisma db push` runs on every deploy so schema changes take effect on the
live database without a migration folder. For local build checks without
touching the DB, use `npm run build:local`.

## Required environment variables

| Variable            | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `DATABASE_URL`      | Postgres connection URL.                   |
| `ANTHROPIC_API_KEY` | Anthropic API key for every AI call.       |
| `ANTHROPIC_MODEL`   | Optional. Override the default model id.   |

`GET /api/health` returns `200` when DB is reachable and the API key is set.

## User flow

1. **`/`** — Home. Paste a job listing.
2. **`/jobs/[id]`** — Competency map view. CTA: "Build your profile →".
3. **`/jobs/[id]/profile`** — Resume upload (PDF/DOCX/paste) + three optional
   supplemental fields (extra work history, extra skills, extra certs).
4. **`/jobs/[id]/questionnaire`** — 15 questions generated for this person
   and this job (5 personalized style questions + 10 field-readiness skill
   probes), one at a time; single-select for scales, check-all-that-apply
   where several options can be true, always with a free-text escape hatch.
5. **`/jobs/[id]/curriculum`** — Personalized roadmap sized to the distance
   from field-ready: where you stand (already strong / worth sharpening /
   next to build), then an ordered list of modules with a "why this, for
   you" rationale each.

## Project structure

```
app/                     Next.js routes and pages
  page.tsx               Home — job-analysis form
  jobs/[id]/
    page.tsx             Competency map + "next step" CTA
    profile/page.tsx     Resume upload flow
    questionnaire/page.tsx  One-at-a-time questionnaire
    curriculum/page.tsx  Personalized roadmap
  api/health/route.ts    DB + env health check
components/
  ui/                    shadcn primitives
  features/              JobAnalysisForm, JobAnalysisView, ResumeProfileForm,
                         QuestionnaireFlow, CurriculumRoadmap
lib/
  ai/                    Anthropic client + one file per model call
  db/prisma.ts           Prisma singleton
  resume/extract-text.ts PDF/DOCX/text extraction
  schemas/               Zod + JSON schemas shared with the AI
modules/
  job-analysis/          Stage 1
  resume-profile/        Stage 2, Step 1
  questionnaire/         Stage 2, Step 2
  skill-assessment/      Stage 2, Step 3
  curriculum/            Stage 2, Step 4 (also drives Stage 3+ later)
  assignments/           Stage 4 stub
  coach/                 Stage 5a stub
  evaluation/            Stage 5b stub
  portfolio/             Stage 6 stub
  skills-gap/            Superseded by skill-assessment (kept as stub)
prisma/
  schema.prisma          All models across all stages
  seed.ts                Demo user seed
examples/
  sample-job.txt         Ready-to-paste sample listing
```

## Data model highlights

- `ResumeProfile` — one per (user, job) attempt. Unified skill inventory:
  structured `workHistory` (JSON), plus flat `impliedSkills`,
  `toolsMentioned`, `explicitSkills`, `certifications` arrays.
- `Questionnaire` — the 15 generated questions as JSON (kind, format,
  options). `QuestionnaireResponse` is one row per answer with
  `selectedOptions[]` + optional free text, uniqued by
  `(questionnaireId, questionId)`.
- `SkillAssessment` — the cross-reference output: per-skill breakdown with
  `alignment` (ALIGNED / RESUME_STRONGER_THAN_CONFIDENCE / TRUE_GAP / …)
  and `confidence` (UNKNOWN → EXPERT), plus denormalized
  `reinforcementFlags` and `trueGaps` lists.
- `Curriculum` — modules JSON: title, description, rationale, targeted
  skills, phase (FOUNDATIONAL / CORE / ADVANCED), estimated hours.

## How the AI calls work

Every AI call in `lib/ai/*` follows the same pattern:

1. A rigorous system prompt scoped to one job.
2. A single Anthropic **tool** with an `input_schema` matching a Zod schema.
3. `tool_choice: { type: "tool", name: "…" }` forces JSON output.
4. On the returned `tool_use` block, Zod validates the payload.
5. On failure: one retry with the exact Zod errors fed back as a
   `tool_result` with `is_error: true`.

That's five files: `analyze-job`, `extract-resume-profile`,
`generate-questionnaire`, `generate-assessment`, `generate-curriculum`.

## What's next

- **Stage 3 — Lesson content.** Fill each `CurriculumModule` with real
  material and exercises.
- **Stage 4 — Assignments.** Instantiate `Assignment` rows from the plan,
  with a submission → evaluation → iteration loop.
- **Stage 5 — Coach + Evaluation.** Streaming AI coach scoped to a single
  assignment; an evaluator that scores submissions and feeds back into
  the curriculum.
- **Stage 6 — Portfolio.** Turn evaluated submissions into a shareable
  portfolio that proves competency for the target role.
