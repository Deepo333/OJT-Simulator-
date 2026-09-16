# `modules/curriculum` — Stage 3 (stub)

Generate a weekly on-the-job-training plan from a `CompetencyMap` +
`SkillsGap`, in one of two modes:

- `TRADITIONAL` — a classroom-shaped curriculum (readings, exercises).
- `AI_AUGMENTED` — an assignment-driven curriculum designed to be run
  with AI coaching (Stage 5).

## Contract (planned)

- Input: `{ userId, jobListingId, mode }`.
- Output: `Curriculum` row with `generatedPlan` (JSON) — a week-by-week
  breakdown with target competencies + suggested assignments.
- Downstream: Stage 4 (`assignments`) instantiates `Assignment` rows from
  the plan.
