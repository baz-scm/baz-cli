import { ChatToolCall, CheckoutChatRequest } from "../models/chat.js";
import { streamChatResponse } from "./clients/baz.js";

export interface StreamHandlerCallbacks {
  onConversationId: (id: string) => void;
  onFirstTextContent: () => void;
  onUpdate: (
    content: string,
    toolCalls: ChatToolCall[],
    isFirst: boolean,
  ) => void;
}

export async function processStream(
  request: CheckoutChatRequest,
  callbacks: StreamHandlerCallbacks,
): Promise<void> {
  let accumulatedResponse = "";
  let toolCalls: ChatToolCall[] = [];
  let isFirstUpdate = true;
  let hasReceivedTextContent = false;

  const update = () => {
    callbacks.onUpdate(accumulatedResponse, toolCalls, isFirstUpdate);
    isFirstUpdate = false;
  };

  for await (const chunk of streamChatResponse(request)) {
    if (chunk.conversationId) {
      callbacks.onConversationId(chunk.conversationId);
    }

    if (chunk.toolCall) {
      const { toolName, toolArgs, toolCallId, message } = chunk.toolCall;

      if (toolCallId && !message) {
        // New tool call with ID
        toolCalls = [
          ...toolCalls,
          { id: toolCallId, toolName, toolArgs, message },
        ];
      } else {
        // Update message - prefer matching by toolCallId if available
        let targetIndex = -1;
        if (toolCallId) {
          targetIndex = toolCalls.findIndex((tc) => tc.id === toolCallId);
        }
        // Fallback: match by toolName + toolArgs
        if (targetIndex === -1) {
          const argsKey = JSON.stringify(toolArgs);
          targetIndex = toolCalls.findIndex(
            (tc) =>
              !tc.result &&
              tc.toolName === toolName &&
              JSON.stringify(tc.toolArgs) === argsKey,
          );
        }
        // Final fallback: first pending without message
        const finalIndex =
          targetIndex !== -1
            ? targetIndex
            : toolCalls.findIndex((tc) => !tc.result && !tc.message);
        if (finalIndex !== -1) {
          toolCalls = toolCalls.map((tc, i) =>
            i === finalIndex ? { ...tc, message } : tc,
          );
        }
      }

      update();
    }

    if (chunk.toolResult) {
      const { toolCallId, content } = chunk.toolResult;
      // Find by ID first, fallback to last pending
      const targetIndex = toolCalls.findIndex((tc) => tc.id === toolCallId);
      const finalIndex =
        targetIndex !== -1
          ? targetIndex
          : toolCalls.findLastIndex((tc) => !tc.result);

      if (finalIndex !== -1) {
        // Create new object to trigger React re-render
        toolCalls = toolCalls.map((tc, i) =>
          i === finalIndex ? { ...tc, result: content } : tc,
        );
        update();
      }
    }

    if (chunk.content) {
      accumulatedResponse += chunk.content;
      // Only notify on first TEXT content (not tool calls)
      if (!hasReceivedTextContent) {
        hasReceivedTextContent = true;
        callbacks.onFirstTextContent();
      }
      update();
    }
  }
}
