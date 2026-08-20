import React from "react";
import { Text } from "ink";
import type { IndicatorProps, ItemProps } from "ink-select-input";
import { ITEM_SELECTION_GAP, ITEM_SELECTOR } from "../theme/symbols.js";
import { getTheme } from "../theme/theme.js";

const theme = getTheme();

/**
 * Themed renderers for `ink-select-input`, so every prompt in the CLI marks
 * its selection the same way and colorless mode is decided in one place.
 *
 * Pass them straight through:
 *   <SelectInput
 *     indicatorComponent={SelectIndicator}
 *     itemComponent={SelectItem}
 *   />
 *
 * A prompt whose items need more than a label (see `ReviewMenu`) keeps its own
 * `itemComponent` and still uses `SelectIndicator`.
 */
export const SelectIndicator: React.FC<IndicatorProps> = ({ isSelected }) => (
  <Text color={isSelected ? theme.success : undefined} dimColor={!isSelected}>
    {isSelected ? ITEM_SELECTOR : ITEM_SELECTION_GAP}
  </Text>
);

export const SelectItem: React.FC<ItemProps> = ({ isSelected, label }) => (
  <Text color={isSelected ? theme.main : theme.text}>{label}</Text>
);
