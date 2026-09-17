import type { Question } from "@/lib/schemas/questionnaire";
import { COMFORT_SCALE } from "@/lib/schemas/questionnaire";

// The 5 standardized questions asked of every user, regardless of resume or
// job. Fixed in code — do not change these lightly, they anchor the
// assessment model's "how do you learn?" signal across users.

export const STANDARDIZED_QUESTIONS: Question[] = [
  {
    id: "std-learning-style",
    kind: "STANDARDIZED",
    order: 0,
    text: "When you're picking up something brand-new, what actually works best for you?",
    options: [
      { value: "READING", label: "Reading docs and articles" },
      { value: "VIDEO", label: "Watching walkthrough videos" },
      { value: "HANDS_ON", label: "Building a real project immediately" },
      { value: "MENTOR", label: "Working alongside someone experienced" },
    ],
    allowFreeText: true,
  },
  {
    id: "std-unfamiliar-tools",
    kind: "STANDARDIZED",
    order: 1,
    text: "You're handed a tool or piece of software you've never used before. What's your first move?",
    options: [
      { value: "DIVE_IN", label: "Open it and click around to see what it does" },
      { value: "SEARCH", label: "Search for a quick-start guide or tutorial" },
      { value: "ASK", label: "Ask a colleague or the person who gave it to you" },
      { value: "DOCS", label: "Read the official documentation front-to-back" },
    ],
    allowFreeText: true,
  },
  {
    id: "std-ambiguity",
    kind: "STANDARDIZED",
    order: 2,
    text: "The instructions you were given have obvious gaps. What do you do?",
    options: [
      { value: "CLARIFY", label: "Ask clarifying questions before starting" },
      { value: "ASSUME", label: "Make reasonable assumptions and note them" },
      { value: "WAIT", label: "Wait for a fuller brief before starting" },
      { value: "EXPERIMENT", label: "Try a version, then adjust based on feedback" },
    ],
    allowFreeText: true,
  },
  {
    id: "std-pace-format",
    kind: "STANDARDIZED",
    order: 3,
    text: "What learning pace and format actually fits how you work?",
    options: [
      { value: "SHORT_BURSTS", label: "Short daily bursts (15–30 min)" },
      { value: "DEEP_BLOCKS", label: "Long focused blocks a few times a week" },
      { value: "SCHEDULED", label: "A structured weekly schedule" },
      { value: "FLEXIBLE", label: "Whenever I have the energy — no schedule" },
    ],
    allowFreeText: true,
  },
  {
    id: "std-deadline-confidence",
    kind: "STANDARDIZED",
    order: 4,
    text: "How confident are you delivering something new under a real deadline?",
    options: [...COMFORT_SCALE],
    allowFreeText: true,
  },
];
