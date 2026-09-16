# `modules/portfolio` — Stage 6 (stub)

Turn completed assignment submissions into a shareable portfolio that
proves competency for the target role.

## Contract (planned)

- `publishPortfolioItem({ submissionId, title })` — writes a
  `PortfolioItem` row and produces a rendered artifact (Markdown / PDF).
- Read-only public views live under a Stage-6 `/portfolio/[userId]` route.
