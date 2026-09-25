![Image 1: opencode-openai-multi-auth](assets/readme-hero.svg)

[![npm version](https://img.shields.io/npm/v/opencode-openai-multi-auth.svg)](https://www.npmjs.com/package/opencode-openai-multi-auth)
[![Tests](https://github.com/egigoka/opencode-openai-multi-auth/actions/workflows/ci.yml/badge.svg)](https://github.com/egigoka/opencode-openai-multi-auth/actions)
[![npm downloads](https://img.shields.io/npm/dm/opencode-openai-multi-auth.svg)](https://www.npmjs.com/package/opencode-openai-multi-auth)

# Multi-Account ChatGPT OAuth for OpenCode

> **Actively maintained fork**: [egigoka/opencode-openai-multi-auth](https://github.com/egigoka/opencode-openai-multi-auth) (v5.0.7+) — merges upstream PRs, adds default-account selection with session binding, `Retry-After` handling, and quiet 429 rotation (error responses only log with `DEBUG_CODEX_PLUGIN=1`).

**Use multiple ChatGPT Plus/Pro personal or organization accounts with OpenCode. Never hit rate limits again.**

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│   Account 1 (rate limited) ──┐                                 │
│   Account 2 (rate limited) ──┼──► Auto-rotate ──► Keep coding  │
│   Account 3 (available) ─────┘                                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Why Multi-Account?

| Problem | Solution |
|---------|----------|
| Hit ChatGPT rate limits while coding | Add multiple accounts, auto-rotate when limited |
| Team members share one subscription | Each person adds their own account |
| Different orgs have separate subscriptions | Use accounts from multiple organizations |
| One account gets throttled | Seamlessly switch to next available account |

---

## Quick Start

```bash
# Install
npx -y opencode-openai-multi-auth@latest

# Add your first account
opencode auth login
# Select "ChatGPT Plus/Pro (Codex Subscription)"

# Add more accounts (optional but recommended)
opencode auth login
# Select "Add Another OpenAI Account"

# Start coding - accounts rotate automatically on rate limits
opencode run "write hello world to test.txt" --model=openai/gpt-5.4 --variant=medium
```

---

## How Multi-Account Works

### Adding Accounts

```bash
# First account
opencode auth login
# → Select "ChatGPT Plus/Pro (Codex Subscription)"
# → Browser opens, login with ChatGPT
# → Account saved

# Second account (different email/org)
opencode auth login
# → Select "Add Another OpenAI Account"
# → Login with different ChatGPT account
# → Account added to rotation pool

# Repeat for as many accounts as you have
```

### Selecting a Default Account

Install the package globally so the `multiauth` command is available on `PATH`, then select one existing account by email:

```bash
npm install --global opencode-openai-multi-auth
multiauth -d user@example.com
# Equivalent: multiauth --default user@example.com
```

For a local checkout, build and install that checkout instead:

```bash
npm run build
npm install --global .
multiauth -d user@example.com
```

Matching trims whitespace and ignores email case. The email must match exactly one configured account. Restart OpenCode after changing the default. Selecting another account replaces the current default; there is no clear-default command.

### Automatic Rotation

When an OpenAI request reaches a rate limit:

1. Plugin detects 429 (rate limited) response
2. Marks current account as limited for that model (persists cooldown)
3. Retries the request on the next available account using the configured strategy
4. Rebinds that session to the new account so later prompts keep using it
5. Shows toast notification for account usage and rate limit status

If the default is cooling down, has failed repeatedly, or does not support the requested model, the normal selection strategy chooses an account. A configured default overrides a persisted binding once, at the first observable OpenAI request for that session in a plugin process. OpenCode exposes no `session.selected` hook, so this first request is the initialization boundary. Non-OpenAI providers are unaffected.

### Account Selection Strategies

| Strategy | Behavior | Best For |
|----------|----------|----------|
| `sticky` (default) | Stay with one account until rate limited | Single user, predictable usage |
| `round-robin` | Rotate through accounts on each request | Distribute load evenly |
| `hybrid` | Sticky within session, rotate across sessions | Multiple terminal sessions |

Set via environment variable:
```bash
OPENCODE_OPENAI_STRATEGY=round-robin opencode run "task"
```

### Team Usage

Each team member can add their own ChatGPT account:

```bash
# Developer 1 adds their account
opencode auth login  # logs in as dev1@company.com

# Developer 2 adds their account  
opencode auth login  # → "Add Another OpenAI Account" → dev2@company.com

# Developer 3 adds their account
opencode auth login  # → "Add Another OpenAI Account" → dev3@company.com
```

All accounts are pooled - when one person's account is rate limited, the plugin uses the next available.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCODE_OPENAI_QUIET=1` | Disable toast notifications | Off |
| `OPENCODE_OPENAI_DEBUG=1` | Enable debug logging | Off |
| `DEBUG_CODEX_PLUGIN=1` | Verbose plugin debug logging (includes HTTP error responses, which are silent otherwise) | Off |
| `ENABLE_PLUGIN_REQUEST_LOGGING=1` | Write sanitized request payloads to `~/.opencode/logs/codex-plugin/` (also enables debug logging) | Off |
| `OPENCODE_OPENAI_STRATEGY` | Account selection strategy | `sticky` |
| `OPENCODE_OPENAI_PID_OFFSET=1` | Offset account selection by PID | Off |
| `OPENCODE_OPENAI_LOGIN_TIMEOUT_MS` | OAuth login callback timeout (ms) | `300000` (5 min) |

---

## Account Management

### Set the Default Account
```bash
multiauth -d user@example.com
```

### View Accounts
```bash
cat ~/.config/opencode/openai-accounts.json | jq '.accounts[] | {email, planType}'
```

### Remove All Accounts
```bash
rm ~/.config/opencode/openai-accounts.json
```

### Check Rate Limit Status
```bash
cat ~/.config/opencode/openai-accounts.json | jq '.accounts[] | {email, rateLimitResets}'
```

### Slash Commands (TUI)
```text
/codex-status
```
Shows usage status for all configured accounts.

```text
/codex-account-list
```
Lists all configured accounts, marking the current session account and the default account.

```text
/codex-switch-account <index-or-email>
```
Switches the current session to a configured account (1-based index or email).

---

## Models

Model availability is dynamic: the plugin queries the ChatGPT backend (`/models`) per account (cached 5 minutes) and OpenCode registers what the backend advertises. Currently advertised models include:

- **gpt-5.3-codex-spark**
- **gpt-5.4** (+ `-fast`, `-mini`, `-mini-fast`)
- **gpt-5.5** (+ `-fast`)
- **gpt-5.6** family: `luna`, `sol`, `terra` (+ `-fast` each)
- **gpt-6** family: `astra`, `luna`, `sol` (+ `-fast` each)

Reasoning effort is selected with a suffix (`none`/`low`/`medium`/`high`/`xhigh`, e.g. `--model=openai/gpt-5.4 --variant=medium`); the plugin strips the suffix to the backend model slug and clamps `minimal` to `low`. Explicit presets for the GPT-5 through GPT-5.3 families (`codex` / `codex-max` / `codex-mini`) remain mapped for backwards compatibility, and any other `gpt-*` ID passes through as-is.

Note: The model selector reflects what the ChatGPT OAuth backend advertises. API-only models may not appear until the backend exposes them.

---

## Configuration

- **Modern** (OpenCode v1.0.210+): `config/opencode-modern.json`
- **Legacy** (v1.0.209 and below): `config/opencode-legacy.json`

```bash
# Modern install
npx -y opencode-openai-multi-auth@latest

# Legacy install
npx -y opencode-openai-multi-auth@latest --legacy

# Uninstall
npx -y opencode-openai-multi-auth@latest --uninstall
```

---

## Features

- **Multi-account rotation** - Add unlimited ChatGPT accounts, auto-rotate on rate limits
- **Manual default account** - Start OpenAI sessions with a selected account (`multiauth -d`)
- **Session binding** - Sessions stick to their account across prompts, rebind on failover
- **Per-model rate tracking** - Each model's limits tracked separately per account, cooldowns persisted
- **`Retry-After` handling** - Numeric and HTTP-date headers parsed, conservative cooldown on malformed values
- **Quiet 429 rotation** - Rate-limit rotation is silent unless `DEBUG_CODEX_PLUGIN=1`
- **Toast notifications** - Visual feedback when accounts switch
- **OAuth authentication** - Same secure flow as official Codex CLI
- **Dynamic models** - Backend-advertised models (GPT-5.3-codex-spark, 5.4–5.6, 6.x) plus mapped GPT-5–5.3 presets with reasoning variants
- **Automatic token refresh** - Never manually re-authenticate
- **Multimodal support** - Image input enabled for all models

---

## Documentation

- [Getting Started](docs/getting-started.md)
- [Configuration Guide](docs/configuration.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Architecture](docs/development/ARCHITECTURE.md)

---

## Credits

**Fork maintained by [egigoka](https://github.com/egigoka)**
**Upstream by [ZenysTX](https://x.com/zenysTX)**
**Original implementation by [Numman Ali](https://x.com/nummanali)**
**Inspired by [opencode-google-antigravity-auth](https://github.com/shekohex/opencode-google-antigravity-auth)**

[![Twitter Follow](https://img.shields.io/twitter/follow/zenysTX?style=social)](https://x.com/zenysTX)
[![Twitter Follow](https://img.shields.io/twitter/follow/nummanali?style=social)](https://x.com/nummanali)

---

## Usage Notice

This plugin is for **personal development use** with your own ChatGPT Plus/Pro subscriptions.
