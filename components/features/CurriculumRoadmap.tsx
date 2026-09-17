import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurriculumModule } from "@/lib/schemas/curriculum";
import type { SkillBreakdownItem } from "@/lib/schemas/skill-assessment";

const PHASE_LABEL: Record<CurriculumModule["phase"], string> = {
  FOUNDATIONAL: "Foundation",
  CORE: "Core",
  ADVANCED: "Stretch",
};

const PHASE_VARIANT: Record<
  CurriculumModule["phase"],
  "default" | "secondary" | "outline"
> = {
  FOUNDATIONAL: "default",
  CORE: "secondary",
  ADVANCED: "outline",
};

// Friendly labels for the assessment enums — the raw values read harshly.
const ALIGNMENT_LABEL: Record<SkillBreakdownItem["alignment"], string> = {
  ALIGNED: "Solid",
  RESUME_STRONGER_THAN_CONFIDENCE: "Worth sharpening",
  CONFIDENCE_STRONGER_THAN_RESUME: "Hidden strength",
  EMERGING: "Emerging — a foothold to build on",
  TRUE_GAP: "Next to build",
  NEEDS_REINFORCEMENT: "Practice will lock it in",
  NO_SIGNAL: "Not assessed yet",
};

const CONFIDENCE_LABEL: Record<SkillBreakdownItem["confidence"], string> = {
  UNKNOWN: "Unknown",
  TRUE_GAP: "Starting point",
  EMERGING: "Emerging",
  DEVELOPING: "Developing",
  PROFICIENT: "Proficient",
  EXPERT: "Expert",
};

export interface CurriculumRoadmapProps {
  overview: string;
  modules: CurriculumModule[];
  reinforcementFlags: string[];
  trueGaps: string[];
  summary: string;
  skillsBreakdown: SkillBreakdownItem[];
}

export function CurriculumRoadmap({
  overview,
  modules,
  reinforcementFlags,
  trueGaps,
  summary,
  skillsBreakdown,
}: CurriculumRoadmapProps) {
  const totalHours = modules.reduce((n, m) => n + m.estimatedHours, 0);
  const strengths = skillsBreakdown.filter(
    (s) =>
      s.alignment === "ALIGNED" ||
      s.alignment === "CONFIDENCE_STRONGER_THAN_RESUME" ||
      s.confidence === "EXPERT" ||
      s.confidence === "PROFICIENT",
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border bg-muted/30 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Where you stand</h2>
          <p className="text-sm text-muted-foreground">
            An honest read of what you already bring and what to build next.
          </p>
        </div>
        <p className="text-sm leading-relaxed">{summary}</p>
        <div className="grid gap-4 pt-1 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Already strong
            </p>
            {strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                We&apos;ll surface these as you go.
              </p>
            ) : (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {strengths.map((s) => (
                  <li key={s.skill}>
                    <Badge variant="outline">{s.skill}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Worth sharpening
            </p>
            {reinforcementFlags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing flagged.</p>
            ) : (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {reinforcementFlags.map((g) => (
                  <li key={g}>
                    <Badge variant="secondary">{g}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Next to build
            </p>
            {trueGaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No new-from-scratch skills needed.
              </p>
            ) : (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {trueGaps.map((g) => (
                  <li key={g}>
                    <Badge variant="default">{g}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Your roadmap</h2>
          <span className="text-sm text-muted-foreground">
            {modules.length} {modules.length === 1 ? "module" : "modules"} · about{" "}
            {totalHours} hours · sized to your goal
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{overview}</p>

        <ol className="space-y-4">
          {modules.map((m) => (
            <li key={m.order}>
              <Card>
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {String(m.order + 1).padStart(2, "0")}
                    </span>
                    <CardTitle className="text-base">{m.title}</CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={PHASE_VARIANT[m.phase]}>{PHASE_LABEL[m.phase]}</Badge>
                    <span className="text-muted-foreground">~{m.estimatedHours} hrs</span>
                    {m.targetedSkills.map((s) => (
                      <Badge key={s} variant="muted">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-relaxed">{m.description}</p>
                  <div className="rounded-md border-l-2 border-primary/60 bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium">Why this, for you: </span>
                    <span className="text-muted-foreground">{m.rationale}</span>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <details className="rounded-lg border bg-muted/30">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          See the full skill-by-skill read ({skillsBreakdown.length} skills)
        </summary>
        <div className="space-y-3 px-4 pb-4 text-xs">
          {skillsBreakdown.map((s, i) => (
            <div key={i} className="rounded border bg-background p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{s.skill}</span>
                <div className="flex gap-1.5">
                  <Badge variant="outline">{CONFIDENCE_LABEL[s.confidence]}</Badge>
                  <Badge variant="muted">{ALIGNMENT_LABEL[s.alignment]}</Badge>
                </div>
              </div>
              <p className="mt-1 text-muted-foreground">{s.rationale}</p>
              {s.resumeEvidence ? (
                <p className="mt-1">
                  <span className="font-medium">From your background: </span>
                  <span className="text-muted-foreground">{s.resumeEvidence}</span>
                </p>
              ) : null}
              {s.questionnaireSignal ? (
                <p>
                  <span className="font-medium">From your answers: </span>
                  <span className="text-muted-foreground">{s.questionnaireSignal}</span>
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
