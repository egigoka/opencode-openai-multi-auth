# Architecture

## System Overview

This OpenCode plugin authenticates against the ChatGPT Codex backend, selects among configured OpenAI accounts, and retries rate-limited requests with eligible fallback accounts.

```mermaid
flowchart TD
    OpenCode[OpenCode] --> Plugin[index.ts: OpenAIAuthPlugin]
    CLI[multiauth: lib/cli.ts] --> Accounts[AccountManager]
    Plugin --> Accounts
    Plugin --> Sessions[SessionBindingStore]
    Accounts --> AccountStorage[openai-accounts.json]
    Sessions --> BindingStorage[openai-multi-auth-session-bindings.json]
    Plugin --> Codex[ChatGPT Codex backend]
```

## Module Dependencies

```mermaid
flowchart LR
    CLI[lib/cli.ts] --> Manager[lib/accounts/manager.ts]
    Entry[index.ts] --> AccountIndex[lib/accounts/index.ts]
    AccountIndex --> Manager
    Entry --> Session[lib/session-bindings.ts]
    Manager --> Auth[lib/auth/auth.ts]
    Manager --> AccountTypes[lib/accounts/types.ts]
    Manager --> Secure[lib/secure-file.ts]
    Session --> Secure
    Entry --> Fetch[lib/request/fetch-helpers.ts]
    Entry --> Models[lib/models.ts]
    Entry --> Status[lib/codex-status.ts]
```

References flow from entry points to orchestration, then storage and utility layers. The default-account feature introduces no circular dependency.

## Entry Points

| Entry point | Location | Contract |
|---|---|---|
| OpenCode plugin | `index.ts:70` | Initializes account and session state and returns OpenCode hooks |
| OpenAI loader | `index.ts:330` | Returns the backend URL and custom fetch implementation |
| Request executor | `index.ts:351` | Refreshes tokens, sends requests, and handles account retries |
| Request selection | `index.ts:628` | Extracts model/session data and selects the working account |
| CLI API | `lib/cli.ts:17` | `runCli(args, io)` returns exit status `0` or `1` |
| CLI executable | `lib/cli.ts:64` | Runs `runCli()` when invoked directly |
| Package command | `package.json:39` | Maps `multiauth` to `dist/lib/cli.js` |

## Modified Data Flow

```mermaid
sequenceDiagram
    participant OC as OpenCode
    participant P as index.ts
    participant A as AccountManager
    participant S as SessionBindingStore
    participant API as Codex backend

    OC->>P: OpenAI request with model and prompt_cache_key
    P->>A: getDefaultAccount(model)
    alt Eligible default on first process use
        A-->>P: Default account
        P->>S: Bind session to default index
    else Default unavailable
        P->>A: getNextAvailableAccountForNewSession(model)
        A-->>P: Strategy-selected account
        P->>S: Bind session to selected index
    end
    P->>API: Send request with account credentials
    alt 429 response
        P->>A: markRateLimited and saveToDisk
        P->>A: getNextAvailableAccountExcluding
        A-->>P: Fallback account
        P->>S: Rebind before retry
        P->>API: Retry with fallback
    end
```

The first observable OpenAI request is the session initialization boundary because OpenCode exposes no `session.selected` hook. The process-local initialized-session set prevents a session from returning to its default after it has been rebound to a fallback.

## Interfaces and Contracts

| Interface | Location | Contract |
|---|---|---|
| `AccountsStorage.defaultAccountIndex` | `lib/accounts/types.ts:27` | Optional numeric index in the existing version-1 file |
| `AccountManager.getDefaultAccount()` | `lib/accounts/manager.ts:209` | Returns an eligible default or `null` |
| `AccountManager.getDefaultAccountIndex()` | `lib/accounts/manager.ts:217` | Distinguishes configured-but-unavailable from unconfigured |
| `AccountManager.setDefaultAccount()` | `lib/accounts/manager.ts:221` | Resolves exactly one trimmed, case-insensitive email and persists it |
| `SessionBindingStore.set()` | `lib/session-bindings.ts:47` | Persists a session key to account index binding |
| `runCli()` | `lib/cli.ts:17` | Writes user-safe output and returns a process exit code |

Existing version-1 account files without `defaultAccountIndex` remain valid. Invalid stored indexes are treated as no default. Removing the default clears it; removing an earlier account decrements it.

## Technical Debt

- The default and session bindings use positional account indexes rather than stable IDs. Manager-mediated removal maintains the default, while stale session bindings are repaired when encountered.
- The CLI cannot explicitly clear a default. Selecting another account replaces it, and removing the selected account clears it.
- `removeAccount()` starts persistence without awaiting completion, so callers cannot observe a write failure. This behavior predates the feature.
- Atomic rename protects individual JSON writes but does not prevent last-writer-wins races between a running plugin and the CLI.

No new TODO markers were introduced.
