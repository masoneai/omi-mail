import { beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
	settings: { query: vi.fn() },
	accounts: { selectByEmailIncludeDel: vi.fn() },
	users: { selectByIdIncludeDel: vi.fn() },
	roles: { selectByUserId: vi.fn(), hasAvailDomainPerm: vi.fn(), isBanEmail: vi.fn() },
	emails: { receive: vi.fn(), completeReceive: vi.fn(), physicsDelete: vi.fn() },
	attachments: { addAtt: vi.fn() },
	telegram: { sendEmailToBot: vi.fn() },
	webhook: { sendEmail: vi.fn() },
	ai: { extractCode: vi.fn() }
}));

vi.mock('../src/service/setting-service', () => ({ default: services.settings }));
vi.mock('../src/service/account-service', () => ({ default: services.accounts }));
vi.mock('../src/service/user-service', () => ({ default: services.users }));
vi.mock('../src/service/role-service', () => ({ default: services.roles }));
vi.mock('../src/service/email-service', () => ({ default: services.emails }));
vi.mock('../src/service/att-service', () => ({ default: services.attachments }));
vi.mock('../src/service/telegram-service', () => ({ default: services.telegram }));
vi.mock('../src/service/webhook-service', () => ({ default: services.webhook }));
vi.mock('../src/service/ai-service', () => ({ default: services.ai }));
vi.mock('../src/service/verify-record-service', () => ({ default: {} }));

import { email } from '../src/email/email';

const env = { admin: 'admin@example.com' };
const account = { accountId: 2, userId: 1 };
const row = { emailId: 10, ...account, subject: 'Saved email' };

function message(rawText = 'From: author@example.com\r\nTo: recipient@example.com\r\n\r\n中文正文', to = 'recipient@example.com') {
	const raw = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(rawText)); controller.close(); } });
	vi.spyOn(raw, 'getReader');
	return { from: 'author@example.com', to, raw, setReject: vi.fn(), forward: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
	vi.resetAllMocks();
	services.settings.query.mockResolvedValue({ receive: 0, noRecipient: 1, tgBotStatus: 1, forwardStatus: 1, webhookStatus: 1, ruleType: 0 });
	services.accounts.selectByEmailIncludeDel.mockResolvedValue(account);
	services.users.selectByIdIncludeDel.mockResolvedValue({ email: 'recipient@example.com' });
	services.roles.selectByUserId.mockResolvedValue({ availDomain: '', banEmail: '' });
	services.roles.hasAvailDomainPerm.mockReturnValue(true);
	services.roles.isBanEmail.mockReturnValue(false);
	services.emails.receive.mockResolvedValue(row);
	services.emails.completeReceive.mockResolvedValue(row);
	services.emails.physicsDelete.mockResolvedValue(undefined);
	services.attachments.addAtt.mockResolvedValue(undefined);
	services.ai.extractCode.mockResolvedValue('');
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('inbound email delivery', () => {
	it('does not buffer a message while the receiving service is suspended', async () => {
		services.settings.query.mockResolvedValue({ receive: 1 });
		const incoming = message();
		await email(incoming, env, {});
		expect(incoming.setReject).toHaveBeenCalledWith('Service suspended');
		expect(incoming.raw.getReader).not.toHaveBeenCalled();
	});

	it('rejects an unknown recipient without reading or parsing the raw email', async () => {
		services.accounts.selectByEmailIncludeDel.mockResolvedValue(undefined);
		const incoming = message();
		await email(incoming, env, {});
		expect(incoming.setReject).toHaveBeenCalledWith('Recipient not found');
		expect(incoming.raw.getReader).not.toHaveBeenCalled();
		expect(services.emails.receive).not.toHaveBeenCalled();
	});

	it('retains catch-all storage for unknown recipients when enabled', async () => {
		services.settings.query.mockResolvedValue({ receive: 0, noRecipient: 0 });
		services.accounts.selectByEmailIncludeDel.mockResolvedValue(undefined);
		const incoming = message();
		await email(incoming, env, {});
		expect(services.emails.receive).toHaveBeenCalledWith({ env }, expect.objectContaining({ accountId: 0, userId: 0 }), [], undefined);
		expect(services.emails.completeReceive).toHaveBeenCalledWith({ env }, 7, 10);
		expect(incoming.setReject).not.toHaveBeenCalled();
	});

	it('preserves the administrator exemption from recipient role restrictions', async () => {
		services.users.selectByIdIncludeDel.mockResolvedValue({ email: env.admin });
		services.roles.selectByUserId.mockResolvedValue({ availDomain: 'other.com', banEmail: '*' });
		const incoming = message();
		await email(incoming, env, {});
		expect(services.roles.selectByUserId).not.toHaveBeenCalled();
		expect(services.emails.completeReceive).toHaveBeenCalledOnce();
		expect(incoming.setReject).not.toHaveBeenCalled();
	});

	it.each([
		['unauthorized domain', { availDomain: 'other.com', banEmail: '' }, false],
		['fully blocked recipient', { availDomain: '', banEmail: '*' }, true],
		['account with a missing role', { availDomain: null, banEmail: null }, true]
	])('rejects an %s before reading the MIME content', async (_reason, role, allowed) => {
		services.roles.selectByUserId.mockResolvedValue(role);
		services.roles.hasAvailDomainPerm.mockReturnValue(allowed);
		const incoming = message();
		await email(incoming, env, {});
		expect(incoming.setReject).toHaveBeenCalledOnce();
		expect(incoming.raw.getReader).not.toHaveBeenCalled();
	});

	it('maps a plus alias to the existing base account while storing the original recipient', async () => {
		services.accounts.selectByEmailIncludeDel.mockResolvedValueOnce(undefined).mockResolvedValueOnce(account);
		const incoming = message('From: author@example.com\r\n\r\n中文正文', 'recipient+tag@example.com');
		await email(incoming, env, {});
		expect(services.accounts.selectByEmailIncludeDel).toHaveBeenNthCalledWith(2, { env }, 'recipient@example.com');
		expect(services.emails.receive).toHaveBeenCalledWith({ env }, expect.objectContaining({ toEmail: 'recipient+tag@example.com', accountId: 2, userId: 1, text: expect.stringContaining('中文正文') }), [], undefined);
		expect(incoming.setReject).not.toHaveBeenCalled();
	});

	it('rejects a blocked parsed sender while preserving header-based policy', async () => {
		services.roles.selectByUserId.mockResolvedValue({ availDomain: '', banEmail: 'blocked@example.com' });
		services.roles.isBanEmail.mockReturnValue(true);
		const incoming = message('From: blocked@example.com\r\n\r\nBody');
		await email(incoming, env, {});
		expect(services.roles.isBanEmail).toHaveBeenCalledWith('blocked@example.com', 'blocked@example.com');
		expect(incoming.setReject).toHaveBeenCalledWith('The recipient is disabled from receiving emails.');
		expect(services.emails.receive).not.toHaveBeenCalled();
	});

	it('keeps successful delivery independent of a failed Telegram notification', async () => {
		services.settings.query.mockResolvedValue({ receive: 0, noRecipient: 1, tgBotStatus: 0, tgChatId: '123', webhookStatus: 0, webhookUrl: 'https://example.com/hook', forwardStatus: 0, forwardEmail: ' forwarded@example.com, ', ruleType: 0 });
		services.telegram.sendEmailToBot.mockRejectedValue(new Error('Telegram unavailable'));
		services.webhook.sendEmail.mockResolvedValue(undefined);
		const pending = [];
		const incoming = message();
		await expect(email(incoming, env, { waitUntil: task => pending.push(task) })).resolves.toBeUndefined();
		await Promise.all(pending);
		expect(services.emails.completeReceive).toHaveBeenCalledOnce();
		expect(services.webhook.sendEmail).toHaveBeenCalledOnce();
		expect(incoming.forward).toHaveBeenCalledWith('forwarded@example.com');
		expect(console.error).toHaveBeenCalledWith('邮件通知失败: ', expect.any(Error));
	});

	it('deletes the incomplete row and propagates the original attachment write failure', async () => {
		const failure = new Error('object storage unavailable');
		services.attachments.addAtt.mockRejectedValue(failure);
		const incoming = message('From: author@example.com\r\nMIME-Version: 1.0\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="file.bin"\r\nContent-Transfer-Encoding: base64\r\n\r\nAQID');
		await expect(email(incoming, env, {})).rejects.toBe(failure);
		expect(services.emails.physicsDelete).toHaveBeenCalledWith({ env }, { emailIds: '10' });
		expect(services.emails.completeReceive).not.toHaveBeenCalled();
		expect(services.telegram.sendEmailToBot).not.toHaveBeenCalled();
	});

	it('preserves the original storage failure even if compensating cleanup also fails', async () => {
		const failure = new Error('database completion failed');
		services.emails.completeReceive.mockRejectedValue(failure);
		services.emails.physicsDelete.mockRejectedValue(new Error('cleanup failed'));
		await expect(email(message(), env, {})).rejects.toBe(failure);
		expect(console.error).toHaveBeenCalledWith('清理未完成邮件失败: ', expect.any(Error));
	});
});
