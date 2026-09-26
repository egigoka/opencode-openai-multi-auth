import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findLegacyCodexAuthFork } from "../lib/conflict.js";

const originalHome = process.env.HOME;

afterEach(() => {
	if (originalHome === undefined) {
		delete process.env.HOME;
	} else {
		process.env.HOME = originalHome;
	}
});

describe("findLegacyCodexAuthFork", () => {
	it("returns null when no legacy shim is enabled", () => {
		process.env.HOME = mkdtempSync(join(tmpdir(), "no-legacy-"));
		expect(findLegacyCodexAuthFork()).toBeNull();
	});

	it("ignores a dormant legacy checkout without an enabled shim", () => {
		const home = mkdtempSync(join(tmpdir(), "dormant-"));
		const dir = join(home, ".local", "share", "opencode-codex-auth", "dist");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "index.js"), "");
		process.env.HOME = home;
		expect(findLegacyCodexAuthFork()).toBeNull();
	});

	it("returns the enabled legacy shim path", () => {
		const home = mkdtempSync(join(tmpdir(), "legacy-"));
		const dir = join(home, ".config", "opencode", "plugins");
		mkdirSync(dir, { recursive: true });
		const shim = join(dir, "codex-auth-fork.js");
		writeFileSync(shim, "");
		process.env.HOME = home;
		expect(findLegacyCodexAuthFork()).toBe(shim);
	});
});
