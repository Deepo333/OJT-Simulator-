# `modules/coach` — Stage 5a (stub)

Conversational AI coach that supports the user while they work on an
assignment. Adapts to weaknesses surfaced by the evaluator.

## Contract (planned)

- Streaming chat endpoint (Server Action + streaming response) scoped to
  a single `assignmentId`.
- Reads: the assignment brief, the CompetencyMap, the current
  submission draft, and the user's past evaluations.
- Writes: coach turns are logged for portfolio replay.
