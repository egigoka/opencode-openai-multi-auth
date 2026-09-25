import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

function writeAccounts(home: string, emails: string[]) {
  const directory = join(home, ".config", "opencode");
  mkdirSync(directory, { recursive: true });
  const filePath = join(directory, "openai-accounts.json");
  writeFileSync(
    filePath,
    JSON.stringify({
      version: 1,
      accounts: emails.map((email, index) => ({
        index,
        email,
        addedAt: 0,
        parts: { refreshToken: `refresh-${index}` },
        rateLimitResets: {},
        consecutiveFailures: 0,
      })),
      activeAccountIndex: 0,
    }),
  );
  return filePath;
}

async function invoke(home: string, args: string[]) {
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  vi.resetModules();
  const { runCli } = await import("../lib/cli.js");
  let stdout = "";
  let stderr = "";
  const exitCode = await runCli(args, {
    stdout: { write: (text) => ((stdout += String(text)), true) } as any,
    stderr: { write: (text) => ((stderr += String(text)), true) } as any,
  });
  return { exitCode, stdout, stderr };
}

describe("multiauth CLI", () => {
  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
  });

  it.each([[[]], [["-h"]], [["--help"]]])("prints help and succeeds for %j", async (args) => {
    const home = mkdtempSync(join(tmpdir(), "multiauth-help-"));
    const result = await invoke(home, args);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: multiauth");
    expect(result.stderr).toBe("");
  });

  it.each([
    [["-d"]],
    [["-d", "a@example.com", "extra"]],
    [["-d", "a@example.com", "--default", "b@example.com"]],
    [["--unknown"]],
    [["email@example.com"]],
  ])("rejects invalid arguments without writing for %j", async (args) => {
    const home = mkdtempSync(join(tmpdir(), "multiauth-validation-"));
    const filePath = writeAccounts(home, ["a@example.com"]);
    const before = readFileSync(filePath, "utf8");

    const result = await invoke(home, args);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
    expect(readFileSync(filePath, "utf8")).toBe(before);
  });

  it("persists a default and displays the canonical stored email", async () => {
    const home = mkdtempSync(join(tmpdir(), "multiauth-success-"));
    const filePath = writeAccounts(home, ["first@example.com", "Canonical@Example.com"]);

    const result = await invoke(home, ["--default", "  canonical@example.COM  "]);
    const storage = JSON.parse(readFileSync(filePath, "utf8"));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Canonical@Example.com");
    expect(result.stdout).toContain("Restart OpenCode");
    expect(storage.defaultAccountIndex).toBe(1);
  });

  it.each([
    ["unknown@example.com", ["known@example.com"], "No account found"],
    [
      "duplicate@example.com",
      ["Duplicate@example.com", " duplicate@EXAMPLE.com "],
      "Multiple accounts found",
    ],
  ])("rejects %s without mutating accounts", async (email, emails, message) => {
    const home = mkdtempSync(join(tmpdir(), "multiauth-lookup-"));
    const filePath = writeAccounts(home, emails);
    const before = readFileSync(filePath, "utf8");

    const result = await invoke(home, ["-d", email]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(message);
    expect(readFileSync(filePath, "utf8")).toBe(before);
  });

  it("retains the installer binary and publishes multiauth", () => {
    const packageJson = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
    );

    expect(packageJson.bin).toEqual({
      "opencode-openai-multi-auth": "./scripts/install-opencode-codex-auth.js",
      multiauth: "./dist/lib/cli.js",
    });
  });

  it("recognizes direct execution through a linked package path", async () => {
    const root = mkdtempSync(join(tmpdir(), "multiauth-linked-entry-"));
    const packageDirectory = join(root, "package");
    const linkedDirectory = join(root, "linked-package");
    mkdirSync(packageDirectory);
    const realEntry = join(packageDirectory, "cli.js");
    writeFileSync(realEntry, "");
    symlinkSync(packageDirectory, linkedDirectory, "junction");
    const { isDirectExecution } = await import("../lib/cli.js");

    expect(
      isDirectExecution(
        join(linkedDirectory, "cli.js"),
        pathToFileURL(realEntry).href,
      ),
    ).toBe(true);
  });
});
