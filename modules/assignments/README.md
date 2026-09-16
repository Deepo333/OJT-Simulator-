# `modules/assignments` — Stage 4 (stub)

Instantiate realistic work assignments from a `Curriculum` and manage the
submission → evaluation → iteration loop.

## Contract (planned)

- `instantiateAssignments(curriculumId)` — creates `Assignment` rows from
  the persisted plan.
- `submitAssignment({ assignmentId, userText })` — writes an
  `AssignmentSubmission` and enqueues Stage-5 evaluation.
- Status transitions live here: PENDING → IN_PROGRESS → SUBMITTED →
  EVALUATED → COMPLETE.
