import { getTheme } from "./theme.js";

/**
 * Theme-derived color constants.
 *
 * These resolve from the active theme (see `theme.ts`), so they follow the
 * terminal background and any user customization. `undefined` means "use the
 * terminal's own color", which is what colorless mode produces.
 */
const theme = getTheme();

export const MAIN_COLOR = theme.main;
export const TABLE_HEADER_COLOR = theme.fileHeaderBg;

export const DIFF_ADDED_LINE_COLOR = theme.diffAddedBg;
export const DIFF_DELETED_LINE_COLOR = theme.diffDeletedBg;
export const DIFF_SELECTED_LINE_COLOR = theme.diffSelectedBg;
