export function cleanMarkdown(html: string): string {
  // Remove delete suggestions entirely (both the mark and its content)
  let cleaned = html.replace(
    /<mark[^>]*data-suggestion-type="delete"[^>]*>[\s\S]*?<\/mark>/g,
    ""
  );

  // Keep add suggestion text but remove the mark wrapper
  cleaned = cleaned.replace(
    /<mark[^>]*data-suggestion-id="[^"]*"[^>]*>([\s\S]*?)<\/mark>/g,
    "$1"
  );

  // Keep comment text but remove the mark wrapper
  cleaned = cleaned.replace(
    /<mark[^>]*data-comment-id="[^"]*"[^>]*>([\s\S]*?)<\/mark>/g,
    "$1"
  );

  // Convert HTML to markdown
  cleaned = cleaned.replace(/<h1[^>]*>(.*?)<\/h1>/g, "# $1\n\n");
  cleaned = cleaned.replace(/<h2[^>]*>(.*?)<\/h2>/g, "## $1\n\n");
  cleaned = cleaned.replace(/<h3[^>]*>(.*?)<\/h3>/g, "### $1\n\n");
  cleaned = cleaned.replace(/<p[^>]*>(.*?)<\/p>/g, "$1\n\n");
  cleaned = cleaned.replace(/<strong>(.*?)<\/strong>/g, "**$1**");
  cleaned = cleaned.replace(/<em>(.*?)<\/em>/g, "*$1*");
  cleaned = cleaned.replace(/<code>(.*?)<\/code>/g, "`$1`");
  cleaned = cleaned.replace(/<[^>]+>/g, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}
