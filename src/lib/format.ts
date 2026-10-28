// Minimal markdown <-> HTML helpers for preserving basic formatting (bold/italic/underline)
// in plain-text email drafts.

export function markdownToHtml(md: string): string {
  // Escape HTML first
  let s = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Bold: **text** or __text__
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic: *text* or _text_ (single)
  s = s.replace(/(^|[^*])\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_(?!_)(.+?)(?<!_)_(?!_)/g, "$1<em>$2</em>");
  // Line breaks
  s = s.replace(/\r\n/g, "\n").replace(/\n/g, "<br>\n");
  return s;
}

export function htmlToMarkdown(html: string): string {
  let s = html;
  // Convert common tags to markdown
  s = s.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**");
  s = s.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**");
  s = s.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*");
  s = s.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*");
  s = s.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, "__$1__");
  // Convert block tags to paragraph breaks, <br> to single line break
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n\n");
  s = s.replace(/<\/div>/gi, "\n\n");
  s = s.replace(/<\/li>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  // Decode entities
  s = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
  // Collapse 3+ newlines to 2 (one blank line)
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
