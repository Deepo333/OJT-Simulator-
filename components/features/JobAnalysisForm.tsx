"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  analyzeAndPersistJob,
  type JobAnalysisFormState,
} from "@/modules/job-analysis/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: JobAnalysisFormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Analyzing…" : "Analyze this job"}
    </Button>
  );
}

function fieldError(
  state: JobAnalysisFormState,
  field: string,
): string | undefined {
  if (state.status !== "error") return undefined;
  return state.errors.find((e) => e.field === field)?.message;
}

export function JobAnalysisForm() {
  const [state, formAction] = useActionState(
    analyzeAndPersistJob,
    initialState,
  );

  const rawError = fieldError(state, "rawJobText");
  const companyError = fieldError(state, "companyName");
  const urlError = fieldError(state, "sourceUrl");
  const contextError = fieldError(state, "candidateContext");
  const formError = fieldError(state, "form");

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="rawJobText">Paste a job listing</Label>
        <Textarea
          id="rawJobText"
          name="rawJobText"
          rows={14}
          required
          placeholder="Paste the full text of a real job posting here — responsibilities, qualifications, and all."
          className="font-mono text-sm"
        />
        {rawError ? (
          <p className="text-sm text-destructive">{rawError}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company (optional)</Label>
          <Input
            id="companyName"
            name="companyName"
            placeholder="Acme Corp"
          />
          {companyError ? (
            <p className="text-sm text-destructive">{companyError}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="sourceUrl">Source URL (optional)</Label>
          <Input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            placeholder="https://…"
          />
          {urlError ? (
            <p className="text-sm text-destructive">{urlError}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="candidateContext">
          Your current role &amp; experience (optional)
        </Label>
        <Textarea
          id="candidateContext"
          name="candidateContext"
          rows={4}
          placeholder="Briefly: what do you do now, and what have you built or shipped? This helps future stages personalize your training plan."
        />
        {contextError ? (
          <p className="text-sm text-destructive">{contextError}</p>
        ) : null}
      </div>

      {formError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}
