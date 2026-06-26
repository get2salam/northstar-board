// accessibility.test.mjs — static checks for keyboard-friendly board affordances.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function source(path) {
  return readFile(resolve(root, path), "utf8");
}

test("stars expose keyboard activation semantics", async () => {
  const board = await source("js/board.js");

  assert.match(board, /tabindex:\s*"0"/, "stars must remain tabbable");
  assert.match(board, /role:\s*"button"/, "stars must announce as buttons");
  assert.match(board, /addEventListener\("keydown"/, "stars need keyboard activation");
  assert.match(board, /e\.key !== "Enter" && e\.key !== " "/, "Enter and Space should activate stars");
  assert.match(board, /Press Enter to edit this star/, "screen-reader label should explain the action");
});

test("focused stars have a visible focus treatment", async () => {
  const css = await source("css/styles.css");

  assert.match(css, /\.board \.star:focus-visible \.core/, "focused star core needs a visible ring");
  assert.match(css, /\.board \.star:focus-visible \.label/, "focused star label should become prominent");
});

test("editor controls expose explicit assistive labels", async () => {
  const editor = await source("js/editor.js");

  assert.match(editor, /role:\s*"complementary"/, "editor panel should expose a landmark role");
  assert.match(editor, /"aria-label":\s*"Star editor"/, "editor panel should have a stable label");
  assert.match(editor, /role:\s*"group"/, "status pills should be grouped for screen readers");
  assert.match(editor, /"aria-pressed":\s*s === node\.status \? "true" : "false"/, "status pills must announce the selected state");
  assert.match(editor, /"aria-valuetext":\s*`\$\{node\.magnitude \?\? 2\} of 4 brightness`/, "magnitude slider should explain its scale");
  assert.match(editor, /"aria-label":\s*"Star to connect"/, "link target select should be labelled");
  assert.match(editor, /Remove incoming link from/, "incoming link removal should name the affected star");
});
