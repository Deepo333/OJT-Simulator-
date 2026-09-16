import { z } from "zod";

// Input shape for the Home-page form. Kept module-local so the UI validates
// against the same schema the Server Action does.
export const jobAnalysisFormSchema = z.object({
  rawJobText: z
    .string()
    .trim()
    .min(80, "Paste at least a short job listing (80+ characters).")
    .max(30_000, "Job listing is unusually long — please trim it."),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  sourceUrl: z
    .string()
    .trim()
    .url("Source URL must be a valid URL if provided.")
    .max(2000)
    .optional()
    .or(z.literal("")),
  candidateContext: z
    .string()
    .trim()
    .max(5000, "Please keep the background under 5000 characters.")
    .optional()
    .or(z.literal("")),
});

export type JobAnalysisFormInput = z.infer<typeof jobAnalysisFormSchema>;

export interface JobAnalysisFormError {
  field?: keyof JobAnalysisFormInput | "form";
  message: string;
}
