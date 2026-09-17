import { z } from "zod";

// Shape validated inside the Server Action. Files are handled separately
// because Zod doesn't have a first-class File type — we validate that we
// received *either* a non-empty file *or* pasted text.
export const resumeProfileFormSchema = z
  .object({
    pastedResume: z.string().trim().max(50_000).optional().or(z.literal("")),
    supplementalWorkHistory: z
      .string()
      .trim()
      .max(10_000)
      .optional()
      .or(z.literal("")),
    supplementalSkills: z
      .string()
      .trim()
      .max(5_000)
      .optional()
      .or(z.literal("")),
    supplementalCertifications: z
      .string()
      .trim()
      .max(5_000)
      .optional()
      .or(z.literal("")),
  })
  .strict();

export type ResumeProfileFormInput = z.infer<typeof resumeProfileFormSchema>;

export interface ResumeProfileFormError {
  field?:
    | keyof ResumeProfileFormInput
    | "resumeFile"
    | "form";
  message: string;
}
