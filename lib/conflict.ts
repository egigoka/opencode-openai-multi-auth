import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Install location of the legacy opencode-codex-auth fork (v1.x). */
const LEGACY_FORK_SEGMENTS = [
	".local",
	"share",
	"opencode-codex-auth",
	"dist",
	"index.js",
] as const;

/**
 * Detect a legacy opencode-codex-auth install that also registers the
 * `openai` provider. When both plugins are enabled, the legacy fork can
 * serve requests instead of this plugin: it only rewrites `/v1/responses`
 * style paths, so `/backend-api/responses` passes through unchanged and the
 * backend answers `404 {"detail":"Not Found"}`.
 *
 * @returns Absolute path of the legacy dist entrypoint, or null when absent.
 */
export function findLegacyCodexAuthFork(): string | null {
	const entrypoint = join(homedir(), ...LEGACY_FORK_SEGMENTS);
	try {
		return existsSync(entrypoint) ? entrypoint : null;
	} catch {
		return null;
	}
}
