# `modules/skill-assessment` — Stage 2, Step 3

Owner of the cross-reference step. Reads:

- The job's `CompetencyMap` (Stage 1).
- The most recent `ResumeProfile` (Stage 2, Step 1).
- The `Questionnaire` + `QuestionnaireResponse` rows (Stage 2, Step 2).

Produces a `SkillAssessment` row: per-skill breakdown with alignment flag
and confidence level, plus denormalized `reinforcementFlags` and `trueGaps`
lists that Step 4 keys off.

## Files

- `actions.ts` — `generateAndPersistAssessment(questionnaireId)`.

The DB row is the contract for Step 4.
