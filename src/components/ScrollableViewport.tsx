import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, DOMElement, measureElement, Text, useInput } from "ink";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { useReservedRows } from "./layout/ScreenLayout.js";

interface ScrollableViewportProps {
  children: React.ReactNode;
  /** Follow the bottom of the content as it grows (e.g. streaming chat). */
  followContent?: boolean;
  /** Ignore scroll keys while another component owns them. */
  isActive?: boolean;
  /**
   * Scrolling starts from the top again whenever this changes - use the
   * identity of the thing being reviewed, so moving to the next comment does
   * not open partway down it.
   */
  resetKey?: string | number;
}

// One row for the scroll status line plus one so the terminal itself never
// scrolls the frame away.
const STATUS_ROWS = 1;
const SLACK_ROWS = 1;
// Below this the status line gives its row back to the content.
const MIN_ROWS_FOR_STATUS = 3;

/**
 * Clips its children to the rows the terminal has left and lets the user
 * scroll through them with the arrow keys.
 *
 * The available height is the terminal height minus the chrome registered
 * through `ReservedRows` (banner, headers, chat input), so the input box and
 * its hints stay visible however short the window is. Content is shifted with
 * a negative margin and clipped by `overflow: hidden`.
 */
const ScrollableViewport: React.FC<ScrollableViewportProps> = ({
  children,
  followContent = false,
  isActive = true,
  resetKey,
}) => {
  const contentRef = useRef<DOMElement | null>(null);
  const { rows } = useTerminalSize();
  const reservedRows = useReservedRows();

  const [contentHeight, setContentHeight] = useState(0);
  const [offset, setOffset] = useState(0);
  const [pinnedToBottom, setPinnedToBottom] = useState(followContent);

  // Never claim rows the terminal does not have: overflowing the window is the
  // very thing this component exists to prevent. If chrome alone fills the
  // window the viewport collapses to nothing rather than pushing it off screen.
  const budgetRows = Math.max(0, rows - reservedRows - SLACK_ROWS);
  // With almost nothing to spare, content is worth more than the status line -
  // and a one-row viewport is measured wrongly by Ink, which breaks scrolling.
  const showStatus = budgetRows >= MIN_ROWS_FOR_STATUS;
  const viewportHeight = showStatus ? budgetRows - STATUS_ROWS : budgetRows;
  const maxOffset = Math.max(0, contentHeight - viewportHeight);

  // Re-measure after every render: content grows while a reply streams in.
  useEffect(() => {
    if (!contentRef.current) return;
    const measured = measureElement(contentRef.current).height;
    setContentHeight((previous) =>
      previous === measured ? previous : measured,
    );
  });

  // A different comment or requirement starts from the top, however far the
  // user had scrolled through the previous one.
  useEffect(() => {
    setOffset(0);
    setPinnedToBottom(false);
  }, [resetKey]);

  // Following was just switched on (the first chat reply arrives): jump down.
  const wasFollowing = useRef(followContent);
  useEffect(() => {
    if (followContent && !wasFollowing.current) setPinnedToBottom(true);
    wasFollowing.current = followContent;
  }, [followContent]);

  // Keep the offset meaningful when the content or the window changes size.
  useEffect(() => {
    setOffset((previous) => {
      if (followContent && pinnedToBottom) return maxOffset;
      return Math.min(previous, maxOffset);
    });
  }, [followContent, pinnedToBottom, maxOffset]);

  const scrollBy = useCallback(
    (delta: number) => {
      setOffset((previous) => {
        const next = Math.max(0, Math.min(maxOffset, previous + delta));
        setPinnedToBottom(next >= maxOffset);
        return next;
      });
    },
    [maxOffset],
  );

  useInput(
    (input, key) => {
      const page = Math.max(1, viewportHeight - 1);

      if (key.upArrow) scrollBy(-1);
      else if (key.downArrow) scrollBy(1);
      else if (key.pageUp) scrollBy(-page);
      else if (key.pageDown) scrollBy(page);
      else if (key.ctrl && input === "u") scrollBy(-Math.ceil(page / 2));
      else if (key.ctrl && input === "d") scrollBy(Math.ceil(page / 2));
    },
    { isActive: isActive && maxOffset > 0 },
  );

  const canScroll = maxOffset > 0;
  const firstVisibleLine = contentHeight === 0 ? 0 : offset + 1;
  const lastVisibleLine = Math.min(contentHeight, offset + viewportHeight);

  return (
    <>
      <Box
        flexDirection="column"
        flexShrink={0}
        height={viewportHeight}
        overflow="hidden"
      >
        <Box
          ref={contentRef}
          flexDirection="column"
          flexShrink={0}
          marginTop={-offset}
        >
          {children}
        </Box>
      </Box>

      {/* A fixed row whenever it is shown, so the hint appearing cannot
          change the layout. */}
      {showStatus && (
        <Box flexShrink={0}>
          <Text dimColor>
            {canScroll
              ? `${offset > 0 ? "↑" : " "}${offset < maxOffset ? "↓" : " "} lines ${firstVisibleLine}-${lastVisibleLine} of ${contentHeight} · ↑/↓ PgUp/PgDn to scroll`
              : " "}
          </Text>
        </Box>
      )}
    </>
  );
};

export default ScrollableViewport;
