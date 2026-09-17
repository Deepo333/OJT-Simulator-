"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  buildResumeProfile,
  type ResumeProfileFormState,
} from "@/modules/resume-profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: ResumeProfileFormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Reading your resume…" : "Continue to quick questionnaire →"}
    </Button>
  );
}

function fieldError(state: ResumeProfileFormState, field: string) {
  if (state.status !== "error") return undefined;
  return state.errors.find((e) => e.field === field)?.message;
}

export function ResumeProfileForm({ jobListingId }: { jobListingId: string }) {
  const [state, formAction] = useActionState(buildResumeProfile, initial);
  const [showPaste, setShowPaste] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.push(state.redirectTo);
    }
  }, [state, router]);

  if (state.status === "success") {
    return (
      <div className="rounded-md border bg-muted/30 p-4 text-sm">
        Profile saved — taking you to the questionnaire…{" "}
        <a href={state.redirectTo} className="underline underline-offset-4">
          Continue
        </a>
      </div>
    );
  }

  const fileError = fieldError(state, "resumeFile");
  const pasteError = fieldError(state, "pastedResume");
  const formError = fieldError(state, "form");

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="jobListingId" value={jobListingId} />

      <section className="space-y-3 rounded-lg border p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-semibold">Upload your resume</h2>
            <p className="text-sm text-muted-foreground">
              PDF or DOCX. We extract the text on our server — nothing is sent
              anywhere else.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPaste((s) => !s)}
            className="text-sm underline underline-offset-4"
          >
            {showPaste ? "Use file upload" : "Or paste as text"}
          </button>
        </div>

        {showPaste ? (
          <div className="space-y-2">
            <Label htmlFor="pastedResume">Paste your resume</Label>
            <Textarea
              id="pastedResume"
              name="pastedResume"
              rows={12}
              placeholder="Paste the full text of your resume here."
              className="font-mono text-sm"
            />
            {pasteError ? (
              <p className="text-sm text-destructive">{pasteError}</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="resumeFile">Resume file</Label>
            <Input
              id="resumeFile"
              name="resumeFile"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            />
          </div>
        )}
        {fileError ? (
          <p className="text-sm text-destructive">{fileError}</p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-lg border p-5">
        <div>
          <h2 className="text-lg font-semibold">Anything not on your resume?</h2>
          <p className="text-sm text-muted-foreground">
            All optional. Resumes are often tailored to a specific past job —
            add anything that would give us a fuller picture.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplementalWorkHistory">Additional work history</Label>
          <Textarea
            id="supplementalWorkHistory"
            name="supplementalWorkHistory"
            rows={3}
            placeholder="Any roles or projects that aren't on your resume."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplementalSkills">Additional skills</Label>
          <Textarea
            id="supplementalSkills"
            name="supplementalSkills"
            rows={3}
            placeholder="Tools, languages, or capabilities you've picked up outside a formal role."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplementalCertifications">
            Additional certifications
          </Label>
          <Textarea
            id="supplementalCertifications"
            name="supplementalCertifications"
            rows={2}
            placeholder="Certifications, credentials, or licenses not listed on the resume."
          />
        </div>
      </section>

      {formError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}
