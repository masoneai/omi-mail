import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1 } from './helpers/d1';

vi.mock('../src/i18n/i18n', () => ({ t: key => key }));

import emailService from '../src/service/email-service';
import userService from '../src/service/user-service';
import accountService from '../src/service/account-service';
import roleService from '../src/service/role-service';
import settingService from '../src/service/setting-service';
import attService from '../src/service/att-service';
import emailUtils from '../src/utils/email-utils';
import { emailConst, settingConst } from '../src/const/entity-const';

const schema = `
CREATE TABLE user (user_id INTEGER PRIMARY KEY, send_count INTEGER DEFAULT 0, type INTEGER DEFAULT 1);
INSERT INTO user (user_id, send_count) VALUES (1, 0);
CREATE TABLE account (
 account_id INTEGER PRIMARY KEY, email TEXT NOT NULL, name TEXT DEFAULT '',
 status INTEGER DEFAULT 0, latest_email_time TEXT, create_time TEXT DEFAULT CURRENT_TIMESTAMP,
 user_id INTEGER NOT NULL, all_receive INTEGER DEFAULT 0, sort INTEGER DEFAULT 0, is_del INTEGER DEFAULT 0
);
INSERT INTO account (account_id, email, user_id) VALUES
 (1, 'sender@Example.COM', 1), (2, 'recipient@example.com', 2);
CREATE TABLE email (
 email_id INTEGER PRIMARY KEY AUTOINCREMENT, send_email TEXT, name TEXT,
 account_id INTEGER NOT NULL, user_id INTEGER NOT NULL, subject TEXT,
 code TEXT NOT NULL DEFAULT '', text TEXT, content TEXT, cc TEXT DEFAULT '[]', bcc TEXT DEFAULT '[]',
 recipient TEXT, to_email TEXT NOT NULL DEFAULT '', to_name TEXT NOT NULL DEFAULT '',
 in_reply_to TEXT DEFAULT '', relation TEXT DEFAULT '', message_id TEXT DEFAULT '',
 type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, resend_email_id TEXT,
 message TEXT, unread INTEGER NOT NULL DEFAULT 0, create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 is_del INTEGER NOT NULL DEFAULT 0
);`;

describe('send validation, quota and delivery', () => {
	let db, c, role, provider;
	const form = overrides => ({ accountId: 1, receiveEmail: ['recipient@outside.com'],
		subject: 'Hello', content: '<p>Hello</p>', text: 'Hello', attachments: [], ...overrides });
	const sendCount = () => db.sqlite.prepare('SELECT send_count FROM user WHERE user_id = 1').get().send_count;

	beforeEach(() => {
		db = createTestD1(schema);
		c = { env: { db, admin: 'admin@example.com', domain: '["example.com"]',
			kv: { get: vi.fn(async () => null), put: vi.fn(async () => {}) } } };
		role = { sendType: 'day', sendCount: 100, availDomain: '' };
		vi.spyOn(settingService, 'query').mockResolvedValue({ resendTokens: { 'example.com': 're_test' },
			domainList: ['@example.com'], send: settingConst.send.OPEN, r2Domain: '',
			noRecipient: settingConst.noRecipient.CLOSE });
		// Keep stale reads to exercise the atomic reservation, not a test-side lock.
		vi.spyOn(userService, 'selectById').mockResolvedValue({ userId: 1, email: 'sender@example.com', type: 1, sendCount: 0 });
		vi.spyOn(roleService, 'selectById').mockImplementation(async () => role);
		vi.spyOn(roleService, 'selectByUserIds').mockResolvedValue([{ userId: 2, banEmail: '', availDomain: '' }]);
		vi.spyOn(attService, 'toImageUrlHtml').mockResolvedValue({ imageDataList: [], html: '<p>Hello</p>' });
		vi.spyOn(attService, 'selectByEmailIds').mockResolvedValue([]);
		vi.spyOn(attService, 'saveSendAtt').mockResolvedValue();
		vi.spyOn(attService, 'saveArticleAtt').mockResolvedValue();
		provider = vi.spyOn(emailService, 'sendByResend').mockResolvedValue({ data: { id: 'resend-id' } });
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		db.close();
	});

	it.each([undefined, [], ['bad-address'], [null]])('rejects invalid recipients before sending: %j', async receiveEmail => {
		await expect(emailService.send(c, form({ receiveEmail }), 1)).rejects.toMatchObject({ code: 400 });
		expect(provider).not.toHaveBeenCalled();
		expect(sendCount()).toBe(0);
	});

	it('rejects excessive attachments before either provider accepts a message', async () => {
		c.env.email = { send: vi.fn() };
		await expect(emailService.send(c, form({ attachments: Array(11).fill({ filename: 'a.txt', content: 'YQ==' }) }), 1))
			.rejects.toMatchObject({ message: 'attLimit' });
		expect(provider).not.toHaveBeenCalled();
		expect(c.env.email.send).not.toHaveBeenCalled();
		expect(sendCount()).toBe(0);
	});

	it('rejects excessive inline images before sending or reserving quota', async () => {
		attService.toImageUrlHtml.mockResolvedValue({ imageDataList: Array(11).fill({ contentId: 'cid' }), html: '<p>Hello</p>' });
		await expect(emailService.send(c, form(), 1)).rejects.toMatchObject({ message: 'imageAttLimit' });
		expect(provider).not.toHaveBeenCalled();
		expect(sendCount()).toBe(0);
	});

	it('rejects malformed attachment data before sending', async () => {
		await expect(emailService.send(c, form({ attachments: [{ filename: 'a.txt', content: 'not base64!' }] }), 1))
			.rejects.toMatchObject({ code: 400 });
		expect(provider).not.toHaveBeenCalled();
		expect(sendCount()).toBe(0);
	});

	it('normalizes sender domains when selecting a Resend token', async () => {
		await emailService.send(c, form(), 1);
		expect(provider).toHaveBeenCalledWith('re_test', expect.objectContaining({ accountEmail: 'sender@Example.COM' }));
		expect(sendCount()).toBe(1);
	});

	it('uses an existing mixed-case token key without forcing credential migration', async () => {
		settingService.query.mockResolvedValue({ resendTokens: { ' Example.COM ': 're_legacy' },
			domainList: ['@example.com'], send: settingConst.send.OPEN, r2Domain: '' });
		await emailService.send(c, form(), 1);
		expect(provider).toHaveBeenCalledWith('re_legacy', expect.any(Object));
	});

	it('prefers a canonical token over an old duplicate mixed-case key', async () => {
		settingService.query.mockResolvedValue({ resendTokens: { 'example.com': 're_current', 'Example.COM': 're_legacy' },
			domainList: ['@example.com'], send: settingConst.send.OPEN, r2Domain: '' });
		await emailService.send(c, form(), 1);
		expect(provider).toHaveBeenCalledWith('re_current', expect.any(Object));
	});

	it('delivers mixed-case internal addresses locally without a provider', async () => {
		role.sendType = 'internal';
		await emailService.send(c, form({ receiveEmail: ['RECIPIENT@EXAMPLE.COM'] }), 1);
		expect(provider).not.toHaveBeenCalled();
		const inbox = db.sqlite.prepare('SELECT user_id, account_id, to_email, status FROM email WHERE type = 0').get();
		expect(inbox).toEqual({ user_id: 2, account_id: 2, to_email: 'RECIPIENT@EXAMPLE.COM', status: emailConst.status.RECEIVE });
	});

	it('reserves only one remaining recipient across concurrent requests with stale user reads', async () => {
		role.sendCount = 1;
		const results = await Promise.allSettled([emailService.send(c, form(), 1), emailService.send(c, form(), 1)]);
		expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
		expect(results.filter(result => result.status === 'rejected')[0].reason).toMatchObject({ code: 403 });
		expect(provider).toHaveBeenCalledTimes(1);
		expect(sendCount()).toBe(1);
	});

	it.each(['day', 'count'])('counts every recipient exactly once for a %s quota', async sendType => {
		role.sendType = sendType;
		await emailService.send(c, form({ receiveEmail: ['a@outside.com', 'b@outside.com'] }), 1);
		expect(sendCount()).toBe(2);
	});

	it('treats a stored string send count numerically when checking remaining quota', async () => {
		role.sendCount = 10;
		userService.selectById.mockResolvedValue({ userId: 1, email: 'sender@example.com', type: 1, sendCount: '9' });
		db.sqlite.prepare('UPDATE user SET send_count = 9').run();
		await emailService.send(c, form(), 1);
		expect(sendCount()).toBe(10);
	});

	it('returns reserved quota after a provider rejects the message', async () => {
		provider.mockResolvedValue({ error: { message: 'Domain not verified' } });
		await expect(emailService.send(c, form(), 1)).rejects.toThrow('Domain not verified');
		expect(sendCount()).toBe(0);
		expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM email').get().n).toBe(0);
	});

	it('retains reserved quota after a Cloudflare transport failure with unknown delivery', async () => {
		c.env.email = { send: vi.fn(async () => { throw new Error('Send failed'); }) };
		await expect(emailService.send(c, form(), 1)).rejects.toThrow('Send failed');
		expect(sendCount()).toBe(1);
	});

	it('retains reserved quota after a Resend transport failure with unknown delivery', async () => {
		provider.mockRejectedValue(new Error('Network connection lost'));
		await expect(emailService.send(c, form(), 1)).rejects.toThrow('Network connection lost');
		expect(sendCount()).toBe(1);
	});

	it('returns an authentication error when the sending user no longer exists', async () => {
		userService.selectById.mockResolvedValue(undefined);
		await expect(emailService.send(c, form(), 1)).rejects.toMatchObject({ code: 401 });
		expect(provider).not.toHaveBeenCalled();
	});

	it('returns a permission error when the sending role no longer exists', async () => {
		roleService.selectById.mockResolvedValue(undefined);
		await expect(emailService.send(c, form(), 1)).rejects.toMatchObject({ code: 403 });
		expect(provider).not.toHaveBeenCalled();
	});

	it('preserves successful delivery when KV statistics fail', async () => {
		c.env.kv.put.mockRejectedValue(new Error('KV write rate limit'));
		const result = await emailService.send(c, form(), 1);
		expect(result[0].resendEmailId).toBe('resend-id');
		expect(provider).toHaveBeenCalledTimes(1);
		expect(sendCount()).toBe(1);
	});

	it('prevents replying through a different user\'s email', async () => {
		vi.spyOn(emailService, 'selectById').mockResolvedValue({ userId: 2, messageId: '<private-message>' });
		await expect(emailService.send(c, form({ sendType: 'reply', emailId: 9 }), 1)).rejects.toThrow('notExistEmailReply');
		expect(provider).not.toHaveBeenCalled();
		expect(sendCount()).toBe(0);
	});

	it('does not subtract new-day usage after an old-day provider failure', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-07T23:59:59Z'));
		provider.mockImplementation(async () => {
			vi.setSystemTime(new Date('2026-10-08T00:00:01Z'));
			db.sqlite.prepare('UPDATE user SET send_count = 2').run();
			return { error: { message: 'Send failed' } };
		});
		await expect(emailService.send(c, form(), 1)).rejects.toThrow('Send failed');
		expect(sendCount()).toBe(2);
	});

	it.each(['example.co', 'ample.com', 'com'])('rejects a substring domain for a new alias: %s', async domain => {
		settingService.query.mockResolvedValue({ addEmail: settingConst.addEmail.OPEN, manyEmail: settingConst.manyEmail.OPEN,
			domainList: ['@example.com'], emailPrefixFilter: [], minEmailPrefix: 1 });
		await expect(accountService.add(c, { email: `new@${domain}` }, 1)).rejects.toThrow();
		expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM account').get().n).toBe(2);
	});

	it('rejects substring domains in the administrator create-user path', async () => {
		await expect(userService.add(c, { email: 'new@example.co', password: 'secret123' })).rejects.toThrow('notEmailDomain');
	});

	it('trims and folds domain names without changing the local part', () => {
		expect(emailUtils.getDomain(' Name@EXAMPLE.COM ')).toBe('example.com');
		expect(emailUtils.getName(' Name@EXAMPLE.COM ')).toBe('Name');
	});

	it('uses the midnight scheduled timestamp when a daily quota reset runs late', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-08T01:00:00Z'));
		vi.spyOn(roleService, 'selectByIdsAndSendType').mockResolvedValue([{ roleId: 1 }]);
		db.sqlite.prepare('UPDATE user SET send_count = 8').run();
		await userService.resetDaySendCount(c, Date.parse('2026-10-08T00:00:00Z'));
		expect(sendCount()).toBe(0);
	});

	it('does not reset quota for a non-midnight scheduled trigger', async () => {
		db.sqlite.prepare('UPDATE user SET send_count = 8').run();
		await userService.resetDaySendCount(c, Date.parse('2026-10-08T01:00:00Z'));
		expect(sendCount()).toBe(8);
	});
});
