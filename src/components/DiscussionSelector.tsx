import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Discussion } from "../lib/clients/baz";
import DiscussionDisplay from "./DiscussionDisplay";
import { useDiscussionActions } from "../hooks/useDiscussionActions";

interface DiscussionReviewProps {
  discussions: Discussion[];
  prId: string;
  onComplete: () => void;
}

const DiscussionSelector: React.FC<DiscussionReviewProps> = ({
  discussions,
  onComplete,
  prId,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<"view" | "reply">("view");

  const { replyDiscussion, resolveDiscussion } = useDiscussionActions();

  const currentDiscussion = discussions[currentIndex];
  const hasNext = currentIndex < discussions.length - 1;

  useInput((input) => {
    if (mode === "view") {
      if (input === "r") {
        setMode("reply");
      } else if (input === "c") {
        handleClose();
      } else if (input === "n" && hasNext) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onComplete();
      }
    }
  });

  const handleReply = async (replyText: string) => {
    try {
      await replyDiscussion(currentDiscussion.id, replyText, prId);
      setMode("view");
      if (hasNext) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onComplete();
      }
    } catch (error) {
      console.error("Failed to reply:", error);
    }
  };

  const handleClose = async () => {
    try {
      await resolveDiscussion(currentDiscussion.id);
      if (hasNext) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onComplete();
      }
    } catch (error) {
      console.error("Failed to reply:", error);
    }
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan">
          Discussion {currentIndex + 1} of {discussions.length}
        </Text>
      </Box>

      <DiscussionDisplay
        discussion={currentDiscussion}
        mode={mode}
        onReply={handleReply}
        onCancelReply={() => setMode("view")}
      />

      {mode === "view" && (
        <Box marginTop={1}>
          <Text dimColor italic>
            r: reply • c: close • n: next • Ctrl+C: cancel
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default DiscussionSelector;
