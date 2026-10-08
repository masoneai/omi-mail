import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/entity/orm', () => ({ default: vi.fn() }));
vi.mock('../src/utils/file-utils', () => ({ default: {} }));
vi.mock('../src/service/r2-service', () => ({ default: { storageType: vi.fn(async () => 'kv') } }));
vi.mock('../src/service/verify-record-service', () => ({ default: { selectListByIP: vi.fn(async () => []) } }));
vi.mock('../src/security/user-context', () => ({ default: { getToken: vi.fn(async () => null) } }));
vi.mock('../src/i18n/i18n', () => ({ t: key => key }));

import orm from '../src/entity/orm';
import settingService from '../src/service/setting-service';
import KvConst from '../src/const/kv-const';

function rawSettings(overrides = {}) {
	return {
		title: 'Cloud Mail',
		resendTokens: { 'example.com': 're_example_secret_token' },
		siteKey: 'site-key-original',
		secretKey: 'secret-key-original',
		s3AccessKey: 's3-access-original',
		s3SecretKey: 's3-secret-original',
		tgBotToken: '1234567890:telegram-original-token',
		emailPrefixFilter: 'admin,support',
		...overrides
	};
}

function context(env) {
	const values = new Map();
	return { env, get: key => values.get(key), set: (key, value) => values.set(key, value) };
}

function environment(settings = rawSettings(), overrides = {}) {
	return {
		kv: { get: vi.fn(async () => structuredClone(settings)), put: vi.fn(async () => {}) },
		domain: [' Example.COM ', 'example.com'],
		...overrides
	};
}

describe('setting service', () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it('masks only the API response and preserves credentials for subsequent internal calls', async () => {
		const env = environment();
		const c = context(env);
		const original = await settingService.query(c);
		const masked = await settingService.get(c);
		expect(masked.siteKey).toBe('site-k******');
		expect(masked.resendTokens['example.com']).toBe('re_example_s******');
		expect(masked.secretKey).not.toBe(original.secretKey);
		expect(await settingService.query(c)).toBe(original);
		expect(original).toMatchObject(rawSettings({ emailPrefixFilter: ['admin', 'support'] }));
		const next = await settingService.query(context(env));
		expect(next).not.toBe(original);
		expect(next.resendTokens['example.com']).toBe('re_example_secret_token');
		expect(env.kv.get).toHaveBeenCalledTimes(1);
	});

	it('derives domains and project links independently for each environment sharing a namespace', async () => {
		const first = environment(undefined, { project_link: false });
		const second = { ...first, domain: '[" Second.Example "]', project_link: true };
		expect(await settingService.query(context(first))).toMatchObject({ domainList: ['@example.com'], projectLink: false });
		expect(await settingService.query(context(second))).toMatchObject({ domainList: ['@second.example'], projectLink: true });
		expect(first.kv.get).toHaveBeenCalledTimes(1);
	});

	it('supports email-event contexts with only env and gives each caller its own object', async () => {
		const env = environment();
		const first = await settingService.query({ env });
		first.resendTokens['example.com'] = 'changed';
		expect((await settingService.query({ env })).resendTokens['example.com']).toBe('re_example_secret_token');
		expect(env.kv.get).toHaveBeenCalledTimes(1);
	});

	it('refreshes raw KV settings and immediately exposes normalized fresh request settings', async () => {
		const env = environment();
		const c = context(env);
		await settingService.query(c);
		const row = rawSettings({ title: 'updated', resendTokens: '{"example.com":"new-secret"}' });
		orm.mockReturnValue({ select: () => ({ from: () => ({ get: async () => row }) }) });
		await settingService.refresh(c);
		expect(env.kv.put).toHaveBeenCalledWith(KvConst.SETTING, expect.any(String));
		const stored = JSON.parse(env.kv.put.mock.calls[0][1]);
		expect(stored.emailPrefixFilter).toBe('admin,support');
		expect(stored).not.toHaveProperty('domainList');
		expect(await settingService.query(c)).toMatchObject({ title: 'updated', domainList: ['@example.com'], emailPrefixFilter: ['admin', 'support'] });
		expect((await settingService.query(context(env))).resendTokens['example.com']).toBe('new-secret');
		expect(env.kv.get).toHaveBeenCalledTimes(1);
		await expect(settingService.refresh({ env })).resolves.toBeUndefined();
	});

	it('preserves existing resend credentials when settings are saved after a masked API read', async () => {
		const env = environment();
		const c = context(env);
		await settingService.get(c);
		let saved;
		orm.mockReturnValue({
			update: () => ({
				set: data => {
					saved = { ...data };
					return { returning: () => ({ get: async () => saved }) };
				}
			}),
			select: () => ({ from: () => ({ get: async () => rawSettings(saved) }) })
		});
		await settingService.set(c, { title: 'new title' });
		expect(JSON.parse(saved.resendTokens)).toEqual({ 'example.com': 're_example_secret_token' });
		expect((await settingService.query(c)).resendTokens['example.com']).toBe('re_example_secret_token');
	});

	it('reports domain errors as business errors instead of failing with .map TypeError', async () => {
		await expect(settingService.query({ env: environment(undefined, { domain: '{}' }) }))
			.rejects.toMatchObject({ name: 'BizError', message: 'notJsonDomain' });
		await expect(settingService.query({ env: environment(undefined, { domain: '[]' }) }))
			.rejects.toMatchObject({ name: 'BizError', message: 'noDomainVariable' });
	});
});
