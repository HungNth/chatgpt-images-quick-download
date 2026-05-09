const assert = require("node:assert/strict");
const test = require("node:test");

const { findChromeExecutable } = require("../scripts/visual-smoke.js");

test("findChromeExecutable prefers explicit CHROME_BIN", () => {
  const chrome = findChromeExecutable({
    env: { CHROME_BIN: "/custom/chrome" },
    existsSync(candidate) {
      return candidate === "/custom/chrome";
    }
  });

  assert.equal(chrome, "/custom/chrome");
});

test("findChromeExecutable can resolve common Linux Chrome paths", () => {
  const chrome = findChromeExecutable({
    env: {},
    platform: "linux",
    existsSync(candidate) {
      return candidate === "/usr/bin/google-chrome";
    }
  });

  assert.equal(chrome, "/usr/bin/google-chrome");
});
