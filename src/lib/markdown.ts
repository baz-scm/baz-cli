import { marked, MarkedExtension } from "marked";
import { markedTerminal } from "marked-terminal";
import chalk from "chalk";

let configured = false;

export function renderMarkdown(markdown: string): string {
  if (!configured) {
    // Force chalk to always use colors for markdown rendering
    chalk.level = 3;

    // markedTerminal types don't fully align with marked@11 but runtime works
    marked.use(markedTerminal({
      showSectionPrefix: false,
      reflowText: true,
      width: 80,
    }) as unknown as MarkedExtension);
    configured = true;
  }

  return marked.parse(markdown) as string;
}
