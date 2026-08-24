/**
 * The inline chat box in the review menu is rendered through `SelectInput`'s
 * `itemComponent`. React treats that as a new component type whenever its
 * identity changes, remounting the input and resetting its cursor to the end
 * of the text. These tests drive the menu the way a user does: paste, move
 * left, keep typing, then send.
 */
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { renderInk, type InkTestRender } from "../../lib/testing/renderInk.js";
import ReviewMenu, { type ReviewMenuAction } from "./ReviewMenu.js";

const ESC = "\u001B";
const DOWN = `${ESC}[B`;
const LEFT = `${ESC}[D`;
const HOME = `${ESC}[H`;
const ENTER = "\r";

interface OpenChat {
  chat: InkTestRender;
  /** What the menu handed on, so the buffer is checked and not just the frame. */
  submissions: Array<{ action: ReviewMenuAction; input?: string }>;
}

let menu: InkTestRender | null = null;

afterEach(() => {
  menu?.unmount();
  menu = null;
});

/** Renders the menu with the chat item highlighted, which opens its input. */
const openChat = async (): Promise<OpenChat> => {
  const submissions: OpenChat["submissions"] = [];
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
      onSelect={(action, input) => submissions.push({ action, input })}
      onBack={() => {}}
    />,
  );
  menu.write(DOWN);
  await menu.flush();
  return { chat: menu, submissions };
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
    const { chat, submissions } = await openChat();

    await type(chat, ["hello world", LEFT, LEFT, "X", "Y"]);

    expect(chat.lastFrame()).toContain("hello worXYld");

    await type(chat, [ENTER]);

    expect(submissions).toEqual([{ action: "prChat", input: "hello worXYld" }]);
  });

  it("keeps the cursor put across several edits", async () => {
    const { chat, submissions } = await openChat();

    await type(chat, ["abcdef", HOME, "1", "2", "3"]);

    expect(chat.lastFrame()).toContain("123abcdef");

    await type(chat, [ENTER]);

    expect(submissions).toEqual([{ action: "prChat", input: "123abcdef" }]);
  });

  it("trims the text it sends", async () => {
    const { chat, submissions } = await openChat();

    await type(chat, ["  padded  ", ENTER]);

    expect(submissions).toEqual([{ action: "prChat", input: "padded" }]);
  });
});
