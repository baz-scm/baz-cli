import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

marked.setOptions({
  // @ts-expect-error - marked-terminal types are not fully compatible with marked v9+
  renderer: new TerminalRenderer({
    showSectionPrefix: false,
    reflowText: true,
    width: process.stdout.columns || 80,
  }),
});

/**
 * Renders markdown text to ANSI-styled terminal output
 */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}
