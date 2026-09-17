import type { Question } from "@/lib/schemas/questionnaire";

export interface QuestionnaireForClient {
  id: string;
  questions: Question[];
}

export interface AnswerInput {
  questionId: string;
  selectedOption: string | null;
  freeTextAnswer: string | null;
}
