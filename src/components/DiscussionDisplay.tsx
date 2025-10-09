import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { Discussion } from "../lib/clients/baz";
import DiffDisplayContainer from "./DiffDisplayContainer";

interface DiscussionDisplayProps {
  discussion: Discussion;
  prId: string;
  mode: "view" | "reply";
  onReply: (text: string) => void;
  onCancelReply: () => void;
}

const DiscussionDisplay: React.FC<DiscussionDisplayProps> = ({
  discussion,
  prId,
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
      <DiffDisplayContainer
        key={discussion.id}
        prId={prId}
        commit={discussion.commit_sha}
        fileSelectionLines={
          new Map([
            [
              discussion.file ?? "", // will fail on diff retrieval if `file` is undefined
              {
                start: discussion.original_start_line,
                end: discussion.original_end_line,
                side: discussion.side,
              },
            ],
          ])
        }
        outdated={discussion.outdated}
      />

      {/* Comments */}
      {discussion.comments.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>{discussion.comments.length} comment(s):</Text>
          {discussion.comments.map((comment) => (
            <Box
              key={comment.id}
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
