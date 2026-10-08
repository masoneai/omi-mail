import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/entity/orm', () => ({ default: vi.fn() }));
vi.mock('../src/utils/file-utils', () => ({ default: {} }));
vi.mock('../src/service/r2-service', () => ({ default: {} }));
vi.mock('../src/service/verify-record-service', () => ({ default: {} }));
vi.mock('../src/security/user-context', () => ({ default: {} }));
vi.mock('../src/i18n/i18n', () => ({ t: key => key }));
vi.mock('../src/service/user-service', () => ({
	default: { insert: vi.fn(async () => 42), updateUserInfo: vi.fn(async () => {}) }
}));
vi.mock('../src/service/account-service', () => ({
	default: { selectByEmailIncludeDel: vi.fn(async () => null), insert: vi.fn(async () => {}) }
}));
vi.mock('../src/service/role-service', () => ({
	default: {
		selectDefaultRole: vi.fn(async () => ({ roleId: 1 })),
		selectById: vi.fn(async () => ({ availDomain: [] })),
		hasAvailDomainPerm: vi.fn(() => true),
		roleSelectUse: vi.fn(async () => [{ roleId: 1, name: 'default', isDefault: 1 }])
	}
}));
vi.mock('../src/service/reg-key-service', () => ({ default: {} }));
vi.mock('../src/service/turnstile-service', () => ({ default: {} }));
vi.mock('../src/utils/crypto-utils', () => ({
	default: { hashPassword: vi.fn(async () => ({ salt: 'test-salt', hash: 'test-hash' })) }
}));
vi.mock('../src/utils/req-utils', () => ({
	default: {
		getIp: vi.fn(() => '192.0.2.1'),
		getUserAgent: vi.fn(() => ({ os: 'Test', browser: 'Test', device: 'Desktop' }))
	}
}));

import loginService from '../src/service/login-service';
import publicService from '../src/service/public-service';
import userService from '../src/service/user-service';
import accountService from '../src/service/account-service';
import cryptoUtils from '../src/utils/crypto-utils';
import { settingConst } from '../src/const/entity-const';

function registrationContext(domain) {
	return {
		env: {
			domain,
			kv: {
				get: vi.fn(async () => ({
					register: settingConst.register.OPEN,
					regKey: settingConst.regKey.CLOSE,
					registerVerify: settingConst.registerVerify.CLOSE,
					regVerifyCount: 1,
					minEmailPrefix: 1,
					emailPrefixFilter: '',
					resendTokens: {}
				}))
			}
		}
	};
}

describe('registration domain allowlist', () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it.each(['alice@example.com', 'alice@ail.example.com', 'alice@evil.mail.example.com'])(
		'rejects an unconfigured domain before creating records: %s', async email => {
			const c = registrationContext('["mail.example.com"]');
			await expect(loginService.register(c, { email, password: 'password123' }))
				.rejects.toMatchObject({ name: 'BizError', message: 'notEmailDomain' });
			expect(accountService.selectByEmailIncludeDel).not.toHaveBeenCalled();
			expect(cryptoUtils.hashPassword).not.toHaveBeenCalled();
			expect(userService.insert).not.toHaveBeenCalled();
		}
	);

	it.each([[' Mail.Example.COM '], '[" Mail.Example.COM "]'])(
		'allows the exact canonical domain in either supported environment format: %j', async domain => {
			const c = registrationContext(domain);
			await expect(loginService.register(c, { email: 'alice@MAIL.EXAMPLE.COM', password: 'password123' }))
				.resolves.toEqual({ regVerifyOpen: false });
			expect(accountService.insert).toHaveBeenCalledWith(c, {
				userId: 42, email: 'alice@MAIL.EXAMPLE.COM', name: 'alice'
			});
		}
	);

	it('keeps the domain allowlist enforced for OAuth registration', async () => {
		const c = registrationContext('["mail.example.com"]');
		await expect(loginService.register(c, { email: 'alice@example.com', password: 'password123' }, true))
			.rejects.toMatchObject({ name: 'BizError', message: 'notEmailDomain' });
		expect(userService.insert).not.toHaveBeenCalled();
	});
});

describe('public bulk user creation domain allowlist', () => {
	beforeEach(() => { vi.clearAllMocks(); });

	function bulkContext(domain) {
		const c = registrationContext(domain);
		c.env.db = {
			prepare: vi.fn(statement => ({ statement })),
			batch: vi.fn(async () => [])
		};
		return c;
	}

	it.each(['alice@example.com', 'alice@ail.example.com', 'alice@evil.mail.example.com'])(
		'rejects an unconfigured domain before writing bulk users: %s', async email => {
			const c = bulkContext('["mail.example.com"]');
			await expect(publicService.addUser(c, { list: [{ email, password: 'password123' }] }))
				.rejects.toMatchObject({ name: 'BizError', message: 'notEmailDomain' });
			expect(cryptoUtils.hashPassword).not.toHaveBeenCalled();
			expect(c.env.db.prepare).not.toHaveBeenCalled();
			expect(c.env.db.batch).not.toHaveBeenCalled();
		}
	);

	it.each([
		{ domain: [' Mail.Example.COM '] },
		{ domain: '[" Mail.Example.COM "]' }
	])('allows canonical domains for bulk users: $domain', async ({ domain }) => {
		const c = bulkContext(domain);
		await expect(publicService.addUser(c, {
			list: [{ email: 'alice@MAIL.EXAMPLE.COM', password: 'password123' }]
		})).resolves.toBeUndefined();
		expect(cryptoUtils.hashPassword).toHaveBeenCalledWith('password123');
		expect(c.env.db.batch).toHaveBeenCalledTimes(1);
	});

	it('keeps an empty bulk request a no-op', async () => {
		const c = bulkContext('["mail.example.com"]');
		await expect(publicService.addUser(c, { list: [] })).resolves.toBeUndefined();
		expect(c.env.kv.get).not.toHaveBeenCalled();
		expect(c.env.db.batch).not.toHaveBeenCalled();
	});
});
