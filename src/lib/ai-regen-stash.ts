export type AiRegenStash =
  | { mode: "freeform"; prompt: string }
  | { mode: "template"; templateId: string; answers: Record<string, string> };

const key = (pageId: string) => `lexguild.aiRegen.${pageId}`;

export function stashAiInputs(pageId: string, data: AiRegenStash) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key(pageId), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function readAiInputs(pageId: string): AiRegenStash | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key(pageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiRegenStash;
    if (parsed?.mode === "freeform" && typeof parsed.prompt === "string") return parsed;
    if (parsed?.mode === "template" && typeof parsed.templateId === "string") {
      return { mode: "template", templateId: parsed.templateId, answers: parsed.answers ?? {} };
    }
    return null;
  } catch {
    return null;
  }
}
