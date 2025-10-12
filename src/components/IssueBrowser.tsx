import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { Issue, IssueContext, IssueMode } from "../issues/types";
import { getIssueHandler } from "../issues/registry";

interface IssueBrowserProps {
  issues: Issue[];
  prId: string;
  onComplete: () => void;
}

const IssueBrowser: React.FC<IssueBrowserProps> = ({
  issues,
  prId,
  onComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentMode, setCurrentMode] = useState<IssueMode>("view");

  const currentIssue = issues[currentIndex];
  const hasNext = currentIndex < issues.length - 1;

  const handler = getIssueHandler(currentIssue.type);
  const DisplayComponent = handler.displayComponent;

  const context: IssueContext = {
    prId,
    currentIndex,
    totalIssues: issues.length,
    hasNext,
    mode: currentMode,
    moveToNext: () => {
      if (hasNext) {
        setCurrentIndex((prev) => prev + 1);
        setCurrentMode("view");
      } else {
        onComplete();
      }
    },
    complete: onComplete,
    setIssueMode: setCurrentMode,
  };

  useInput(async (input, _key) => {
    const result = await handler.handleInput(input, currentIssue, context);

    if (result.handled) {
      if (result.shouldMoveNext) {
        context.moveToNext();
      } else if (result.shouldComplete) {
        onComplete();
      }
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan">
          Issue {currentIndex + 1} of {issues.length} ({currentIssue.type})
        </Text>
      </Box>

      <DisplayComponent issue={currentIssue} context={context} />
    </Box>
  );
};

export default IssueBrowser;
