# Test Suite

This directory contains the comprehensive test suite for the OpenAI Codex OAuth plugin.

## Test Structure

| Test file | Covered area |
|---|---|
| `auth.test.ts` | OAuth parsing, JWT decoding, PKCE, and state validation |
| `config.test.ts` | Global and per-model configuration |
| `request-transformer.test.ts` | Model normalization, prompts, reasoning, and request transformation |
| `account-manager-strategy.test.ts` | Selection strategies, default persistence, eligibility, and account removal |
| `session-bindings.test.ts` | Session binding persistence and validation |
| `runtime-fetch-parity.test.ts` | First-use default selection and 429 fallback rebinding |
| `cli.test.ts` | `multiauth` help, validation, lookup, and persistence |
| `install-script.test.ts` | JSONC installation, uninstall behavior, and Windows paths |
| Other `*.test.ts` files | Browser, logging, model prompts, status, fetch helpers, and responses |

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Visual test UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Current Test Areas

- OAuth authentication and token claims.
- Plugin and model configuration.
- Request transformation and response handling.
- Account rotation, cooldowns, and default-account storage.
- Trimmed, case-insensitive email matching and error behavior.
- Session default precedence and 429 fallback rebinding.
- CLI parsing and package binary metadata.
- Windows path environment behavior.

Exact totals are intentionally omitted. Run `npm test` for the current result.

## Test Philosophy

1. **Comprehensive Coverage**: Each module has extensive tests covering normal cases, edge cases, and error conditions
2. **Fast Execution**: All tests run in < 250ms
3. **No External Dependencies**: Tests use mocked data and don't make real API calls
4. **Type Safety**: All tests are written in TypeScript with full type checking

## Validation Commands

```bash
npm run typecheck
npm test
npm run build
```

Tests use mocked data and do not make real OpenAI API calls.

## Adding New Tests

When adding new functionality:

1. Create or update the relevant test file
2. Follow the existing pattern using vitest's `describe` and `it` blocks
3. Ensure tests are isolated and don't depend on external state
4. Run `npm test` to verify all tests pass
5. Run `npm run typecheck` to ensure TypeScript types are correct

## Example Configurations

See the `config/` directory for working configuration examples:
- `minimal-opencode.json`: Simplest setup with defaults
- `opencode-legacy.json`: Legacy complete example with all model variants
- `opencode-modern.json`: Variant-based example for OpenCode v1.0.210+
