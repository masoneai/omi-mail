import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestD1 } from './helpers/d1';

vi.mock('../src/i18n/i18n', () => ({ t: key => key }));

import emailService from '../src/service/email-service';
import attService from '../src/service/att-service';

const schema = `
CREATE TABLE account (
 account_id INTEGER PRIMARY KEY, email TEXT NOT NULL, name TEXT DEFAULT '',
 status INTEGER DEFAULT 0, latest_email_time TEXT, create_time TEXT DEFAULT CURRENT_TIMESTAMP,
 user_id INTEGER NOT NULL, all_receive INTEGER DEFAULT 0, sort INTEGER DEFAULT 0, is_del INTEGER DEFAULT 0
);
INSERT INTO account (account_id, email, user_id, is_del) VALUES
 (11, 'first@example.com', 1, 0), (12, 'second@example.com', 1, 0),
 (13, 'deleted@example.com', 1, 1), (21, 'other@example.com', 2, 0);
CREATE TABLE email (
 email_id INTEGER PRIMARY KEY AUTOINCREMENT, send_email TEXT, name TEXT,
 account_id INTEGER NOT NULL, user_id INTEGER NOT NULL, subject TEXT,
 code TEXT NOT NULL DEFAULT '', text TEXT, content TEXT, cc TEXT DEFAULT '[]', bcc TEXT DEFAULT '[]',
 recipient TEXT, to_email TEXT NOT NULL DEFAULT '', to_name TEXT NOT NULL DEFAULT '',
 in_reply_to TEXT DEFAULT '', relation TEXT DEFAULT '', message_id TEXT DEFAULT '',
 type INTEGER NOT NULL DEFAULT 0, status INTEGER NOT NULL DEFAULT 0, resend_email_id TEXT,
 message TEXT, unread INTEGER NOT NULL DEFAULT 0, create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 is_del INTEGER NOT NULL DEFAULT 0
);
INSERT INTO email (email_id, account_id, user_id, type, is_del, text, content) VALUES
 (10, 11, 1, 0, 0, 'First message', '<p>First message</p>'),
 (20, 12, 1, 0, 0, 'Second message', '<p>Second message</p>'),
 (30, 11, 1, 0, 0, 'Latest message', '<p>Latest message</p>'),
 (70, 11, 1, 1, 0, 'Sent message', '<p>Sent message</p>'),
 (80, 11, 1, 0, 1, 'Deleted message', '<p>Deleted message</p>'),
 (90, 13, 1, 0, 0, 'Deleted mailbox', '<p>Deleted mailbox</p>'),
 (91, 99, 1, 0, 0, 'Missing mailbox', '<p>Missing mailbox</p>'),
 (95, 21, 2, 0, 0, 'Other user', '<p>Other user</p>');
CREATE TABLE star (
 star_id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, email_id INTEGER NOT NULL,
 create_time TEXT DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO star (star_id, user_id, email_id) VALUES (1, 1, 10), (2, 2, 30);
`;

describe('mailbox and unified inbox queries', () => {
	let db, c;
	const query = overrides => ({ accountId: 0, allReceive: 1, type: 0,
		emailId: 0, size: 50, timeSort: 0, full: 0, ...overrides });
	const ids = list => list.map(item => item.emailId);

	beforeEach(() => {
		db = createTestD1(schema);
		c = { env: { db } };
		vi.spyOn(attService, 'selectByEmailIds').mockResolvedValue([]);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		db.close();
	});

	it('aggregates only the current user\'s active inboxes, with a matching total and latest cursor', async () => {
		const result = await emailService.list(c, query(), 1);
		expect(ids(result.list)).toEqual([30, 20, 10]);
		expect(result.total).toBe(3);
		expect(result.latestEmail).toEqual({ emailId: 30, accountId: 11, userId: 1 });
		expect(result.list.map(item => item.isStar)).toEqual([0, 0, 1]);
		expect(result.list[0]).toMatchObject({ listText: 'Latest message' });
		expect(result.list[0]).not.toHaveProperty('content');
		expect(result.list[0]).not.toHaveProperty('text');

		const other = await emailService.list(c, query(), 2);
		expect(ids(other.list)).toEqual([95]);
		expect(other.total).toBe(1);
		expect(other.latestEmail.emailId).toBe(95);
	});

	it('loads the same unified scope for full message details', async () => {
		const result = await emailService.list(c, query({ full: 1 }), 1);
		expect(ids(result.list)).toEqual([30, 20, 10]);
		expect(result.list[0]).toMatchObject({ text: 'Latest message', content: '<p>Latest message</p>', attList: [] });
	});

	it.each([
		[0, [30, 20], [10]],
		[1, [10, 20], [30]],
	])('pages the unified inbox in timeSort=%i without moving the latest cursor', async (timeSort, firstIds, secondIds) => {
		const first = await emailService.list(c, query({ size: 2, timeSort }), 1);
		const second = await emailService.list(c, query({ size: 2, timeSort, emailId: first.list.at(-1).emailId }), 1);
		expect(ids(first.list)).toEqual(firstIds);
		expect(ids(second.list)).toEqual(secondIds);
		expect(first.total).toBe(3);
		expect(second.total).toBe(3);
		expect(first.latestEmail.emailId).toBe(30);
		expect(second.latestEmail.emailId).toBe(30);
	});

	it('keeps single-mailbox filtering and cursor pagination intact', async () => {
		const first = await emailService.list(c, query({ accountId: 11, allReceive: 0, size: 1 }), 1);
		const second = await emailService.list(c, query({ accountId: 11, allReceive: 0, size: 1, emailId: 30 }), 1);
		expect(ids(first.list)).toEqual([30]);
		expect(ids(second.list)).toEqual([10]);
		expect(second.total).toBe(2);
		expect(second.latestEmail.emailId).toBe(30);

		const otherMailbox = await emailService.list(c, query({ accountId: 12, allReceive: 0 }), 1);
		expect(ids(otherMailbox.list)).toEqual([20]);
		expect(otherMailbox.latestEmail.emailId).toBe(20);
	});

	it('polls only new received messages in active mailboxes owned by the current user', async () => {
		const list = await emailService.latest(c, { accountId: 0, allReceive: 1, emailId: 10 }, 1);
		expect(ids(list)).toEqual([30, 20]);
		expect(list[0]).toMatchObject({ listText: 'Latest message', attList: [] });

		const other = await emailService.latest(c, { accountId: 0, allReceive: 1, emailId: 10 }, 2);
		expect(ids(other)).toEqual([95]);
		const single = await emailService.latest(c, { accountId: 11, allReceive: 0, emailId: 10 }, 1);
		expect(ids(single)).toEqual([30]);
	});

	it('returns an empty list and zero cursor for a deleted mailbox', async () => {
		const result = await emailService.list(c, query({ accountId: 13, allReceive: 0 }), 1);
		expect(result).toMatchObject({ list: [], total: 0, latestEmail: { emailId: 0, accountId: 13, userId: 1 } });
		expect(await emailService.latest(c, { accountId: 13, allReceive: 0, emailId: 0 }, 1)).toEqual([]);
	});

	it('returns no messages or cursor for a user without mailboxes', async () => {
		const result = await emailService.list(c, query(), 3);
		expect(result).toMatchObject({ list: [], total: 0, latestEmail: { emailId: 0, accountId: 0, userId: 3 } });
		expect(await emailService.latest(c, { accountId: 0, allReceive: 1, emailId: 0 }, 3)).toEqual([]);
	});
});
