import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { Issue, IssueContext } from "../types";
import DiffDisplayContainer from "../../components/DiffDisplayContainer";

interface DiscussionIssueDisplayProps {
  issue: Issue & { type: "discussion" };
  context: IssueContext;
  onReply: (text: string) => void;
}

const DiscussionIssueDisplay: React.FC<DiscussionIssueDisplayProps> = ({
  issue,
  context,
  onReply,
}) => {
  const [replyText, setReplyText] = useState("");
  const discussion = issue.data;

  // Handle escape key to exit reply mode
  useInput((_input, key) => {
    if (key.escape && context.mode === "reply") {
      context.setIssueMode("view");
    }
  });

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
        prId={context.prId}
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
      {context.mode === "reply" && (
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

      {/* Help text */}
      {context.mode === "view" && (
        <Box marginTop={1}>
          <Text dimColor italic>
            r: reply • c: close • n: next • Ctrl+C: cancel
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default DiscussionIssueDisplay;
