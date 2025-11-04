import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { ChatMessage } from "../lib/types/chat";
import { IssueCommand } from "../issues/types";

interface ChatDisplayProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSubmit: (message: string) => void;
  availableCommands?: IssueCommand[];
  disabled?: boolean;
}

const ChatDisplay: React.FC<ChatDisplayProps> = ({
  messages,
  isLoading,
  onSubmit,
  availableCommands = [],
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [showFullHelp, setShowFullHelp] = useState(false);

  useInput((input, key) => {
    if (key.escape && !isLoading && !disabled) {
      setInputValue("");
      setShowFullHelp(false);
    }
    if (input === "?" && !isLoading && !disabled && inputValue === "") {
      setShowFullHelp(true);
    }
  });

  const handleSubmit = () => {
    if (inputValue.trim() && !isLoading && !disabled) {
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
        <Box flexDirection="column" marginBottom={1}>
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
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                placeholder="How will it affect the code?"
              />
            </Box>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>
              {showFullHelp
                ? allCommandHints.join("\n")
                : defaultHints.join("\n")}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ChatDisplay;
