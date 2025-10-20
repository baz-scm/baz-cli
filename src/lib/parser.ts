import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkStringify from "remark-stringify";

export function parseHtmlToMarkdown(content: string) {
  return unified()
    .use(rehypeParse)
    .use(rehypeRemark)
    .use(remarkStringify, { bullet: "-", fences: true })
    .processSync(content)
    .toString()
    .trimEnd(); // remarkStringify adds an extra newline at the end
}
