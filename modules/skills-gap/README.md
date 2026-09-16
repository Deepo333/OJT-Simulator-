# `modules/skills-gap` — Stage 2 (stub)

Compare the persisted `CompetencyMap` against the user's `currentSkills`
and produce a `SkillsGap` row with three buckets: `hasSkills`,
`partialSkills`, `needsToLearn`.

## Contract (planned)

- Input: `{ userId, jobListingId }` — read the CompetencyMap and the user
  from the DB; do not require the raw job text.
- Output: `SkillsGap` row + a UI-shaped summary object.
- AI: single Claude call with a strict Zod-validated tool response, same
  pattern as `lib/ai/analyze-job.ts`.

## Files to add here

- `actions.ts` — Server Action `computeSkillsGap`.
- `analyzer.ts` — the Claude call + parsing.
- `prompts.ts` — Stage-2 prompt templates.

Do NOT touch `modules/job-analysis` — its DB rows are the input contract.
