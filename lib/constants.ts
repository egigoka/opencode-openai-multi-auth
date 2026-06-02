/**
 * Constants used throughout the plugin
 * Centralized for easy maintenance and configuration
 */

/** Plugin identifier for logging and error messages */
export const PLUGIN_NAME = "openai-codex-plugin";

/** Plugin version - used for client_version query parameter */
export const PLUGIN_VERSION = "0.98.0";

/** Base URL for ChatGPT backend API */
export const CODEX_BASE_URL = "https://chatgpt.com/backend-api";

/** Dummy API key used for OpenAI SDK (actual auth via OAuth) */
export const DUMMY_API_KEY = "chatgpt-oauth";

/** Provider ID for opencode configuration */
export const PROVIDER_ID = "openai";

/** HTTP Status Codes */
export const HTTP_STATUS = {
	BAD_REQUEST: 400,
	OK: 200,
	UNAUTHORIZED: 401,
	NOT_FOUND: 404,
	TOO_MANY_REQUESTS: 429,
} as const;

/** OpenAI-specific headers */
export const OPENAI_HEADERS = {
	BETA: "OpenAI-Beta",
	ACCOUNT_ID: "chatgpt-account-id",
	ORIGINATOR: "originator",
	SESSION_ID: "session_id",
	CONVERSATION_ID: "conversation_id",
	VERSION: "version",
} as const;

/** OpenAI-specific header values */
export const OPENAI_HEADER_VALUES = {
	BETA_RESPONSES: "responses=experimental",
	ORIGINATOR_CODEX: "opencode",
} as const;

/** Codex CLI originator value */
export const CODEX_ORIGINATOR = "codex_cli_rs";

/** URL path segments */
export const URL_PATHS = {
	RESPONSES: "/responses",
	CODEX_RESPONSES: "/codex/responses",
	CODEX_MODELS: "/codex/models",
} as const;

/** Model fallback map - when a model isn't available, fall back to this */
export const MODEL_FALLBACKS: Record<string, string> = {
	"gpt-5.3-codex": "gpt-5.2-codex",
	"gpt-5.3-codex-max": "gpt-5.1-codex-max",
	"gpt-5.3-codex-mini": "gpt-5.1-codex-mini",
	"gpt-5.3": "gpt-5.2",
} as const;

/** JWT claim path for ChatGPT account ID */
export const JWT_CLAIM_PATH = "https://api.openai.com/auth" as const;

/** Error messages */
export const ERROR_MESSAGES = {
	NO_ACCOUNT_ID: "Failed to extract accountId from token",
	TOKEN_REFRESH_FAILED: "Failed to refresh token, authentication required",
	REQUEST_PARSE_ERROR: "Error parsing request",
	INVALID_BACKEND_URL: "Blocked request to untrusted backend URL",
} as const;

/** Log stages for request logging */
export const LOG_STAGES = {
	BEFORE_TRANSFORM: "before-transform",
	AFTER_TRANSFORM: "after-transform",
	RESPONSE: "response",
	ERROR_RESPONSE: "error-response",
} as const;

/** Platform-specific browser opener commands */
export const PLATFORM_OPENERS = {
	darwin: "open",
	win32: "start",
	linux: "xdg-open",
} as const;

/** OAuth authorization labels */
export const AUTH_LABELS = {
	OAUTH: "ChatGPT Plus/Pro (Codex Subscription)",
	OAUTH_MANUAL: "ChatGPT Plus/Pro (Manual URL Paste)",
	API_KEY: "Manually enter API Key",
	INSTRUCTIONS:
		"A browser window should open. If it doesn't, copy the URL and open it manually.",
	INSTRUCTIONS_MANUAL:
		"After logging in, copy the full redirect URL and paste it here.",
} as const;

/** Poll interval (ms) while waiting for the OAuth callback to arrive */
export const OAUTH_POLL_INTERVAL_MS = 100;

/** Default timeout (ms) for the OAuth login callback when none is configured */
export const OAUTH_LOGIN_TIMEOUT_DEFAULT_MS = 5 * 60 * 1000;

/**
 * Resolve the OAuth login callback timeout from a raw env value.
 *
 * Some users need more than the previous fixed 60s to complete a browser
 * login (2FA, account switching, password managers). Invalid or non-positive
 * values fall back to {@link OAUTH_LOGIN_TIMEOUT_DEFAULT_MS}.
 */
export function resolveOAuthLoginTimeoutMs(
	raw: string | undefined = process.env.OPENCODE_OPENAI_LOGIN_TIMEOUT_MS,
): number {
	const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
	return Number.isFinite(parsed) && parsed > 0
		? parsed
		: OAUTH_LOGIN_TIMEOUT_DEFAULT_MS;
}

/** Timeout (ms) for waiting on the OAuth callback, overridable via OPENCODE_OPENAI_LOGIN_TIMEOUT_MS */
export const OAUTH_LOGIN_TIMEOUT_MS = resolveOAuthLoginTimeoutMs();
