/**
 * The inline chat box in the review menu is rendered through `SelectInput`'s
 * `itemComponent`. React treats that as a new component type whenever its
 * identity changes, remounting the input and resetting its cursor to the end
 * of the text. These tests drive the menu the way a user does: paste, move
 * left, keep typing.
 */
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { renderInk, type InkTestRender } from "../../lib/testing/renderInk.js";
import ReviewMenu from "./ReviewMenu.js";

const ESC = "\u001B";
const DOWN = `${ESC}[B`;
const LEFT = `${ESC}[D`;
const HOME = `${ESC}[H`;

let menu: InkTestRender | null = null;

afterEach(() => {
  menu?.unmount();
  menu = null;
});

/** Renders the menu with the chat item highlighted, which opens its input. */
const openChat = async (): Promise<InkTestRender> => {
  menu = renderInk(
    <ReviewMenu
      unmetRequirementsCount={0}
      metRequirementsCount={0}
      unresolvedCommentsCount={0}
      completedSteps={{
        unmetRequirements: false,
        metRequirements: false,
        comments: false,
        prWalkthrough: false,
      }}
      onSelect={() => {}}
      onBack={() => {}}
    />,
  );
  menu.write(DOWN);
  await menu.flush();
  return menu;
};

/** Types each chunk on its own, as a terminal delivers separate keypresses. */
const type = async (chat: InkTestRender, chunks: string[]): Promise<void> => {
  for (const chunk of chunks) {
    chat.write(chunk);
    await chat.flush();
  }
};

describe("ReviewMenu inline chat", () => {
  it("keeps typing where the cursor is after a paste", async () => {
    const chat = await openChat();

    await type(chat, ["hello world", LEFT, LEFT, "X", "Y"]);

    expect(chat.lastFrame()).toContain("hello worXYld");
  });

  it("keeps the cursor put across several edits", async () => {
    const chat = await openChat();

    await type(chat, ["abcdef", HOME, "1", "2", "3"]);

    expect(chat.lastFrame()).toContain("123abcdef");
  });
});
