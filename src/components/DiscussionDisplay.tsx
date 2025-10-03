import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { Discussion } from "../lib/clients/baz";

interface DiscussionDisplayProps {
  discussion: Discussion;
  mode: "view" | "reply";
  onReply: (text: string) => void;
  onCancelReply: () => void;
}

const DiscussionDisplay: React.FC<DiscussionDisplayProps> = ({
  discussion,
  mode,
  onReply,
}) => {
  const [replyText, setReplyText] = useState("");

  const handleSubmit = () => {
    if (replyText.trim()) {
      onReply(replyText);
      setReplyText("");
    }
  };

  return (
    <Box flexDirection="column">
      {/* Commented Code */}
      <Box marginBottom={1} flexDirection="column">
        <Box paddingX={1} backgroundColor="gray">
          <Text>File: {discussion.file}</Text>
        </Box>
        <Box
          paddingX={1}
          backgroundColor={discussion.side === "left" ? "#ff82ab" : "#9aff9a"}
        >
          <Text>{discussion.commented_code}</Text>
        </Box>
      </Box>

      {/* Comments */}
      {discussion.comments.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>{discussion.comments.length} comment(s):</Text>
          {discussion.comments.map((comment, idx) => (
            <Box
              key={idx}
              marginTop={1}
              paddingLeft={2}
              borderStyle="single"
              borderColor="gray"
            >
              <Box flexDirection="column">
                <Text color="yellow">
                  {comment.author_user
                    ? comment.author_user.display_name
                    : comment.author.split("/").pop() || comment.author}
                  :
                </Text>
                <Text>{comment.comment_body}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Reply Input */}
      {mode === "reply" && (
        <Box
          flexDirection="column"
          marginTop={1}
          borderStyle="round"
          borderColor="green"
        >
          <Box paddingX={1}>
            <Text color="green">Your reply: </Text>
          </Box>
          <Box paddingX={1}>
            <TextInput
              value={replyText}
              onChange={setReplyText}
              onSubmit={handleSubmit}
              placeholder="Type your reply..."
            />
          </Box>
          <Box paddingX={1} marginTop={1}>
            <Text dimColor italic>
              Enter to submit • Esc to cancel
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default DiscussionDisplay;
