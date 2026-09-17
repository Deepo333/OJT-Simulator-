"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Question } from "@/lib/schemas/questionnaire";
import { submitQuestionnaire } from "@/modules/questionnaire/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  questionnaireId: string;
  questions: Question[];
}

interface AnswerState {
  selected: string[];
  freeTextAnswer: string;
}

const OTHER = "__OTHER__";
const EMPTY: AnswerState = { selected: [], freeTextAnswer: "" };

// Top-level so React keeps the same element identity across re-renders;
// defining this inside the flow component would remount every option on
// each selection.
function Choice({
  label,
  selected,
  isMulti,
  dashed = false,
  onSelect,
}: {
  label: string;
  selected: boolean;
  isMulti: boolean;
  dashed?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role={isMulti ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
        dashed && "border-dashed",
        selected ? "border-primary bg-primary/5" : "border-input hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center border-2",
          isMulti ? "rounded-sm" : "rounded-full",
          selected ? "border-primary bg-primary" : "border-muted-foreground/50",
        )}
      >
        {selected ? (
          isMulti ? (
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-primary-foreground" aria-hidden>
              <path d="M2 6l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
          )
        ) : null}
      </span>
      {label}
    </button>
  );
}

export function QuestionnaireFlow({ questionnaireId, questions }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const total = questions.length;
  const current = questions[index]!;
  const isMulti = (current.format ?? "SINGLE_SELECT") === "MULTI_SELECT";
  const answer = answers[current.id] ?? EMPTY;
  const otherChosen = answer.selected.includes(OTHER);

  const progress = useMemo(
    () => Math.round(((index + 1) / total) * 100),
    [index, total],
  );

  const canAdvance =
    answer.selected.length > 0 &&
    (!otherChosen || answer.freeTextAnswer.trim().length > 0);

  function update(patch: Partial<AnswerState>) {
    setAnswers((prev) => ({
      ...prev,
      [current.id]: { ...(prev[current.id] ?? EMPTY), ...patch },
    }));
  }

  function choose(value: string) {
    if (isMulti) {
      const has = answer.selected.includes(value);
      update({
        selected: has
          ? answer.selected.filter((v) => v !== value)
          : [...answer.selected, value],
      });
    } else {
      update({ selected: [value] });
    }
  }

  function next() {
    if (index < total - 1) setIndex(index + 1);
    else submit();
  }

  function back() {
    if (index > 0) setIndex(index - 1);
  }

  function submit() {
    setSubmitError(null);
    const payload = questions.map((q) => {
      const a = answers[q.id] ?? EMPTY;
      return {
        questionId: q.id,
        selectedOptions: a.selected.filter((v) => v !== OTHER),
        freeTextAnswer:
          a.freeTextAnswer.trim().length > 0 ? a.freeTextAnswer.trim() : null,
      };
    });

    startTransition(async () => {
      const result = await submitQuestionnaire(questionnaireId, payload);
      if (result.status === "ok") router.push(result.redirectTo);
      else setSubmitError(result.message);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-sm text-muted-foreground">
          <span>
            Question {index + 1} of {total}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-5 rounded-lg border p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {current.targetSkill ? <span>About: {current.targetSkill}</span> : null}
          <span className={cn(current.targetSkill && "before:mr-2 before:content-['·']")}>
            {isMulti ? "Check all that apply" : "Pick one"}
          </span>
        </div>
        <h2 className="text-xl font-medium leading-snug">{current.text}</h2>

        <div className="space-y-2" role={isMulti ? "group" : "radiogroup"}>
          {current.options.map((opt) => (
            <Choice
              key={opt.value}
              label={opt.label}
              selected={answer.selected.includes(opt.value)}
              isMulti={isMulti}
              onSelect={() => choose(opt.value)}
            />
          ))}
          {current.allowFreeText ? (
            <Choice
              label="Something else / let me explain"
              selected={otherChosen}
              isMulti={isMulti}
              dashed
              onSelect={() => choose(OTHER)}
            />
          ) : null}

          {otherChosen ? (
            <Textarea
              value={answer.freeTextAnswer}
              onChange={(e) => update({ freeTextAnswer: e.target.value })}
              rows={3}
              placeholder="A sentence is plenty."
              className="mt-2"
            />
          ) : answer.selected.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer select-none text-xs text-muted-foreground underline-offset-4 hover:underline">
                Add a note (optional)
              </summary>
              <Textarea
                value={answer.freeTextAnswer}
                onChange={(e) => update({ freeTextAnswer: e.target.value })}
                rows={2}
                className="mt-2"
                placeholder="Anything that adds context."
              />
            </details>
          ) : null}
        </div>
      </div>

      {submitError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={back} disabled={index === 0 || pending}>
          ← Back
        </Button>
        <Button type="button" onClick={next} disabled={!canAdvance || pending}>
          {pending ? "Building your plan…" : index === total - 1 ? "Finish" : "Next →"}
        </Button>
      </div>
    </div>
  );
}
