/** Split a video title into a big hook line + optional subline for Shorts thumbnails. */

const FILLER = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "how",
  "why",
  "what",
  "when",
  "in",
  "on",
  "with",
  "for",
  "to",
  "of",
  "and",
  "or",
  "is",
  "are",
  "was",
  "were",
  "की",
  "के",
  "का",
  "में",
  "से",
  "को",
  "और",
  "यह",
  "वह",
]);

export function extractThumbnailHook(title: string): { hook: string; subline: string } {
  const clean = title
    .replace(/#\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return { hook: "WATCH THIS", subline: "" };

  const words = clean.split(" ").filter(Boolean);
  if (words.length <= 2) return { hook: clean.toUpperCase(), subline: "" };

  // First 2–3 non-filler words for the hook (mobile must read in <1s)
  const hookWords: string[] = [];
  for (const w of words) {
    if (hookWords.length >= 3) break;
    const lower = w.toLowerCase().replace(/[^\w\u0900-\u097F]/g, "");
    if (hookWords.length > 0 || !FILLER.has(lower)) hookWords.push(w);
    else if (hookWords.length === 0) hookWords.push(w);
  }
  while (hookWords.length < 2 && words.length > hookWords.length) {
    const next = words[hookWords.length];
    if (next && !hookWords.includes(next)) hookWords.push(next);
    else break;
  }

  const hook = hookWords.join(" ").toUpperCase();
  const rest = words.slice(hookWords.length, hookWords.length + 6).join(" ");
  return { hook, subline: rest };
}
