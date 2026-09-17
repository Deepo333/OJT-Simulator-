# `modules/curriculum` — Stage 2, Step 4 (partial — Stage 3 later expands)

Stage-2 role: turn a `SkillAssessment` into a `Curriculum` row containing an
ordered list of modules. Each module carries a rationale that ties back to
a specific gap or reinforcement need from the assessment.

## Files

- `actions.ts` — `generateAndPersistCurriculum(skillAssessmentId)`.

## Contract

- Input: an existing `SkillAssessment` id.
- Output: a `Curriculum` row (mode = `AI_AUGMENTED`), with modules as JSON.
- Displayed at `/jobs/[id]/curriculum` via `CurriculumRoadmap`.

Stage 3 (later) will add lesson content and Stage 4 will instantiate
`Assignment` rows from these modules. Neither will need to change this
module — the DB row is the contract.
