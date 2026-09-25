import { describe, it, expect } from 'vitest';
import {
	OAUTH_LOGIN_TIMEOUT_DEFAULT_MS,
	OAUTH_POLL_INTERVAL_MS,
	resolveOAuthLoginTimeoutMs,
} from '../lib/constants.js';

describe('resolveOAuthLoginTimeoutMs', () => {
	it('falls back to the default when no value is provided', () => {
		expect(resolveOAuthLoginTimeoutMs(undefined)).toBe(
			OAUTH_LOGIN_TIMEOUT_DEFAULT_MS,
		);
	});

	it('parses a valid positive integer', () => {
		expect(resolveOAuthLoginTimeoutMs('120000')).toBe(120000);
	});

	it('ignores trailing units and parses the leading integer', () => {
		expect(resolveOAuthLoginTimeoutMs('90000ms')).toBe(90000);
	});

	it('falls back to the default for non-numeric input', () => {
		expect(resolveOAuthLoginTimeoutMs('abc')).toBe(
			OAUTH_LOGIN_TIMEOUT_DEFAULT_MS,
		);
	});

	it('falls back to the default for zero or negative values', () => {
		expect(resolveOAuthLoginTimeoutMs('0')).toBe(
			OAUTH_LOGIN_TIMEOUT_DEFAULT_MS,
		);
		expect(resolveOAuthLoginTimeoutMs('-5000')).toBe(
			OAUTH_LOGIN_TIMEOUT_DEFAULT_MS,
		);
	});

	it('keeps the default timeout above the previous fixed 60s', () => {
		expect(OAUTH_LOGIN_TIMEOUT_DEFAULT_MS).toBeGreaterThan(60000);
	});

	it('uses a positive poll interval', () => {
		expect(OAUTH_POLL_INTERVAL_MS).toBeGreaterThan(0);
	});
});
