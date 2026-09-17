import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurriculumModule } from "@/lib/schemas/curriculum";
import type { SkillBreakdownItem } from "@/lib/schemas/skill-assessment";

const PHASE_LABEL: Record<CurriculumModule["phase"], string> = {
  FOUNDATIONAL: "Foundational",
  CORE: "Core",
  ADVANCED: "Advanced",
};

const PHASE_VARIANT: Record<
  CurriculumModule["phase"],
  "default" | "secondary" | "outline"
> = {
  FOUNDATIONAL: "default",
  CORE: "secondary",
  ADVANCED: "outline",
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

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-lg border bg-muted/30 p-6">
        <h2 className="text-lg font-semibold">Where you stand</h2>
        <p className="text-sm leading-relaxed">{summary}</p>
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              True gaps
            </p>
            {trueGaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">None identified.</p>
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
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Needs reinforcement
            </p>
            {reinforcementFlags.length === 0 ? (
              <p className="text-sm text-muted-foreground">None identified.</p>
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
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Your roadmap</h2>
          <span className="text-sm text-muted-foreground">
            {modules.length} modules · ~{totalHours} hours
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{overview}</p>

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
                    <Badge variant={PHASE_VARIANT[m.phase]}>
                      {PHASE_LABEL[m.phase]}
                    </Badge>
                    <span className="text-muted-foreground">
                      ~{m.estimatedHours} hrs
                    </span>
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
                    <span className="font-medium">Why this: </span>
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
          Show full skill breakdown ({skillsBreakdown.length} skills)
        </summary>
        <div className="space-y-3 px-4 pb-4 text-xs">
          {skillsBreakdown.map((s, i) => (
            <div key={i} className="rounded border bg-background p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{s.skill}</span>
                <div className="flex gap-1.5">
                  <Badge variant="outline">{s.confidence}</Badge>
                  <Badge variant="muted">{s.alignment}</Badge>
                </div>
              </div>
              <p className="mt-1 text-muted-foreground">{s.rationale}</p>
              {s.resumeEvidence ? (
                <p className="mt-1">
                  <span className="font-medium">Resume: </span>
                  <span className="text-muted-foreground">
                    {s.resumeEvidence}
                  </span>
                </p>
              ) : null}
              {s.questionnaireSignal ? (
                <p>
                  <span className="font-medium">Questionnaire: </span>
                  <span className="text-muted-foreground">
                    {s.questionnaireSignal}
                  </span>
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
