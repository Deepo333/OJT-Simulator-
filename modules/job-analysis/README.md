# `modules/job-analysis` — Stage 1

Owner of the Stage-1 feature: turn a pasted job listing into a validated
`CompetencyMap`.

## Responsibilities

- Expose the `analyzeAndPersistJob` Server Action used by the Home page form.
- Compose the DB write (User → JobListing → CompetencyMap) with the AI call
  in `lib/ai/analyze-job.ts`.
- Keep the module dependency-free of UI concerns — components live under
  `components/features` and import from here.

## Files

- `actions.ts` — Server Actions.
- `types.ts` — module-local types (form input, wire shapes).

## Extension points

Stage 2 (`modules/skills-gap`) consumes the persisted `CompetencyMap`. It
does not need to reach into this module — the DB row is the contract.
