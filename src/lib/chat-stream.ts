import { ChatToolCall, CheckoutChatRequest } from "../models/chat.js";
import { streamChatResponse } from "./clients/baz.js";

export interface StreamHandlerCallbacks {
  onConversationId: (id: string) => void;
  onFirstContent: () => void;
  onUpdate: (content: string, toolCalls: ChatToolCall[], isFirst: boolean) => void;
}

export async function processStream(
  request: CheckoutChatRequest,
  callbacks: StreamHandlerCallbacks,
): Promise<void> {
  let accumulatedResponse = "";
  let toolCalls: ChatToolCall[] = [];
  let isFirstUpdate = true;

  const update = () => {
    callbacks.onUpdate(accumulatedResponse, toolCalls, isFirstUpdate);
    if (isFirstUpdate) {
      callbacks.onFirstContent();
      isFirstUpdate = false;
    }
  };

  for await (const chunk of streamChatResponse(request)) {
    if (chunk.conversationId) {
      callbacks.onConversationId(chunk.conversationId);
    }

    if (chunk.toolCall) {
      const { toolName, toolArgs, toolCallId, message } = chunk.toolCall;

      if (toolCallId) {
        toolCalls = [
          ...toolCalls,
          { id: toolCallId, toolName, toolArgs, message },
        ];
      } else {
        const lastPending = toolCalls.findLast((tc) => !tc.result);
        if (lastPending) {
          lastPending.message = message;
          toolCalls = [...toolCalls];
        }
      }

      update();
    }

    if (chunk.toolResult) {
      const { toolCallId, content } = chunk.toolResult;
      const toolCall =
        toolCalls.find((tc) => tc.id === toolCallId) ??
        toolCalls.findLast((tc) => !tc.result);

      if (toolCall) {
        toolCall.result = content;
        toolCalls = [...toolCalls];
        update();
      }
    }

    if (chunk.content) {
      accumulatedResponse += chunk.content;
      update();
    }
  }
}
