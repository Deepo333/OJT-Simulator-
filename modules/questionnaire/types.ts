import type { Question } from "@/lib/schemas/questionnaire";

export interface QuestionnaireForClient {
  id: string;
  questions: Question[];
}

export interface AnswerInput {
  questionId: string;
  // Option values chosen: one for single-select, any number for multi-select.
  selectedOptions: string[];
  freeTextAnswer: string | null;
}
