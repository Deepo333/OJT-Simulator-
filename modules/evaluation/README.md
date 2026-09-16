# `modules/evaluation` — Stage 5b (stub)

Evaluate `AssignmentSubmission` rows against the targeted competencies and
emit structured feedback used by the coach and the curriculum adapter.

## Contract (planned)

- `evaluateSubmission(submissionId)` — writes `aiEvaluation` JSON on the
  submission row: competency-level scores, strengths, gaps, next-iteration
  guidance.
- Feeds back into Stage 3 to reprioritize the remaining curriculum.
