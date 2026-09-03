import { beforeEach, describe, expect, it, vi } from "vitest";

const transformRequestForCodexMock = vi.fn();
const saveToDiskMock = vi.fn();
const initialBindings = new Map<string, number>();
let latestBindings = new Map<string, number>();
let defaultAccountIndex: number | undefined;
let lastRetryAfterMs: number | undefined;

const accounts = [
  {
    index: 0,
    email: "first@example.com",
    access: "access-0",
    expires: Date.now() + 60_000,
    accountId: "acct_0",
    parts: { refreshToken: "refresh-0" },
    rateLimitResets: {},
    consecutiveFailures: 0,
    addedAt: 0,
  },
  {
    index: 1,
    email: "Default@Example.com",
    access: "access-1",
    expires: Date.now() + 60_000,
    accountId: "acct_1",
    parts: { refreshToken: "refresh-1" },
    rateLimitResets: {},
    consecutiveFailures: 0,
    addedAt: 0,
  },
];

vi.mock("@opencode-ai/plugin", () => ({
  tool: (definition: unknown) => definition,
}));

vi.mock("../lib/request/fetch-helpers.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/request/fetch-helpers.js")>(
    "../lib/request/fetch-helpers.js",
  );
  return { ...actual, transformRequestForCodex: transformRequestForCodexMock };
});

vi.mock("../lib/models.js", () => ({ prefetchModels: vi.fn() }));

vi.mock("../lib/accounts/index.js", () => {
  class AccountManager {
    async loadFromDisk() {}
    async importFromOpenCodeAuth() {}
    async saveToDisk() {
      saveToDiskMock();
    }
    getAllAccounts() {
      return accounts;
    }
    getAccountCount() {
      return accounts.length;
    }
    getActiveAccount() {
      return accounts[0];
    }
    getDefaultAccount() {
      return defaultAccountIndex === undefined ? null : accounts[defaultAccountIndex];
    }
    getDefaultAccountIndex() {
      return defaultAccountIndex;
    }
    async getNextAvailableAccount() {
      return accounts[0];
    }
    async getNextAvailableAccountForNewSession() {
      return accounts[0];
    }
    async getNextAvailableAccountExcluding(excluded: Set<number>) {
      return accounts.find((account) => !excluded.has(account.index)) ?? null;
    }
    async ensureValidToken() {
      return true;
    }
    markRateLimited(_account: unknown, retryAfterMs: number) {
      lastRetryAfterMs = retryAfterMs;
    }
    markRefreshFailed() {}
    async addAccount() {}
  }

  return { AccountManager };
});

vi.mock("../lib/session-bindings.js", () => {
  class SessionBindingStore {
    private map = new Map<string, number>();
    loadFromDisk() {
      this.map = new Map(initialBindings);
      latestBindings = this.map;
    }
    get(key: string) {
      return this.map.get(key);
    }
    set(key: string, value: number) {
      this.map.set(key, value);
    }
    delete(key: string) {
      this.map.delete(key);
    }
  }

  return { SessionBindingStore };
});

async function createFetch() {
  const { OpenAIAuthPlugin } = await import("../index.js");
  const plugin = await OpenAIAuthPlugin({
    client: {
      auth: { set: vi.fn() },
      tui: { showToast: vi.fn() },
    },
  } as any);

  const loader = await plugin.auth.loader(
    async () => ({
      type: "oauth",
      access: "access-token",
      refresh: "refresh-token",
      expires: Date.now() + 60_000,
    }) as any,
    {} as any,
  );
  return loader.fetch;
}

function request(
  fetcher: NonNullable<Awaited<ReturnType<typeof createFetch>>>,
  sessionKey: string | undefined = "ses_test_key",
) {
  return fetcher("https://chatgpt.com/backend-api/responses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.2-codex",
      ...(sessionKey ? { prompt_cache_key: sessionKey } : {}),
      input: [{ type: "message", role: "user", content: "hello" }],
    }),
  });
}

describe("Runtime fetch parity", () => {
  beforeEach(() => {
    transformRequestForCodexMock.mockReset();
    saveToDiskMock.mockReset();
    initialBindings.clear();
    latestBindings = new Map();
    defaultAccountIndex = undefined;
    lastRetryAfterMs = undefined;
    (globalThis as any).fetch = vi.fn(async () =>
      new Response('data: {"type":"response.done"}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );
  });

  it("does not call transformRequestForCodex in runtime fetch path", async () => {
    const fetcher = await createFetch();
    await request(fetcher);

    expect(transformRequestForCodexMock).not.toHaveBeenCalled();
    expect((globalThis as any).fetch).toHaveBeenCalled();
  });

  it("overrides a persisted binding with the default on first use", async () => {
    initialBindings.set("ses_test_key", 0);
    defaultAccountIndex = 1;
    const fetcher = await createFetch();

    await request(fetcher);

    const init = (globalThis.fetch as any).mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("chatgpt-account-id")).toBe("acct_1");
    expect(latestBindings.get("ses_test_key")).toBe(1);
  });

  it("uses the default when a request has no session key", async () => {
    defaultAccountIndex = 1;
    const fetcher = await createFetch();

    await request(fetcher, undefined);

    const init = (globalThis.fetch as any).mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("chatgpt-account-id")).toBe("acct_1");
  });

  it("rebinds to the 429 fallback and keeps it for the next request", async () => {
    defaultAccountIndex = 0;
    (globalThis as any).fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        new Response('data: {"type":"response.done"}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      )
      .mockResolvedValueOnce(
        new Response('data: {"type":"response.done"}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
    const fetcher = await createFetch();

    await request(fetcher);
    await request(fetcher);

    const accountIds = (globalThis.fetch as any).mock.calls.map(
      ([, init]: [unknown, RequestInit]) =>
        new Headers(init.headers).get("chatgpt-account-id"),
    );
    expect(accountIds).toEqual(["acct_0", "acct_1", "acct_1"]);
    expect(latestBindings.get("ses_test_key")).toBe(1);
    expect(saveToDiskMock).toHaveBeenCalledOnce();
  });

  it("parses an HTTP-date Retry-After value before persisting cooldown", async () => {
    defaultAccountIndex = 0;
    const resetAt = new Date(Date.now() + 60_000).toUTCString();
    (globalThis as any).fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": resetAt },
        }),
      )
      .mockResolvedValueOnce(
        new Response('data: {"type":"response.done"}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
    const fetcher = await createFetch();

    await request(fetcher);

    expect(lastRetryAfterMs).toBeGreaterThan(58_000);
    expect(lastRetryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("uses a conservative cooldown for a malformed Retry-After value", async () => {
    defaultAccountIndex = 0;
    (globalThis as any).fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "not-a-date" },
        }),
      )
      .mockResolvedValueOnce(
        new Response('data: {"type":"response.done"}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      );
    const fetcher = await createFetch();

    await request(fetcher);

    expect(lastRetryAfterMs).toBe(60_000);
  });

  it("retains an existing session binding when no default is configured", async () => {
    initialBindings.set("ses_test_key", 1);
    const fetcher = await createFetch();

    await request(fetcher);

    const init = (globalThis.fetch as any).mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("chatgpt-account-id")).toBe("acct_1");
    expect(latestBindings.get("ses_test_key")).toBe(1);
  });
});
