import React, { useState, useEffect, memo, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
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
  }) => {
  const [value, setValue] = useState("");
  const [reviewers, setReviewers] = useState<ChangeReviewer[]>([]);
  const [forceHelpVisible, setForceHelpVisible] = useState(false);
  const appMode = useAppMode();
  const dataProvider = appMode.mode.dataProvider;

  useEffect(() => {
    if (enableMentions && prId && fullRepoName && prNumber !== undefined) {
      dataProvider
        .fetchEligibleReviewers({ prId, fullRepoName, prNumber })
        .then(setReviewers)
        .catch((error) => {
          console.error("Failed to fetch eligible reviewers:", error);
        });
    }
  }, [enableMentions, prId, fullRepoName, prNumber, dataProvider]);

  const mentionInfo = useMemo(() => {
    if (!enableMentions) {
      return { show: false, query: "", startIndex: -1 };
    }

    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex === -1) {
      return { show: false, query: "", startIndex: -1 };
    }

    const textAfterAt = value.slice(lastAtIndex + 1);
    if (textAfterAt.includes(" ")) {
      return { show: false, query: "", startIndex: -1 };
    }

    return {
      show: true,
      query: textAfterAt,
      startIndex: lastAtIndex,
    };
  }, [value, enableMentions]);

  const showFullHelp =
    forceHelpVisible ||
    (value.startsWith("/") && !value.includes(" ") && value.length > 0);

  useInput(
    (input, key) => {
      if (key.escape) {
        if (mentionInfo.show) {
          setValue(value.slice(0, mentionInfo.startIndex));
        } else {
          onBack();
        }
        return;
      }

      if (toolsExist && key.ctrl && input.toLowerCase() === "o") {
        onToggleToolCallExpansion();
        return;
      }

      if (value === "" && input === "?") {
        setForceHelpVisible((prev) => !prev);
        return;
      }
    },
    { isActive: !mentionInfo.show },
  );

  const handleSubmit = (submittedValue: string) => {
    if (submittedValue.trim() && !mentionInfo.show) {
      onSubmit(submittedValue);
      setValue("");
      setForceHelpVisible(false);
    }
  };

  const handleMentionSelect = (reviewer: MentionableUser) => {
    const lastSlashIndex = reviewer.login.lastIndexOf("/");
    const login = reviewer.login.substring(lastSlashIndex + 1);

    const beforeMention = value.slice(0, mentionInfo.startIndex);
    const afterMention = value.slice(
      mentionInfo.startIndex + mentionInfo.query.length + 1,
    );
    const newValue = `${beforeMention}@${login} ${afterMention}`.trimEnd();

    setValue(newValue);
  };

  const handleMentionCancel = () => {
    setValue(value.slice(0, mentionInfo.startIndex));
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

  const getFilteredCommandHints = () => {
    if (availableCommands.length === 0) return [];

    const hints: string[] = [];
    let commandsToShow = availableCommands;

    if (
      value.startsWith("/") &&
      value.length > 1 &&
      !value.includes(" ")
    ) {
      const searchTerm = value.slice(1).toLowerCase();
      commandsToShow = availableCommands.filter((cmd) => {
        const commandName = cmd.command.split(" ")[0].slice(1).toLowerCase();
        return commandName.startsWith(searchTerm);
      });
    }

    commandsToShow.forEach((cmd) => {
      hints.push(`${cmd.command} - ${cmd.description}`);
    });

    if (commandsToShow.length === 0 && value.startsWith("/")) {
      hints.push("No matching commands");
    }

    hints.push("? to hide help");
    hints.push("ESC to go back");
    return hints;
  };

    return (
      <Box flexDirection="column">
        <Box
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          flexShrink={1}
        >
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder={placeholder}
          />
        </Box>
        {enableMentions && mentionInfo.show && reviewers.length > 0 && (
          <MentionAutocomplete
            reviewers={reviewers}
            searchQuery={mentionInfo.query}
            onSelect={handleMentionSelect}
            onCancel={handleMentionCancel}
          />
        )}
        {!mentionInfo.show && (
          <Box marginTop={1}>
            <Text dimColor>
              {showFullHelp
                ? getFilteredCommandHints().join("\n")
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
      prevProps.availableCommands === nextProps.availableCommands &&
      prevProps.enableMentions === nextProps.enableMentions &&
      prevProps.prId === nextProps.prId &&
      prevProps.fullRepoName === nextProps.fullRepoName &&
      prevProps.prNumber === nextProps.prNumber &&
      prevProps.toolsExist === nextProps.toolsExist &&
      prevProps.terminalWidth === nextProps.terminalWidth &&
      prevProps.onSubmit === nextProps.onSubmit &&
      prevProps.onBack === nextProps.onBack &&
      prevProps.onToggleToolCallExpansion === nextProps.onToggleToolCallExpansion
    );
  },
);

export default ChatInput;
