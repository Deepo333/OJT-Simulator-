"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Question } from "@/lib/schemas/questionnaire";
import { NONE_OPTION_VALUE } from "@/lib/schemas/questionnaire-constants";
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

const EMPTY: AnswerState = { selected: [], freeTextAnswer: "" };

// Top-level so React keeps element identity across re-renders; defining
// this inside the flow component would remount every option on each tap.
function Choice({
  label,
  selected,
  isMulti,
  muted = false,
  onSelect,
}: {
  label: string;
  selected: boolean;
  isMulti: boolean;
  muted?: boolean;
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
        muted && "border-dashed text-muted-foreground",
        selected ? "border-primary bg-primary/5 text-foreground" : "border-input hover:bg-accent",
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
  const noneChosen = answer.selected.includes(NONE_OPTION_VALUE);

  const progress = useMemo(
    () => Math.round(((index + 1) / total) * 100),
    [index, total],
  );

  const canAdvance = answer.selected.length > 0;

  function update(patch: Partial<AnswerState>) {
    setAnswers((prev) => ({
      ...prev,
      [current.id]: { ...(prev[current.id] ?? EMPTY), ...patch },
    }));
  }

  function choose(value: string) {
    if (!isMulti) {
      update({ selected: [value] });
      return;
    }
    if (value === NONE_OPTION_VALUE) {
      // "None of these" is exclusive: it clears everything else.
      update({ selected: noneChosen ? [] : [NONE_OPTION_VALUE] });
      return;
    }
    const withoutNone = answer.selected.filter((v) => v !== NONE_OPTION_VALUE);
    update({
      selected: withoutNone.includes(value)
        ? withoutNone.filter((v) => v !== value)
        : [...withoutNone, value],
    });
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
        selectedOptions: a.selected,
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
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {isMulti ? "Check all that apply" : "Pick the one that fits best"}
        </p>
        <h2 className="text-xl font-medium leading-snug">{current.text}</h2>

        <div className="space-y-2" role={isMulti ? "group" : "radiogroup"}>
          {current.options.map((opt) => (
            <Choice
              key={opt.value}
              label={opt.label}
              selected={answer.selected.includes(opt.value)}
              isMulti={isMulti}
              muted={opt.value === NONE_OPTION_VALUE}
              onSelect={() => choose(opt.value)}
            />
          ))}

          {noneChosen ? (
            <div className="space-y-1 pt-1">
              <label
                htmlFor={`elaborate-${current.id}`}
                className="text-xs text-muted-foreground"
              >
                Want to say more? Optional.
              </label>
              <Textarea
                id={`elaborate-${current.id}`}
                value={answer.freeTextAnswer}
                onChange={(e) => update({ freeTextAnswer: e.target.value })}
                rows={3}
                placeholder="Anything closer to your experience — a sentence is plenty."
              />
            </div>
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
