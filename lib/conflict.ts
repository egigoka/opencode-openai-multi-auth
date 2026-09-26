import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Config locations where the legacy opencode-codex-auth shim can be enabled.
 * Both entries matter because setup links the same config dir into kilo.
 */
const LEGACY_SHIM_PATHS = [
	[".config", "opencode", "plugins", "codex-auth-fork.js"],
	[".config", "kilo", "plugins", "codex-auth-fork.js"],
] as const;

/**
 * Detect an enabled legacy opencode-codex-auth plugin. It also registers the
 * `openai` provider, so when both plugins are enabled the legacy fork can
 * serve requests instead of this plugin: it only rewrites `/v1/responses`
 * style paths, so `/backend-api/responses` passes through unchanged and the
 * backend answers `404 {"detail":"Not Found"}`.
 *
 * The check targets the enabled shim (not the `~/.local/share` checkout) so
 * a dormant install does not trigger false warnings.
 *
 * @returns Absolute path of the enabled legacy shim, or null when absent.
 */
export function findLegacyCodexAuthFork(): string | null {
	const home = homedir();
	for (const segments of LEGACY_SHIM_PATHS) {
		const entrypoint = join(home, ...segments);
		try {
			if (existsSync(entrypoint)) return entrypoint;
		} catch {
			// Ignore unreadable paths and keep checking the rest.
		}
	}
	return null;
}
