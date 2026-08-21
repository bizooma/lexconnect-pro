import type { ReactNode } from "react";

/**
 * Safe light-markdown renderer shared by the member events page and the
 * public tenant events pages. React nodes only — never dangerouslySetInnerHTML,
 * no HTML passthrough of any kind.
 */
function inlineMd(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function EventMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let bullets: string[] = [];
  const flush = (k: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${k}`} className="list-disc space-y-1 pl-5">
        {bullets.map((b, i) => (
          <li key={i}>{inlineMd(b, `${k}-${i}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flush(String(idx));
    if (line.trim()) blocks.push(<p key={`p-${idx}`}>{inlineMd(line, `p${idx}`)}</p>);
  });
  flush("end");
  return <div className={className ?? "space-y-3 text-sm leading-relaxed"}>{blocks}</div>;
}

/** Strips light-markdown markers for meta descriptions / .ics DESCRIPTION. */
export function markdownToPlainText(text: string | null | undefined, max?: number): string {
  if (!text) return "";
  const plain = text
    .replace(/\r\n/g, "\n")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!max || plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trimEnd()}…`;
}
