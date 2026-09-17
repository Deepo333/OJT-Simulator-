// Zod-free so client components can import these without pulling in the
// validation library.

export const TOTAL_QUESTIONS = 15;

// Appended server-side to every MULTI_SELECT question. Selecting it clears
// the other choices and reveals an optional elaboration box.
export const NONE_OPTION_VALUE = "none";
export const NONE_OPTION_LABEL = "None of these";
