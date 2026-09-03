import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
 
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

async function createManager(
  home: string,
  strategy: "sticky" | "round-robin" | "hybrid",
) {
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  vi.resetModules();
  const { AccountManager } = await import("../lib/accounts/manager.js");
  return new AccountManager({
    accountSelectionStrategy: strategy,
    quietMode: true,
    debug: false,
  });
}

describe("AccountManager strategy selection", () => {
  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
  });

  it("keeps using the same account in sticky mode", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-sticky-"));
    const manager = await createManager(home, "sticky");
    await manager.loadFromDisk();

    await manager.addAccount("a@example.com", "rt-1");
    await manager.addAccount("b@example.com", "rt-2");

    const pick1 = await manager.getNextAvailableAccount();
    const pick2 = await manager.getNextAvailableAccount();
    const pick3 = await manager.getNextAvailableAccount();

    expect(pick1?.index).toBe(0);
    expect(pick2?.index).toBe(0);
    expect(pick3?.index).toBe(0);
  });

  it("rotates accounts on each request in round-robin mode", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-rr-"));
    const manager = await createManager(home, "round-robin");
    await manager.loadFromDisk();

    await manager.addAccount("a@example.com", "rt-1");
    await manager.addAccount("b@example.com", "rt-2");
    await manager.addAccount("c@example.com", "rt-3");

    const pick1 = await manager.getNextAvailableAccount();
    const pick2 = await manager.getNextAvailableAccount();
    const pick3 = await manager.getNextAvailableAccount();
    const pick4 = await manager.getNextAvailableAccount();

    expect(pick1?.index).toBe(0);
    expect(pick2?.index).toBe(1);
    expect(pick3?.index).toBe(2);
    expect(pick4?.index).toBe(0);
  });

  it("rotates initial account across sessions in hybrid mode", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-hybrid-"));

    const managerSession1 = await createManager(home, "hybrid");
    await managerSession1.loadFromDisk();
    await managerSession1.addAccount("a@example.com", "rt-1");
    await managerSession1.addAccount("b@example.com", "rt-2");
    const session1Pick =
      await managerSession1.getNextAvailableAccountForNewSession();

    const managerSession2 = await createManager(home, "hybrid");
    await managerSession2.loadFromDisk();
    const session2Pick =
      await managerSession2.getNextAvailableAccountForNewSession();

    expect(session1Pick?.index).not.toBeUndefined();
    expect(session2Pick?.index).not.toBeUndefined();
    expect(session2Pick?.index).not.toBe(session1Pick?.index);
  });

  it("switches after rate limit and then stays sticky", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-sticky-failover-"));
    const manager = await createManager(home, "sticky");
    await manager.loadFromDisk();

    await manager.addAccount("a@example.com", "rt-1");
    await manager.addAccount("b@example.com", "rt-2");

    const first = await manager.getNextAvailableAccount("gpt-5.2-codex");
    expect(first?.index).toBe(0);

    manager.markRateLimited(first!, 60_000, "gpt-5.2-codex");

    const second = await manager.getNextAvailableAccount("gpt-5.2-codex");
    const third = await manager.getNextAvailableAccount("gpt-5.2-codex");

    expect(second?.index).toBe(1);
    expect(third?.index).toBe(1);
  });

  it("skips rate-limited accounts and keeps round-robin progression", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-rr-failover-"));
    const manager = await createManager(home, "round-robin");
    await manager.loadFromDisk();

    await manager.addAccount("a@example.com", "rt-1");
    await manager.addAccount("b@example.com", "rt-2");
    await manager.addAccount("c@example.com", "rt-3");

    const first = await manager.getNextAvailableAccount("gpt-5.2-codex");
    expect(first?.index).toBe(0);

    const accountTwo = manager.getAllAccounts()[1];
    manager.markRateLimited(accountTwo, 60_000, "gpt-5.2-codex");

    const second = await manager.getNextAvailableAccount("gpt-5.2-codex");
    const third = await manager.getNextAvailableAccount("gpt-5.2-codex");

    expect(second?.index).toBe(2);
    expect(third?.index).toBe(0);
  });

  it("stays sticky within a single hybrid session", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-hybrid-sticky-"));
    const manager = await createManager(home, "hybrid");
    await manager.loadFromDisk();

    await manager.addAccount("a@example.com", "rt-1");
    await manager.addAccount("b@example.com", "rt-2");

    const first = await manager.getNextAvailableAccount();
    const second = await manager.getNextAvailableAccount();
    const third = await manager.getNextAvailableAccount();

    expect(first?.index).toBeDefined();
    expect(second?.index).toBe(first?.index);
    expect(third?.index).toBe(first?.index);
  });

  it("rotates account selection for new session bindings in the same hybrid process", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-hybrid-new-session-"));
    const manager = await createManager(home, "hybrid");
    await manager.loadFromDisk();

    await manager.addAccount("a@example.com", "rt-1");
    await manager.addAccount("b@example.com", "rt-2");
    await manager.addAccount("c@example.com", "rt-3");

    const firstSession = await manager.getNextAvailableAccountForNewSession();
    const secondSession = await manager.getNextAvailableAccountForNewSession();
    const thirdSession = await manager.getNextAvailableAccountForNewSession();
    const fourthSession = await manager.getNextAvailableAccountForNewSession();

    expect(firstSession?.index).toBe(0);
    expect(secondSession?.index).toBe(1);
    expect(thirdSession?.index).toBe(2);
    expect(fourthSession?.index).toBe(0);
  });

  it("persists accounts file with owner-only permissions", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-secure-file-"));
    const manager = await createManager(home, "sticky");
    await manager.loadFromDisk();

    await manager.addAccount("secure@example.com", "rt-secure");

    const filePath = join(home, ".config", "opencode", "openai-accounts.json");
    if (process.platform !== "win32") {
      const mode = statSync(filePath).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  it("loads existing v1 storage without a default", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-v1-storage-"));
    const directory = join(home, ".config", "opencode");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "openai-accounts.json"),
      JSON.stringify({
        version: 1,
        accounts: [
          {
            index: 0,
            email: "legacy@example.com",
            addedAt: 0,
            parts: { refreshToken: "legacy" },
            rateLimitResets: {},
            consecutiveFailures: 0,
          },
        ],
        activeAccountIndex: 0,
      }),
    );
    const manager = await createManager(home, "sticky");

    await manager.loadFromDisk();

    expect(manager.getDefaultAccountIndex()).toBeUndefined();
    expect(manager.getDefaultAccount()).toBeNull();
    expect(manager.getAllAccounts()[0].email).toBe("legacy@example.com");
  });

  it.each([-1, 1, 1.5, "0"])(
    "treats invalid stored default index %j as no default",
    async (defaultAccountIndex) => {
      const home = mkdtempSync(join(tmpdir(), "strategy-invalid-default-"));
      const directory = join(home, ".config", "opencode");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "openai-accounts.json"),
        JSON.stringify({
          version: 1,
          accounts: [
            {
              index: 0,
              email: "only@example.com",
              addedAt: 0,
              parts: { refreshToken: "only" },
              rateLimitResets: {},
              consecutiveFailures: 0,
            },
          ],
          activeAccountIndex: 0,
          defaultAccountIndex,
        }),
      );
      const manager = await createManager(home, "sticky");

      await manager.loadFromDisk();

      expect(manager.getDefaultAccountIndex()).toBeUndefined();
      expect(manager.getDefaultAccount()).toBeNull();
    },
  );

  it("persists and reloads a trimmed case-insensitive default lookup", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-default-persist-"));
    const manager = await createManager(home, "sticky");
    await manager.addAccount("First@example.com", "rt-1");
    await manager.addAccount("Canonical@Example.com", "rt-2");

    const selected = await manager.setDefaultAccount("  canonical@example.COM  ");
    const reloaded = await createManager(home, "sticky");
    await reloaded.loadFromDisk();

    expect(selected.email).toBe("Canonical@Example.com");
    expect(reloaded.getDefaultAccountIndex()).toBe(1);
    expect(reloaded.getDefaultAccount()?.email).toBe("Canonical@Example.com");
  });

  it("rejects unknown and ambiguous emails without mutating storage", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-default-errors-"));
    const manager = await createManager(home, "sticky");
    await manager.addAccount("Duplicate@example.com", "rt-1");
    await manager.addAccount(" duplicate@EXAMPLE.com ", "rt-2");
    const filePath = join(home, ".config", "opencode", "openai-accounts.json");
    const before = readFileSync(filePath, "utf8");

    await expect(manager.setDefaultAccount("unknown@example.com")).rejects.toThrow(
      "No account found",
    );
    await expect(manager.setDefaultAccount("duplicate@example.com")).rejects.toThrow(
      "Multiple accounts found",
    );

    expect(manager.getDefaultAccountIndex()).toBeUndefined();
    expect(readFileSync(filePath, "utf8")).toBe(before);
  });

  it.each(["sticky", "round-robin", "hybrid"] as const)(
    "returns the configured default independently of the %s strategy",
    async (strategy) => {
      const home = mkdtempSync(join(tmpdir(), `strategy-default-${strategy}-`));
      const manager = await createManager(home, strategy);
      await manager.addAccount("first@example.com", "rt-1");
      await manager.addAccount("default@example.com", "rt-2");
      await manager.setDefaultAccount("default@example.com");

      expect(manager.getDefaultAccount("gpt-5.2-codex")?.index).toBe(1);
    },
  );

  it("skips a default account while it is cooling down", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-default-cooldown-"));
    const manager = await createManager(home, "sticky");
    await manager.addAccount("default@example.com", "rt-1");
    await manager.setDefaultAccount("default@example.com");

    manager.markRateLimited(
      manager.getAllAccounts()[0],
      60_000,
      "gpt-5.2-codex",
    );

    expect(manager.getDefaultAccount("gpt-5.2-codex")).toBeNull();
  });

  it("keeps a default unavailable after persisted cooldown is reloaded", async () => {
    const home = mkdtempSync(join(tmpdir(), "strategy-default-persisted-cooldown-"));
    const manager = await createManager(home, "sticky");
    await manager.addAccount("default@example.com", "rt-1");
    await manager.setDefaultAccount("default@example.com");
    manager.markRateLimited(
      manager.getAllAccounts()[0],
      60_000,
      "gpt-5.2-codex",
    );
    await manager.saveToDisk();

    const reloaded = await createManager(home, "sticky");
    await reloaded.loadFromDisk();

    expect(reloaded.getDefaultAccountIndex()).toBe(0);
    expect(reloaded.getDefaultAccount("gpt-5.2-codex")).toBeNull();
  });

  it("clears or decrements the default index when accounts are removed", async () => {
    const clearHome = mkdtempSync(join(tmpdir(), "strategy-default-clear-"));
    const clearManager = await createManager(clearHome, "sticky");
    await clearManager.addAccount("first@example.com", "rt-1");
    await clearManager.addAccount("default@example.com", "rt-2");
    await clearManager.setDefaultAccount("default@example.com");
    clearManager.removeAccount(clearManager.getAllAccounts()[1]);
    expect(clearManager.getDefaultAccountIndex()).toBeUndefined();

    const decrementHome = mkdtempSync(join(tmpdir(), "strategy-default-decrement-"));
    const decrementManager = await createManager(decrementHome, "sticky");
    await decrementManager.addAccount("first@example.com", "rt-1");
    await decrementManager.addAccount("default@example.com", "rt-2");
    await decrementManager.setDefaultAccount("default@example.com");
    decrementManager.removeAccount(decrementManager.getAllAccounts()[0]);
    expect(decrementManager.getDefaultAccountIndex()).toBe(0);
    expect(decrementManager.getDefaultAccount()?.email).toBe("default@example.com");
  });
});
