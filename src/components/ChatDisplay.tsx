import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { ChatMessage, MentionableUser } from "../models/chat.js";
import { IssueCommand } from "../issues/types.js";
import { ChangeReviewer, fetchEligibleReviewers } from "../lib/clients/baz.js";
import MentionAutocomplete from "./MentionAutocomplete.js";

interface ChatDisplayProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSubmit: (message: string) => void;
  availableCommands?: IssueCommand[];
  disabled?: boolean;
  prId?: string;
  enableMentions?: boolean;
  onBack: () => void;
}

const ChatDisplay: React.FC<ChatDisplayProps> = ({
  messages,
  isLoading,
  onSubmit,
  availableCommands = [],
  disabled = false,
  prId,
  enableMentions = false,
  onBack,
}) => {
  const { stdout } = useStdout();
  const [inputValue, setInputValue] = useState("");
  const [showFullHelp, setShowFullHelp] = useState(false);
  const [reviewers, setReviewers] = useState<ChangeReviewer[]>([]);
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [inputKey, setInputKey] = useState(0);
  const [terminalWidth, setTerminalWidth] = useState(stdout?.columns || 80);

  useEffect(() => {
    const handleResize = () => {
      if (stdout?.columns) {
        setTerminalWidth(stdout.columns);
        setInputKey((prev) => prev + 1);
      }
    };

    if (stdout) {
      stdout.on("resize", handleResize);

      return () => {
        stdout.off("resize", handleResize);
      };
    }
  }, [stdout]);

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
          onBack();
        }
      }
      if (input === "?" && !isLoading && !disabled && inputValue === "") {
        setShowFullHelp((prev) => !prev);
      }
    },
    { isActive: !showMentionAutocomplete },
  );

  const handleInputChange = (value: string) => {
    if (inputValue === "" && value.startsWith("?")) {
      setInputKey((prev) => prev + 1);
      return;
    }

    setInputValue(value);

    if (value.startsWith("/") && !value.includes(" ")) {
      setShowFullHelp(true);
    } else if (showFullHelp && !value.startsWith("/")) {
      setShowFullHelp(false);
    }

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
        (cmd) => cmd.command.includes("next") || cmd.aliases?.includes("/next"),
      );
      if (nextCmd) {
        hints.push(`${nextCmd.command} for next issue`);
      }
    }

    hints.push("? for help");
    hints.push("ESC to go back");
    hints.push("Ctrl + C to quit");
    return hints;
  };

  const getAllCommandHints = () => {
    if (availableCommands.length === 0) return [];

    const hints: string[] = [];
    let commandsToShow = availableCommands;

    if (
      inputValue.startsWith("/") &&
      inputValue.length > 1 &&
      !inputValue.includes(" ")
    ) {
      const searchTerm = inputValue.slice(1).toLowerCase();
      commandsToShow = availableCommands.filter((cmd) => {
        const commandName = cmd.command.split(" ")[0].slice(1).toLowerCase();
        return commandName.startsWith(searchTerm);
      });
    }

    commandsToShow.forEach((cmd) => {
      hints.push(`${cmd.command} - ${cmd.description}`);
    });

    if (commandsToShow.length === 0 && inputValue.startsWith("/")) {
      hints.push("No matching commands");
    }

    hints.push("? to hide help");
    hints.push("ESC to go back");
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
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            width={terminalWidth}
            flexShrink={1}
          >
            <TextInput
              key={inputKey}
              value={inputValue}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              placeholder="How will it affect the code?"
            />
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
