import { describe, expect, it, vi } from 'vitest';
import { createSettingsCache, SETTINGS_CACHE_TTL_MS } from '../src/service/settings-cache';
import { normalizeDomains } from '../src/service/domain-settings';

describe('settings cache', () => {
	it('reuses completed KV reads for at most 30 seconds and isolates returned credentials', async () => {
		let time = 0;
		const cache = createSettingsCache({ now: () => time });
		const binding = {};
		const stored = { resendTokens: { 'example.com': 'real-key' } };
		const read = vi.fn(async () => stored);

		const first = await cache.get(binding, read);
		first.resendTokens['example.com'] = 'masked';
		stored.resendTokens['example.com'] = 'external-mutation';
		time = SETTINGS_CACHE_TTL_MS - 1;
		expect((await cache.get(binding, read)).resendTokens['example.com']).toBe('real-key');
		expect(read).toHaveBeenCalledTimes(1);

		time = SETTINGS_CACHE_TTL_MS;
		expect((await cache.get(binding, read)).resendTokens['example.com']).toBe('external-mutation');
		expect(read).toHaveBeenCalledTimes(2);
	});

	it('separates namespaces and invalidates immediately after a refresh', async () => {
		const cache = createSettingsCache();
		const first = {};
		const second = {};
		await cache.get(first, async () => ({ title: 'first' }));
		expect(await cache.get(second, async () => ({ title: 'second' }))).toEqual({ title: 'second' });
		cache.invalidate(first);
		expect(await cache.get(first, async () => ({ title: 'new' }))).toEqual({ title: 'new' });
	});

	it('does not let a read started before a refresh overwrite the refreshed value', async () => {
		const cache = createSettingsCache();
		const binding = {};
		let completeOldRead;
		const oldRead = cache.get(binding, () => new Promise(resolve => { completeOldRead = resolve; }));
		cache.invalidate(binding);
		cache.set(binding, { title: 'new' });
		completeOldRead({ title: 'old' });
		await oldRead;
		const read = vi.fn();
		expect(await cache.get(binding, read)).toEqual({ title: 'new' });
		expect(read).not.toHaveBeenCalled();
	});

	it('does not reuse in-flight I/O across request contexts', async () => {
		const cache = createSettingsCache();
		const binding = {};
		const read = vi.fn(async () => ({ title: 'settings' }));
		await Promise.all([cache.get(binding, read), cache.get(binding, read)]);
		expect(read).toHaveBeenCalledTimes(2);
	});

	it('does not cache missing settings or failures', async () => {
		const cache = createSettingsCache();
		const binding = {};
		const read = vi.fn()
			.mockResolvedValueOnce(null)
			.mockRejectedValueOnce(new Error('KV unavailable'))
			.mockResolvedValueOnce({ title: 'initialized' });
		expect(await cache.get(binding, read)).toBeNull();
		await expect(cache.get(binding, read)).rejects.toThrow('KV unavailable');
		expect(await cache.get(binding, read)).toEqual({ title: 'initialized' });
	});
});

describe('domain configuration', () => {
	it('normalizes TOML arrays and JSON strings with stable deduplication', () => {
		const expected = ['example.com', 'second.example'];
		const domains = [' Example.COM ', 'second.example', 'example.com'];
		expect(normalizeDomains(domains)).toEqual(expected);
		expect(normalizeDomains(JSON.stringify(domains))).toEqual(expected);
		expect(domains[0]).toBe(' Example.COM ');
	});

	it.each([undefined, null, '', '   ', [], '[]'])('rejects empty domain configuration: %j', value => {
		expect(() => normalizeDomains(value)).toThrow('noDomainVariable');
	});

	it.each(['example.com', '{}', 'null', '"example.com"', {}, [1], [' '], ['example.com', null]])(
		'rejects non-array or invalid array configuration: %j', value => {
			expect(() => normalizeDomains(value)).toThrow('notJsonDomain');
		}
	);
});
