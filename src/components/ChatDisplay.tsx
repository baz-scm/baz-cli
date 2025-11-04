import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { ChatMessage, MentionableUser } from "../models/chat.js";
import { IssueCommand } from "../issues/types.js";
import { ChangeReviewer, fetchEligibleReviewers } from "../lib/clients/baz";
import MentionAutocomplete from "./MentionAutocomplete";

interface ChatDisplayProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSubmit: (message: string) => void;
  availableCommands?: IssueCommand[];
  disabled?: boolean;
  prId?: string;
  enableMentions?: boolean;
}

const ChatDisplay: React.FC<ChatDisplayProps> = ({
  messages,
  isLoading,
  onSubmit,
  availableCommands = [],
  disabled = false,
  prId,
  enableMentions = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [showFullHelp, setShowFullHelp] = useState(false);
  const [reviewers, setReviewers] = useState<ChangeReviewer[]>([]);
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => {
    if (enableMentions && prId) {
      fetchEligibleReviewers(prId)
        .then(setReviewers)
        .catch((error) => {
          console.error("Failed to fetch eligible reviewers:", error);
        });
    }
  }, [enableMentions, prId]);

  useInput(
    (input, key) => {
      if (key.escape && !isLoading && !disabled) {
        if (showMentionAutocomplete) {
          setShowMentionAutocomplete(false);
          setMentionSearchQuery("");
          setMentionStartIndex(-1);
        } else {
          setInputValue("");
          setShowFullHelp(false);
        }
      }
      if (input === "?" && !isLoading && !disabled && inputValue === "") {
        setShowFullHelp(true);
      }
    },
    { isActive: !showMentionAutocomplete },
  );

  const handleInputChange = (value: string) => {
    setInputValue(value);

    if (!enableMentions) {
      return;
    }

    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const textAfterAt = value.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(" ")) {
        setShowMentionAutocomplete(true);
        setMentionSearchQuery(textAfterAt);
        setMentionStartIndex(lastAtIndex);
      } else {
        setShowMentionAutocomplete(false);
        setMentionSearchQuery("");
        setMentionStartIndex(-1);
      }
    } else {
      setShowMentionAutocomplete(false);
      setMentionSearchQuery("");
      setMentionStartIndex(-1);
    }
  };

  const handleMentionSelect = (reviewer: MentionableUser) => {
    const lastSlashIndex = reviewer.login.lastIndexOf("/");
    const login = reviewer.login.substring(lastSlashIndex + 1);

    const beforeMention = inputValue.slice(0, mentionStartIndex);
    const afterMention = inputValue.slice(
      mentionStartIndex + mentionSearchQuery.length + 1,
    );
    const newValue = `${beforeMention}@${login} ${afterMention}`.trimEnd();

    setInputValue(newValue);
    setShowMentionAutocomplete(false);
    setMentionSearchQuery("");
    setMentionStartIndex(-1);
    setInputKey((prev) => prev + 1);
  };

  const handleMentionCancel = () => {
    setShowMentionAutocomplete(false);
    setMentionSearchQuery("");
    setMentionStartIndex(-1);
  };

  const handleSubmit = () => {
    if (
      inputValue.trim() &&
      !isLoading &&
      !disabled &&
      !showMentionAutocomplete
    ) {
      onSubmit(inputValue);
      setInputValue("");
      setShowFullHelp(false);
    }
  };

  const getDefaultHints = () => {
    const hints: string[] = [];

    if (availableCommands.length > 0) {
      const nextCmd = availableCommands.find(
        (cmd) => cmd.command.includes("next") || cmd.aliases?.includes("/n"),
      );
      if (nextCmd) {
        const shortCmd = nextCmd.aliases?.[0] || nextCmd.command.split(" ")[0];
        hints.push(`${shortCmd} for next issue`);
      }
    }

    hints.push("? for help");
    hints.push("Ctrl + C to quit");
    return hints;
  };

  const getAllCommandHints = () => {
    if (availableCommands.length === 0) return [];

    const hints: string[] = [];
    availableCommands.forEach((cmd) => {
      const shortCmd = cmd.aliases?.[0] || cmd.command.split(" ")[0];
      hints.push(`${shortCmd} - ${cmd.description}`);
    });
    hints.push("ESC to exit");
    return hints;
  };

  const defaultHints = getDefaultHints();
  const allCommandHints = getAllCommandHints();

  return (
    <Box flexDirection="column">
      {messages.length > 0 && (
        <Box flexDirection="column" marginBottom={0}>
          {messages.map((message, index) => (
            <Box key={index} flexDirection="column" marginBottom={1}>
              <Text bold color={message.role === "user" ? "cyan" : "yellow"}>
                {message.role === "user" ? "You:" : "Baz:"}
              </Text>
              <Box paddingLeft={2}>
                <Text>{message.content}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {isLoading && (
        <Box marginBottom={1}>
          <Text color="magenta">
            <Spinner type="dots" />
          </Text>
          <Text color="magenta"> Thinking...</Text>
        </Box>
      )}

      {!disabled && !isLoading && (
        <Box flexDirection="column">
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
          >
            <Box>
              <TextInput
                key={inputKey}
                value={inputValue}
                onChange={handleInputChange}
                onSubmit={handleSubmit}
                placeholder="How will it affect the code?"
              />
            </Box>
          </Box>
          {enableMentions &&
            showMentionAutocomplete &&
            reviewers.length > 0 && (
              <MentionAutocomplete
                reviewers={reviewers}
                searchQuery={mentionSearchQuery}
                onSelect={handleMentionSelect}
                onCancel={handleMentionCancel}
              />
            )}
          {!showMentionAutocomplete && (
            <Box marginTop={1}>
              <Text dimColor>
                {showFullHelp
                  ? allCommandHints.join("\n")
                  : defaultHints.join("\n")}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ChatDisplay;
