import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResendWebhookHandler } from '../src/lib/resend-webhook';
import resendService from '../src/service/resend-service';
import { createTestD1 } from './helpers/d1';

const key = Buffer.from('test-signing-key-do-not-use-in-production');
const env = { resend_webhook_secret: `whsec_${key.toString('base64')}` };
const event = { type: 'email.delivered', data: { email_id: 'email-1' } };

function signedRequest(payload = JSON.stringify(event), timestamp = Math.floor(Date.now() / 1000)) {
	const id = 'msg_test';
	const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
	return new Request('https://mail.example.com/webhooks', {
		method: 'POST', body: payload,
		headers: { 'svix-id': id, 'svix-timestamp': String(timestamp), 'svix-signature': `v1,${signature}` },
	});
}

function appWith(handler) {
	const app = new Hono();
	app.post('/webhooks', bodyLimit({ maxSize: 256 * 1024 }), createResendWebhookHandler(handler));
	return app;
}

afterEach(() => vi.restoreAllMocks());

describe('authenticated Resend webhooks', () => {
	it('verifies the exact original bytes, including whitespace and Chinese', async () => {
		const apply = vi.fn();
		const payload = '{ "type": "email.delivered", "data": {"email_id":"email-1", "subject":"你好"} }';
		const response = await appWith(apply).fetch(signedRequest(payload), env);
		expect(response.status).toBe(200);
		expect(apply.mock.calls[0][1]).toEqual(JSON.parse(payload));
	});

	it('rejects a modified payload without touching the database', async () => {
		const apply = vi.fn();
		const request = signedRequest();
		const modified = new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({ ...event, type: 'email.bounced' }) });
		expect((await appWith(apply).fetch(modified, env)).status).toBe(401);
		expect(apply).not.toHaveBeenCalled();
	});

	it('rejects unsigned and expired requests', async () => {
		const apply = vi.fn();
		const app = appWith(apply);
		expect((await app.fetch(new Request('https://mail.example.com/webhooks', { method: 'POST', body: JSON.stringify(event) }), env)).status).toBe(401);
		expect((await app.fetch(signedRequest(undefined, Math.floor(Date.now() / 1000) - 600), env)).status).toBe(401);
		expect(apply).not.toHaveBeenCalled();
	});

	it('fails closed when the signing secret is missing', async () => {
		const apply = vi.fn();
		expect((await appWith(apply).fetch(signedRequest(), {})).status).toBe(503);
		expect(apply).not.toHaveBeenCalled();
	});

	it('ignores clicks and opens instead of changing delivery status', async () => {
		const apply = vi.fn();
		for (const type of ['email.opened', 'email.clicked', 'email.received']) {
			expect((await appWith(apply).fetch(signedRequest(JSON.stringify({ ...event, type })), env)).status).toBe(200);
		}
		expect(apply).not.toHaveBeenCalled();
	});

	it('rejects malformed known events and excessive request bodies', async () => {
		const apply = vi.fn();
		const app = appWith(apply);
		expect((await app.fetch(signedRequest('{"type":"email.delivered","data":{}}'), env)).status).toBe(400);
		expect((await app.fetch(signedRequest('x'.repeat(256 * 1024 + 1)), env)).status).toBe(413);
		expect(apply).not.toHaveBeenCalled();
	});

	it('returns a retryable response for database failures', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const response = await appWith(() => { throw new Error('D1 unavailable'); }).fetch(signedRequest(), env);
		expect(response.status).toBe(500);
		expect(await response.text()).not.toContain('D1 unavailable');
	});
});

describe('Resend status updates with real SQLite', () => {
	let db;
	afterEach(() => db?.close());
	function context(status = 1, type = 1) {
		db = createTestD1('CREATE TABLE email (email_id INTEGER PRIMARY KEY, resend_email_id TEXT, type INTEGER, status INTEGER, message TEXT);');
		db.sqlite.prepare('INSERT INTO email VALUES (1, ?, ?, ?, NULL)').run('email-1', type, status);
		return { env: { db } };
	}
	function record() { return db.sqlite.prepare('SELECT status, message FROM email').get(); }

	it('keeps delivered status after a late sent or delayed event', async () => {
		const c = context();
		await resendService.webhooks(c, event);
		await resendService.webhooks(c, { ...event, type: 'email.sent' });
		await resendService.webhooks(c, { ...event, type: 'email.delivery_delayed' });
		expect(record().status).toBe(2);
	});

	it('keeps a complaint after repeated delivery events', async () => {
		const c = context(2);
		await resendService.webhooks(c, { ...event, type: 'email.complained' });
		await resendService.webhooks(c, event);
		await resendService.webhooks(c, { ...event, type: 'email.complained' });
		expect(record().status).toBe(4);
	});

	it('preserves a failure after an out-of-order success event', async () => {
		const c = context();
		await resendService.webhooks(c, { type: 'email.failed', data: { email_id: 'email-1', failed: { reason: 'Rejected' } } });
		await resendService.webhooks(c, event);
		expect(record()).toMatchObject({ status: 8, message: 'Rejected' });
	});

	it('retries a webhook arriving before the send record exists', async () => {
		const c = context();
		await expect(resendService.webhooks(c, { ...event, data: { email_id: 'new-email' } })).rejects.toThrow('not available yet');
	});

	it('does not mutate received emails sharing a provider ID', async () => {
		const c = context(0, 0);
		await expect(resendService.webhooks(c, event)).rejects.toThrow('not available yet');
		expect(record().status).toBe(0);
	});
});
