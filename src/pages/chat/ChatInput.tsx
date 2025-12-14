import React, { useState, useEffect, memo, useMemo, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { MentionableUser } from "../../models/chat.js";
import { IssueCommand } from "../../issues/types.js";
import type { ChangeReviewer } from "../../lib/providers/index.js";
import { useAppMode } from "../../lib/config/AppModeContext.js";
import MentionAutocomplete from "../../components/MentionAutocomplete.js";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  placeholder: string;
  availableCommands: IssueCommand[];
  enableMentions: boolean;
  prId?: string;
  fullRepoName?: string;
  prNumber?: number;
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
    fullRepoName,
    prNumber,
    onBack,
    toolsExist,
    onToggleToolCallExpansion,
    terminalWidth,
  }) => {
    const [displayValue, setDisplayValue] = useState("");
    const [showFullHelp, setShowFullHelp] = useState(false);
    const [reviewers, setReviewers] = useState<ChangeReviewer[]>([]);
    const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
    const [mentionSearchQuery, setMentionSearchQuery] = useState("");
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);
    const appMode = useAppMode();
    const dataProvider = appMode.mode.dataProvider;

    const inputRef = useRef("");
    const cursorPosRef = useRef(0);

    // Sync display with ref - immediate update
    const syncDisplay = () => {
      setDisplayValue(inputRef.current);
      const value = inputRef.current;
      if (value.startsWith("/") && !value.includes(" ")) {
        setShowFullHelp(true);
      } else if (!value.startsWith("/")) {
        setShowFullHelp(false);
      }

      if (enableMentions) {
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
      }
    };

    useEffect(() => {
      if (enableMentions && prId && fullRepoName && prNumber !== undefined) {
        dataProvider
          .fetchEligibleReviewers({ prId, fullRepoName, prNumber })
          .then(setReviewers)
          .catch((error) => {
            console.error("Failed to fetch eligible reviewers:", error);
          });
      }
    }, [enableMentions, prId, fullRepoName, prNumber]);

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
          return;
        }

        if (toolsExist && key.ctrl && input.toLowerCase() === "o") {
          onToggleToolCallExpansion();
          return;
        }

        if (key.return) {
          const value = inputRef.current.trim();
          if (value && !showMentionAutocomplete) {
            onSubmit(value);
            inputRef.current = "";
            cursorPosRef.current = 0;
            setDisplayValue("");
            setShowFullHelp(false);
          }
          return;
        }

        if (key.backspace || key.delete) {
          if (cursorPosRef.current > 0) {
            const before = inputRef.current.slice(0, cursorPosRef.current - 1);
            const after = inputRef.current.slice(cursorPosRef.current);
            inputRef.current = before + after;
            cursorPosRef.current--;
            syncDisplay();
          }
          return;
        }

        if (key.leftArrow) {
          if (cursorPosRef.current > 0) {
            cursorPosRef.current--;
            syncDisplay();
          }
          return;
        }

        if (key.rightArrow) {
          if (cursorPosRef.current < inputRef.current.length) {
            cursorPosRef.current++;
            syncDisplay();
          }
          return;
        }

        if (inputRef.current === "" && input === "?") {
          setShowFullHelp((prev) => !prev);
          return;
        }

        if (input && !key.ctrl && !key.meta) {
          const before = inputRef.current.slice(0, cursorPosRef.current);
          const after = inputRef.current.slice(cursorPosRef.current);
          inputRef.current = before + input + after;
          cursorPosRef.current += input.length;
          syncDisplay();
        }
      },
      { isActive: !showMentionAutocomplete },
    );

    const handleMentionSelect = (reviewer: MentionableUser) => {
      const lastSlashIndex = reviewer.login.lastIndexOf("/");
      const login = reviewer.login.substring(lastSlashIndex + 1);

      const beforeMention = inputRef.current.slice(0, mentionStartIndex);
      const afterMention = inputRef.current.slice(
        mentionStartIndex + mentionSearchQuery.length + 1,
      );
      const newValue = `${beforeMention}@${login} ${afterMention}`.trimEnd();

      inputRef.current = newValue;
      cursorPosRef.current = newValue.length;
      setDisplayValue(newValue);
      setShowMentionAutocomplete(false);
      setMentionSearchQuery("");
      setMentionStartIndex(-1);
    };

    const handleMentionCancel = () => {
      setShowMentionAutocomplete(false);
      setMentionSearchQuery("");
      setMentionStartIndex(-1);
    };

    const defaultHints = useMemo(() => {
      const hints: string[] = [];

      if (availableCommands.length > 0) {
        const nextCmd = availableCommands.find(
          (cmd) =>
            cmd.command.includes("next") || cmd.aliases?.includes("/next"),
        );
        if (nextCmd) {
          const cmdDisplay = nextCmd.command.startsWith("/")
            ? nextCmd.command
            : `/${nextCmd.command}`;
          hints.push(`Ask questions or use ${cmdDisplay} to continue`);
        }

        const explainCmd = availableCommands.find(
          (cmd) =>
            cmd.command.includes("explain") ||
            cmd.aliases?.includes("/explain"),
        );
        if (explainCmd) {
          const cmdDisplay = explainCmd.command.startsWith("/")
            ? explainCmd.command
            : `/${explainCmd.command}`;
          hints.push(`${cmdDisplay} for additional information`);
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
        displayValue.startsWith("/") &&
        displayValue.length > 1 &&
        !displayValue.includes(" ")
      ) {
        const searchTerm = displayValue.slice(1).toLowerCase();
        commandsToShow = availableCommands.filter((cmd) => {
          const commandName = cmd.command.split(" ")[0].slice(1).toLowerCase();
          return commandName.startsWith(searchTerm);
        });
      }

      commandsToShow.forEach((cmd) => {
        hints.push(`${cmd.command} - ${cmd.description}`);
      });

      if (commandsToShow.length === 0 && displayValue.startsWith("/")) {
        hints.push("No matching commands");
      }

      hints.push("? to hide help");
      hints.push("ESC to go back");
      return hints;
    }, [availableCommands, displayValue]);

    // Build the display with cursor
    const displayWithCursor = useMemo(() => {
      if (displayValue === "") {
        return <Text dimColor>{placeholder}</Text>;
      }
      // Show text with cursor indicator
      const before = displayValue.slice(0, cursorPosRef.current);
      const after = displayValue.slice(cursorPosRef.current);
      return (
        <Text>
          {before}
          <Text inverse> </Text>
          {after}
        </Text>
      );
    }, [displayValue, placeholder]);

    return (
      <Box flexDirection="column">
        <Box
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          width={terminalWidth}
          flexShrink={1}
        >
          {displayWithCursor}
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
);

export default ChatInput;
