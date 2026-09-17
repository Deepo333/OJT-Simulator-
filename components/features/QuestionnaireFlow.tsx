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
  selectedOption: string | null;
  freeTextAnswer: string;
}

const FREE_TEXT_SENTINEL = "__OTHER__";

export function QuestionnaireFlow({ questionnaireId, questions }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const total = questions.length;
  const current = questions[index]!;
  const answer =
    answers[current.id] ?? { selectedOption: null, freeTextAnswer: "" };

  const progress = useMemo(
    () => Math.round(((index + 1) / total) * 100),
    [index, total],
  );

  const canAdvance =
    answer.selectedOption !== null &&
    (answer.selectedOption !== FREE_TEXT_SENTINEL ||
      answer.freeTextAnswer.trim().length > 0);

  function setSelected(value: string) {
    setAnswers((prev) => ({
      ...prev,
      [current.id]: {
        selectedOption: value,
        freeTextAnswer: prev[current.id]?.freeTextAnswer ?? "",
      },
    }));
  }

  function setFreeText(value: string) {
    setAnswers((prev) => ({
      ...prev,
      [current.id]: {
        selectedOption: prev[current.id]?.selectedOption ?? null,
        freeTextAnswer: value,
      },
    }));
  }

  function next() {
    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      submit();
    }
  }

  function back() {
    if (index > 0) setIndex(index - 1);
  }

  function submit() {
    setSubmitError(null);
    const payload = questions.map((q) => {
      const a = answers[q.id] ?? { selectedOption: null, freeTextAnswer: "" };
      const isFreeText = a.selectedOption === FREE_TEXT_SENTINEL;
      return {
        questionId: q.id,
        selectedOption: isFreeText ? null : a.selectedOption,
        freeTextAnswer:
          a.freeTextAnswer.trim().length > 0 ? a.freeTextAnswer.trim() : null,
      };
    });

    startTransition(async () => {
      const result = await submitQuestionnaire(questionnaireId, payload);
      if (result.status === "ok") {
        router.push(result.redirectTo);
      } else {
        setSubmitError(result.message);
      }
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
        {current.targetSkill ? (
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            About: {current.targetSkill}
          </p>
        ) : null}
        <h2 className="text-xl font-medium leading-snug">{current.text}</h2>

        <div className="space-y-2">
          {current.options.map((opt) => {
            const selected = answer.selectedOption === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                    selected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/50",
                  )}
                >
                  {selected ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                  ) : null}
                </span>
                {opt.label}
              </button>
            );
          })}

          {current.allowFreeText ? (
            <button
              type="button"
              onClick={() => setSelected(FREE_TEXT_SENTINEL)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border border-dashed px-4 py-3 text-left text-sm transition-colors",
                answer.selectedOption === FREE_TEXT_SENTINEL
                  ? "border-primary bg-primary/5"
                  : "border-input hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                  answer.selectedOption === FREE_TEXT_SENTINEL
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/50",
                )}
              >
                {answer.selectedOption === FREE_TEXT_SENTINEL ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                ) : null}
              </span>
              Other / explain
            </button>
          ) : null}

          {answer.selectedOption === FREE_TEXT_SENTINEL ? (
            <Textarea
              value={answer.freeTextAnswer}
              onChange={(e) => setFreeText(e.target.value)}
              rows={3}
              placeholder="A sentence is fine."
              className="mt-2"
            />
          ) : (
            answer.selectedOption !== null && (
              <details className="mt-2">
                <summary className="cursor-pointer select-none text-xs text-muted-foreground underline-offset-4 hover:underline">
                  Add a note (optional)
                </summary>
                <Textarea
                  value={answer.freeTextAnswer}
                  onChange={(e) => setFreeText(e.target.value)}
                  rows={2}
                  className="mt-2"
                  placeholder="Anything you want us to know."
                />
              </details>
            )
          )}
        </div>
      </div>

      {submitError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={back}
          disabled={index === 0 || pending}
        >
          ← Back
        </Button>
        <Button
          type="button"
          onClick={next}
          disabled={!canAdvance || pending}
        >
          {pending
            ? "Building your curriculum…"
            : index === total - 1
              ? "Finish"
              : "Next →"}
        </Button>
      </div>
    </div>
  );
}
