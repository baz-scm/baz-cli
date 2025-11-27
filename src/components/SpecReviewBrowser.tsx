import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Requirement } from "../lib/clients/baz.js";
import { MAIN_COLOR } from "../theme/colors.js";
import { renderMarkdown } from "../lib/markdown.js";

interface SpecReviewBrowserProps {
  unmetRequirements: Requirement[];
  onComplete: () => void;
  onBack: () => void;
}

type ViewState = "requirement" | "evidence";

const SpecReviewBrowser: React.FC<SpecReviewBrowserProps> = ({
  unmetRequirements,
  onComplete,
  onBack,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewState, setViewState] = useState<ViewState>("requirement");

  const currentRequirement = unmetRequirements[currentIndex];
  const hasNext = currentIndex < unmetRequirements.length - 1;

  useInput((input, key) => {
    if (key.escape) {
      onBack();
    } else if (input === "/") {
      return;
    }
  });

  const handleNext = () => {
    if (hasNext) {
      setCurrentIndex((prev) => prev + 1);
      setViewState("requirement");
    } else {
      onComplete();
    }
  };

  const handleExplain = () => {
    setViewState("evidence");
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={MAIN_COLOR} bold>
          Unmet requirement ({currentIndex + 1}/{unmetRequirements.length})
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Description:</Text>
        <Text>{currentRequirement.title}</Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>Verdict:</Text>
        <Text color="red">{currentRequirement.verdict}</Text>
        {currentRequirement.verdict_explanation && (
          <Text>{renderMarkdown(currentRequirement.verdict_explanation)}</Text>
        )}
      </Box>

      {viewState === "requirement" ? (
        <CommandPrompt onNext={handleNext} onExplain={handleExplain} />
      ) : (
        <>
          <Box marginBottom={1} flexDirection="column">
            <Text bold>Evidence:</Text>
            <Text>{currentRequirement.evidence}</Text>
          </Box>

          <Box marginBottom={1}>
            <Text dimColor italic>
              /next to continue
            </Text>
          </Box>

          <CommandInput onNext={handleNext} />
        </>
      )}
    </Box>
  );
};

const CommandPrompt: React.FC<{
  onNext: () => void;
  onExplain: () => void;
}> = ({ onNext, onExplain }) => {
  const [input, setInput] = useState("");

  useInput((char, key) => {
    if (key.return) {
      if (input.trim() === "/next") {
        onNext();
        setInput("");
      } else if (input.trim() === "/explain") {
        onExplain();
        setInput("");
      }
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (char) {
      setInput((prev) => prev + char);
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color={MAIN_COLOR}>&gt; </Text>
        <Text>{input}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor italic>
          Available commands: /next • /explain
        </Text>
      </Box>
    </Box>
  );
};

const CommandInput: React.FC<{
  onNext: () => void;
}> = ({ onNext }) => {
  const [input, setInput] = useState("");

  useInput((char, key) => {
    if (key.return) {
      if (input.trim() === "/next") {
        onNext();
        setInput("");
      }
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (char) {
      setInput((prev) => prev + char);
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color={MAIN_COLOR}>&gt; </Text>
        <Text>{input}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor italic>
          /next to continue
        </Text>
      </Box>
    </Box>
  );
};

export default SpecReviewBrowser;
