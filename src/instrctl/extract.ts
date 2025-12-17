import axios from "axios";
import { env } from "../lib/env-schema.js";
import { normalizeStatement, sha256, inferenceTitle, idFromRandom } from "./utils.js";
import type { Occurrence, Principle } from "./types.js";

const MODAL_REGEX = /(MUST NOT|MUST|SHOULD|MAY)/i;

export interface ExtractResult {
  principles: Principle[];
  occurrences: Occurrence[];
}

interface LlmPrinciplePayload {
  title?: string;
  strength: "MUST" | "MUST_NOT" | "MUST NOT" | "SHOULD" | "MAY";
  statement: string;
  tags?: string[];
  rationale?: string;
  examples?: string[];
  start_line?: number;
  end_line?: number;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";

async function extractPrinciplesWithLlm(
  docPath: string,
  content: string,
  defaultScope: string[],
): Promise<ExtractResult | null> {
  const apiKey = env.ANTHROPIC_TOKEN || env.BAZ_LLM_TOKEN || env.BAZ_TOKEN;
  if (!apiKey) return null;

  const prompt = [
    "You are assisting instrctl, a tool that manages instruction documents in repositories.",
    "Extract individual normative principles from the provided markdown file and respond with strict JSON only.",
    "Each principle must include: strength (MUST, MUST_NOT, SHOULD, MAY), statement (concise requirement text),",
    "optional title, tags, rationale, examples, and source line numbers start_line/end_line.",
    "Do not invent requirements; only split atomic rules present in the text. Keep statements succinct and literal.",
    "Return the JSON payload in the form { \"principles\": [ ... ] } with no trailing commentary.",
    `Document path: ${docPath}`,
  ].join("\n");

  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: prompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: content.slice(0, 16000),
          },
        ],
      },
    ],
  };

  try {
    const response = await axios.post(ANTHROPIC_URL, body, {
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    const messageContent = response.data?.content?.[0]?.text;
    if (typeof messageContent !== "string") {
      return null;
    }
    const parsed = JSON.parse(messageContent.trim()) as { principles?: LlmPrinciplePayload[] };
    if (!parsed.principles?.length) return null;

    const lines = content.split(/\r?\n/);
    const principles: Principle[] = [];
    const occurrences: Occurrence[] = [];

    for (const principle of parsed.principles) {
      const strength = principle.strength.replace(/\s+/g, "_").toUpperCase() as Principle["strength"];
      const statement = principle.statement.trim();
      const normalized = normalizeStatement(statement);
      if (!normalized) continue;
      const id = idFromRandom();
      const firstMatch = lines.findIndex((line) => line.includes(statement));
      const inferredStart = firstMatch >= 0 ? firstMatch + 1 : 1;
      const startLine = principle.start_line ?? inferredStart;
      const endLine = principle.end_line ?? startLine;
      principles.push({
        id,
        title: principle.title || inferenceTitle(statement),
        strength,
        statement,
        scope: defaultScope,
        tags: principle.tags,
        rationale: principle.rationale,
        examples: principle.examples,
        sources: [
          {
            doc: docPath,
            span: { startLine, endLine },
            rawTextHash: sha256(lines[startLine - 1] || statement),
          },
        ],
        fingerprint: sha256(`${strength}-${normalized}`),
      });
      occurrences.push({
        principleId: id,
        doc: docPath,
        span: { startLine, endLine },
      });
    }

    return { principles, occurrences };
  } catch {
    console.warn("LLM extraction failed; falling back to heuristic parser");
    return null;
  }
}

function extractPrinciplesHeuristic(
  docPath: string,
  content: string,
  defaultScope: string[],
): ExtractResult {
  const principles: Principle[] = [];
  const occurrences: Occurrence[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    const match = line.match(MODAL_REGEX);
    if (!match) return;
    const strengthRaw = match[1].toUpperCase();
    const strength = strengthRaw === "MUST NOT" ? "MUST_NOT" : (strengthRaw as Principle["strength"]);
    const cleaned = line
      .replace(/^[-*]\s*/, "")
      .replace(/`/g, "")
      .replace(/\*\*/g, "")
      .trim();
    const statement = cleaned.replace(MODAL_REGEX, "").trim();
    const normalized = normalizeStatement(statement);
    if (!normalized) return;
    const id = idFromRandom();
    principles.push({
      id,
      title: inferenceTitle(statement),
      strength,
      statement,
      scope: defaultScope,
      sources: [
        {
          doc: docPath,
          span: { startLine: idx + 1, endLine: idx + 1 },
          rawTextHash: sha256(line),
        },
      ],
      fingerprint: sha256(`${strength}-${normalized}`),
    });
    occurrences.push({
      principleId: id,
      doc: docPath,
      span: { startLine: idx + 1, endLine: idx + 1 },
    });
  });

  return { principles, occurrences };
}

export async function extractPrinciples(
  docPath: string,
  content: string,
  defaultScope: string[],
): Promise<ExtractResult> {
  const llmResult = await extractPrinciplesWithLlm(docPath, content, defaultScope);
  if (llmResult) return llmResult;
  return extractPrinciplesHeuristic(docPath, content, defaultScope);
}
