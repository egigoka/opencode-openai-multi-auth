#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AccountManager } from "./accounts/manager.js";

const HELP = `Usage: multiauth -d <EMAIL_ADDRESS>

Options:
  -d, --default <EMAIL_ADDRESS>  Set the default OpenAI account
  -h, --help                     Show this help`;

export interface CliIO {
  stdout: Pick<NodeJS.WriteStream, "write">;
  stderr: Pick<NodeJS.WriteStream, "write">;
}

export async function runCli(
  args: string[] = process.argv.slice(2),
  io: CliIO = { stdout: process.stdout, stderr: process.stderr },
): Promise<number> {
  if (args.length === 0 || (args.length === 1 && ["-h", "--help"].includes(args[0]))) {
    io.stdout.write(`${HELP}\n`);
    return 0;
  }

  let email: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument !== "-d" && argument !== "--default") {
      io.stderr.write(`Unknown or unexpected argument: ${argument}\n`);
      return 1;
    }
    if (email !== undefined) {
      io.stderr.write("The default option may only be provided once.\n");
      return 1;
    }
    const value = args[++index];
    if (!value || value.startsWith("-") || value.trim().length === 0) {
      io.stderr.write("The default option requires an email address.\n");
      return 1;
    }
    email = value;
  }

  if (email === undefined) {
    io.stderr.write("The default option requires an email address.\n");
    return 1;
  }

  const manager = new AccountManager({ quietMode: true });
  await manager.loadFromDisk();
  try {
    const account = await manager.setDefaultAccount(email);
    io.stdout.write(
      `Default OpenAI account set to ${account.email}. Restart OpenCode to apply the change.\n`,
    );
    return 0;
  } catch (error) {
    io.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

export function isDirectExecution(
  entryPath: string | undefined,
  moduleUrl: string,
): boolean {
  if (!entryPath) return false;
  try {
    return realpathSync(entryPath) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isDirectExecution(process.argv[1], import.meta.url)) {
  process.exitCode = await runCli();
}
