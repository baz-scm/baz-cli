import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from "react";
import { Box, Text, useInput } from "ink";
import { MentionableUser } from "../../models/chat.js";
import { IssueCommand } from "../../issues/types.js";
import type { ChangeReviewer } from "../../lib/providers/index.js";
import { useAppMode } from "../../lib/config/index.js";
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

// Throttle updates ~60fps
const THROTTLE_MS = 16;

const ChatInput = memo<ChatInputProps>((props) => {
  const {
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
  } = props;

  const appMode = useAppMode();
  const dataProvider = appMode.mode.dataProvider;

  const visibleWidth = Math.max(10, terminalWidth - 6);

  const textRef = useRef("");
  const cursorRef = useRef(0);
  const throttleRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRef = useRef(false);

  const [display, setDisplay] = useState({ text: "", cursor: 0 });

  const [showFullHelp, setShowFullHelp] = useState(false);
  const [reviewers, setReviewers] = useState<ChangeReviewer[]>([]);
  const [mention, setMention] = useState({
    show: false,
    query: "",
    startIndex: -1,
  });

  const syncDisplay = useCallback((immediate = false) => {
    if (immediate) {
      if (throttleRef.current) clearTimeout(throttleRef.current);
      throttleRef.current = null;
      setDisplay({ text: textRef.current, cursor: cursorRef.current });
      pendingRef.current = false;
      return;
    }

    pendingRef.current = true;
    if (!throttleRef.current) {
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null;
        if (pendingRef.current) {
          setDisplay({ text: textRef.current, cursor: cursorRef.current });
          pendingRef.current = false;
        }
      }, THROTTLE_MS);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (throttleRef.current) clearTimeout(throttleRef.current);
    };
  }, []);

  const checkMention = useCallback(() => {
    if (!enableMentions) return;
    const text = textRef.current;
    const lastAt = text.lastIndexOf("@");
    if (lastAt === -1 || text.slice(lastAt + 1).includes(" ")) {
      if (mention.show) setMention({ show: false, query: "", startIndex: -1 });
      return;
    }
    const query = text.slice(lastAt + 1);
    setMention({ show: true, query, startIndex: lastAt });

    // Auto-cancel if no reviewers available after a brief delay
    if (reviewers.length === 0) {
      setTimeout(() => {
        if (reviewers.length === 0) {
          setMention({ show: false, query: "", startIndex: -1 });
        }
      }, 500); // give fetch a chance
    }
  }, [enableMentions, mention.show, reviewers.length]);

  useEffect(() => {
    if (enableMentions && prId && fullRepoName && prNumber !== undefined) {
      dataProvider
        .fetchEligibleReviewers({ prId, fullRepoName, prNumber })
        .then(setReviewers)
        .catch((error) => {
          console.error("Failed to fetch eligible reviewers:", error);
          // Clear mention state if fetch fails
          setMention((prev) => {
            if (prev.show) {
              return { show: false, query: "", startIndex: -1 };
            }
            return prev;
          });
        });
    }
  }, [enableMentions, prId, fullRepoName, prNumber, dataProvider]);

  const handleMentionSelect = useCallback(
    (reviewer: MentionableUser) => {
      const login = reviewer.login.split("/").pop() || reviewer.login;
      const before = textRef.current.slice(0, mention.startIndex);
      const after = textRef.current.slice(
        mention.startIndex + mention.query.length + 1,
      );
      const newValue = `${before}@${login} ${after}`.trimEnd();
      textRef.current = newValue;
      cursorRef.current = newValue.length;
      setMention({ show: false, query: "", startIndex: -1 });
      syncDisplay(true);
    },
    [mention, syncDisplay],
  );

  const handleMentionCancel = useCallback(() => {
    textRef.current = textRef.current.slice(0, mention.startIndex);
    cursorRef.current = mention.startIndex;
    setMention({ show: false, query: "", startIndex: -1 });
    syncDisplay(true);
  }, [mention, syncDisplay]);

  useInput((input, key) => {
    if (key.escape) {
      if (mention.show) {
        textRef.current = textRef.current.slice(0, mention.startIndex);
        cursorRef.current = mention.startIndex;
        setMention({ show: false, query: "", startIndex: -1 });
        syncDisplay(true);
      } else onBack();
      return;
    }

    if (key.tab && toolsExist) {
      onToggleToolCallExpansion();
      return;
    }

    if (key.return) {
      const val = textRef.current.trim();
      if (val && !mention.show) {
        onSubmit(val);
        textRef.current = "";
        cursorRef.current = 0;
        setShowFullHelp(false);
        syncDisplay(true);
      }
      return;
    }

    if (textRef.current === "" && input === "?") {
      setShowFullHelp((prev) => !prev);
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorRef.current > 0) {
        textRef.current =
          textRef.current.slice(0, cursorRef.current - 1) +
          textRef.current.slice(cursorRef.current);
        cursorRef.current--;
        syncDisplay();
        checkMention();
      }
      return;
    }

    // Skip up/down arrows when mention autocomplete is active
    if (key.upArrow || key.downArrow) {
      if (mention.show && reviewers.length > 0) {
        return; // let MentionAutocomplete handle
      }
    }

    // Left/right arrows always work
    if (key.leftArrow && cursorRef.current > 0) {
      cursorRef.current--;
      syncDisplay();
      return;
    }
    if (key.rightArrow && cursorRef.current < textRef.current.length) {
      cursorRef.current++;
      syncDisplay();
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      textRef.current =
        textRef.current.slice(0, cursorRef.current) +
        input +
        textRef.current.slice(cursorRef.current);
      cursorRef.current += input.length;

      if (textRef.current.startsWith("/") && !textRef.current.includes(" "))
        setShowFullHelp(true);
      else if (!textRef.current.startsWith("/")) setShowFullHelp(false);

      syncDisplay();
      checkMention();
    }
  });

  const defaultHints = useMemo(() => {
    const hints: string[] = [];
    if (availableCommands.length > 0) {
      const nextCmd = availableCommands.find(
        (c) => c.command.includes("next") || c.aliases?.includes("/next"),
      );
      if (nextCmd) {
        const cmdDisplay = nextCmd.command.startsWith("/")
          ? nextCmd.command
          : `/${nextCmd.command}`;
        hints.push(`Ask questions or use ${cmdDisplay} to continue`);
      }
      const explainCmd = availableCommands.find(
        (c) => c.command.includes("explain") || c.aliases?.includes("/explain"),
      );
      if (explainCmd) {
        const cmdDisplay = explainCmd.command.startsWith("/")
          ? explainCmd.command
          : `/${explainCmd.command}`;
        hints.push(`${cmdDisplay} for additional info`);
      }
      hints.push("? for help");
    }
    hints.push("ESC to go back");
    hints.push("Ctrl + C to quit");
    return hints;
  }, [availableCommands]);

  const commandHints = useMemo(() => {
    if (!availableCommands.length) return [];
    const hints: string[] = [];
    let cmds = availableCommands;
    if (
      display.text.startsWith("/") &&
      display.text.length > 1 &&
      !display.text.includes(" ")
    ) {
      const search = display.text.slice(1).toLowerCase();
      cmds = availableCommands.filter((c) =>
        c.command.split(" ")[0].slice(1).toLowerCase().startsWith(search),
      );
    }
    cmds.forEach((c) => hints.push(`${c.command} - ${c.description}`));
    if (!cmds.length && display.text.startsWith("/"))
      hints.push("No matching commands");
    hints.push("", "? - Hide help", "ESC - Go back", "Ctrl+C - Quit");
    return hints;
  }, [availableCommands, display.text]);

  const renderInput = useMemo(() => {
    if (!display.text) return <Text dimColor>{placeholder}</Text>;

    const { text, cursor } = display;
    const textLen = text.length;

    // If text fits, render all
    if (textLen <= visibleWidth) {
      const before = text.slice(0, cursor);
      const cursorChar = text[cursor] ?? " ";
      const after = text.slice(cursor + 1);
      return (
        <Text>
          {before}
          <Text inverse>{cursorChar}</Text>
          {after}
        </Text>
      );
    }

    // Sliding window around cursor
    const halfWidth = Math.floor(visibleWidth / 2);
    let start = Math.max(0, cursor - halfWidth);
    const end = Math.min(textLen, start + visibleWidth);

    if (end === textLen && end - start < visibleWidth) {
      start = Math.max(0, end - visibleWidth);
    }

    const visibleText = text.slice(start, end);
    const visibleCursor = cursor - start;
    const before = visibleText.slice(0, visibleCursor);
    const cursorChar = visibleText[visibleCursor] ?? " ";
    const after = visibleText.slice(visibleCursor + 1);

    const leftEllipsis = start > 0 ? "…" : "";
    const rightEllipsis = end < textLen ? "…" : "";

    return (
      <Text>
        {leftEllipsis}
        {before}
        <Text inverse>{cursorChar}</Text>
        {after}
        {rightEllipsis}
      </Text>
    );
  }, [display, visibleWidth, placeholder]);

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        width={terminalWidth}
        flexShrink={1}
      >
        {renderInput}
      </Box>

      {enableMentions && mention.show && reviewers.length > 0 && (
        <MentionAutocomplete
          reviewers={reviewers}
          searchQuery={mention.query}
          onSelect={handleMentionSelect}
          onCancel={handleMentionCancel}
        />
      )}

      {!mention.show && (
        <Box marginTop={1}>
          <Text dimColor>
            {showFullHelp ? commandHints.join("\n") : defaultHints.join("\n")}
          </Text>
        </Box>
      )}
    </Box>
  );
});

export default ChatInput;
