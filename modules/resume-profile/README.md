# `modules/resume-profile` — Stage 2, Step 1

Owner of the resume-upload step. Accepts a PDF/DOCX/text upload plus three
optional supplemental fields (extra work history, extra skills, extra
certifications), extracts a unified skill inventory via Claude, and stores
a `ResumeProfile` row scoped to `{ userId, jobListingId }`.

## Files

- `types.ts` — Zod-validated form input.
- `actions.ts` — Server Action `buildResumeProfile`.

## Contract

- Input (form): `resumeFile` (File, optional if `pastedResume` present),
  `pastedResume` (string, optional), plus three supplemental strings.
- Output: `ResumeProfile` row + redirect to `/jobs/[id]/questionnaire`.

The DB row is the contract for Step 2 — the questionnaire generator reads
it and does not re-run extraction.
