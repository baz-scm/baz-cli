import React, { useState, useEffect, memo, useMemo, useRef } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { MentionableUser } from "../../models/chat.js";
import { IssueCommand } from "../../issues/types.js";
import {
  ChangeReviewer,
  fetchEligibleReviewers,
} from "../../lib/clients/baz.js";
import MentionAutocomplete from "../../components/MentionAutocomplete.js";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  placeholder: string;
  availableCommands: IssueCommand[];
  enableMentions: boolean;
  prId?: string;
  onBack: () => void;
  toolsExist: boolean;
  onToggleToolCallExpansion: () => void;
  terminalWidth: number;
}

const ChatInput = memo<ChatInputProps>(
  ({
    onSubmit,
    placeholder,
    availableCommands,
    enableMentions,
    prId,
    onBack,
    toolsExist,
    onToggleToolCallExpansion,
    terminalWidth,
  }) => {
    const [inputValue, setInputValue] = useState("");
    const [showFullHelp, setShowFullHelp] = useState(false);
    const [reviewers, setReviewers] = useState<ChangeReviewer[]>([]);
    const [showMentionAutocomplete, setShowMentionAutocomplete] =
      useState(false);
    const [mentionSearchQuery, setMentionSearchQuery] = useState("");
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);

    // Use ref to track input value for useInput callback to avoid stale closures
    const inputValueRef = useRef(inputValue);
    inputValueRef.current = inputValue;

    // Track when a Ctrl shortcut was pressed to skip the character in TextInput
    const skipNextInputRef = useRef(false);

    useEffect(() => {
      if (enableMentions && prId) {
        fetchEligibleReviewers(prId)
          .then(setReviewers)
          .catch((error) => {
            console.error("Failed to fetch eligible reviewers:", error);
          });
      }
    }, [enableMentions, prId]);

    // Only handle escape key in useInput - let TextInput handle all other input
    useInput(
      (input, key) => {
        if (key.escape) {
          if (showMentionAutocomplete) {
            setShowMentionAutocomplete(false);
            setMentionSearchQuery("");
            setMentionStartIndex(-1);
          } else {
            onBack();
          }
        } else if (toolsExist && key.ctrl && input.toLowerCase() === "o") {
          skipNextInputRef.current = true; // Skip the "o" that TextInput will add
          onToggleToolCallExpansion();
        }
      },
      { isActive: !showMentionAutocomplete },
    );

    const handleInputChange = (value: string) => {
      // Handle "?" for help toggle when input is empty
      if (inputValueRef.current === "" && value === "?") {
        setShowFullHelp((prev) => !prev);
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
    };

    const handleMentionCancel = () => {
      setShowMentionAutocomplete(false);
      setMentionSearchQuery("");
      setMentionStartIndex(-1);
    };

    const handleSubmit = () => {
      if (inputValue.trim() && !showMentionAutocomplete) {
        onSubmit(inputValue);
        setInputValue("");
        setShowFullHelp(false);
      }
    };

    const defaultHints = useMemo(() => {
      const hints: string[] = [];

      if (availableCommands.length > 0) {
        const nextCmd = availableCommands.find(
          (cmd) =>
            cmd.command.includes("next") || cmd.aliases?.includes("/next"),
        );
        if (nextCmd) {
          hints.push(`${nextCmd.command} for next issue`);
        }
      }

      if (availableCommands.length > 0) {
        hints.push("? for help");
      }

      hints.push("ESC to go back");
      hints.push("Ctrl + C to quit");
      return hints;
    }, [availableCommands]);

    const allCommandHints = useMemo(() => {
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
    }, [availableCommands, inputValue]);

    return (
      <Box flexDirection="column">
        <Box
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          width={terminalWidth}
          flexShrink={1}
        >
          <TextInput
            value={inputValue}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            placeholder={placeholder}
          />
        </Box>
        {enableMentions && showMentionAutocomplete && reviewers.length > 0 && (
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
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.enableMentions === nextProps.enableMentions &&
      prevProps.prId === nextProps.prId &&
      prevProps.terminalWidth === nextProps.terminalWidth &&
      prevProps.availableCommands?.length ===
        nextProps.availableCommands?.length &&
      prevProps.availableCommands?.every(
        (cmd, i) =>
          cmd.command === nextProps.availableCommands?.[i]?.command &&
          cmd.description === nextProps.availableCommands?.[i]?.description,
      )
    );
  },
);

export default ChatInput;
