import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface JobAnalysisViewProps {
  jobTitle: string;
  companyName: string;
  sourceUrl?: string | null;
  createdAt: Date;
  rawText: string;
  competencyMap: {
    requiredQualifications: string[];
    preferredQualifications: string[];
    tools: string[];
    responsibilities: string[];
    softSkills: string[];
  };
}

function Section({
  title,
  description,
  items,
  emptyLabel,
  variant = "default",
}: {
  title: string;
  description: string;
  items: string[];
  emptyLabel: string;
  variant?: "default" | "secondary" | "outline" | "muted";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <Badge variant={variant} className="mt-0.5 shrink-0">
                  {i + 1}
                </Badge>
                <span className="text-sm leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function JobAnalysisView(props: JobAnalysisViewProps) {
  const {
    jobTitle,
    companyName,
    sourceUrl,
    createdAt,
    rawText,
    competencyMap,
  } = props;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{jobTitle}</h1>
          <span className="text-lg text-muted-foreground">
            at {companyName}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Analyzed {createdAt.toLocaleString()}</span>
          {sourceUrl ? (
            <>
              <span aria-hidden>·</span>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Original listing ↗
              </a>
            </>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Section
          title="Required qualifications"
          description="Must-haves the listing explicitly requires."
          items={competencyMap.requiredQualifications}
          emptyLabel="No required qualifications found."
        />
        <Section
          title="Preferred qualifications"
          description="Bonuses, nice-to-haves, and 'a plus' items."
          items={competencyMap.preferredQualifications}
          emptyLabel="No preferred qualifications found."
          variant="secondary"
        />
        <Section
          title="Tools &amp; software"
          description="Specific products, platforms, and languages named."
          items={competencyMap.tools}
          emptyLabel="No specific tools named."
          variant="outline"
        />
        <Section
          title="Core responsibilities"
          description="Concrete day-to-day work — not marketing fluff."
          items={competencyMap.responsibilities}
          emptyLabel="No concrete responsibilities found."
          variant="muted"
        />
        <Section
          title="Soft skills"
          description="Collaboration, communication, and traits called out."
          items={competencyMap.softSkills}
          emptyLabel="No soft-skill expectations named."
          variant="muted"
        />
      </div>

      <details className="rounded-lg border bg-muted/30">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          Show raw job listing
        </summary>
        <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap px-4 pb-4 text-xs leading-relaxed text-muted-foreground">
          {rawText}
        </pre>
      </details>
    </div>
  );
}
