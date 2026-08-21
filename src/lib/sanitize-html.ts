/**
 * Dependency-free HTML sanitizer.
 *
 * Runs identically in the Cloudflare Worker (SSR) and the browser — unlike
 * DOMPurify/isomorphic-dompurify, which needs a DOM and throws at module
 * init in the edge runtime.
 *
 * Strategy: allowlist tags + attributes, drop everything else, and strip the
 * entire contents of dangerous elements (script/style/etc).
 */

const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "caption", "code", "div", "em", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "s",
  "small", "span", "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th",
  "thead", "tr", "u", "ul",
]);

// Elements whose *contents* must be removed too, not just their tags.
const VOID_CONTENT_TAGS = ["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math"];

const GLOBAL_ATTRS = new Set(["class", "id", "title", "role", "dir", "lang"]);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel", "name"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
};

const SAFE_URL = /^(?:https?:|mailto:|tel:|#|\/(?!\/)|[^:]*$)/i;
const SAFE_IMG_URL = /^(?:https?:|data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml);|\/(?!\/)|[^:]*$)/i;

function escapeText(s: string): string {
  return s.replace(/&(?![a-zA-Z#0-9]+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function attrValueOk(tag: string, name: string, value: string): boolean {
  const v = value.trim().replace(/[\u0000-\u001f\s]+/g, (m) => (m.includes("\n") || m.includes("\t") ? "" : m)).trim();
  if (name === "href") return SAFE_URL.test(v);
  if (name === "src") return tag === "img" ? SAFE_IMG_URL.test(v) : SAFE_URL.test(v);
  return true;
}

function sanitizeAttributes(tag: string, raw: string): string {
  const out: string[] = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>=`]+))|([a-zA-Z_:][-a-zA-Z0-9_:.]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = (m[1] ?? m[5] ?? "").toLowerCase();
    if (!name) continue;
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if (name.startsWith("on") || name === "style" || name === "srcdoc" || name === "formaction") continue;
    const allowed = GLOBAL_ATTRS.has(name) || TAG_ATTRS[tag]?.has(name);
    if (!allowed) continue;
    if (!attrValueOk(tag, name, value)) continue;
    out.push(`${name}="${escapeText(value).replace(/"/g, "&quot;")}"`);
  }
  if (tag === "a") {
    const hasTarget = out.some((a) => a.startsWith("target="));
    if (hasTarget && !out.some((a) => a.startsWith("rel="))) out.push('rel="noopener noreferrer"');
  }
  return out.length ? ` ${out.join(" ")}` : "";
}

export function sanitizeHtmlString(input: string): string {
  if (!input) return "";
  let html = String(input);

  // Drop comments and dangerous elements with their contents.
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const t of VOID_CONTENT_TAGS) {
    html = html.replace(new RegExp(`<${t}\\b[\\s\\S]*?(?:</${t}\\s*>|$)`, "gi"), "");
  }
  html = html.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  html = html.replace(/<\?[\s\S]*?\?>/g, "");
  html = html.replace(/<![^>]*>/g, "");

  let out = "";
  let index = 0;
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html))) {
    out += escapeText(html.slice(index, match.index));
    index = tagRe.lastIndex;
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (closing) {
      out += `</${tag}>`;
    } else {
      const selfClosing = /\/\s*$/.test(match[3]) || tag === "br" || tag === "hr" || tag === "img";
      out += `<${tag}${sanitizeAttributes(tag, match[3])}${selfClosing ? " />" : ""}>`;
    }
  }
  out += escapeText(html.slice(index));
  return out;
}
