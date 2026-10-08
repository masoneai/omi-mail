import { describe, expect, it } from 'vitest';
import PostalMime from 'postal-mime';
import { checkBlock, normalizeParsedEmail, readRawEmail, recipientName, splitEmailSetting } from '../src/email/email-helpers';

function byteStream(bytes, chunkSize = 1) {
	return new ReadableStream({
		start(controller) {
			for (let index = 0; index < bytes.length; index += chunkSize) {
				controller.enqueue(bytes.subarray(index, index + chunkSize));
			}
			controller.close();
		}
	});
}

describe('raw email bytes', () => {
	it('preserves Chinese and emoji across one-byte chunk boundaries', async () => {
		const original = new TextEncoder().encode('From: from@example.com\r\nTo: to@example.com\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n验证码：中文 📮');
		const stream = byteStream(original);
		const content = await readRawEmail(stream);
		expect(content).toEqual(original);
		expect(stream.locked).toBe(false);
		const parsed = await PostalMime.parse(content);
		expect(parsed.text.trim()).toBe('验证码：中文 📮');
	});

	it('preserves binary attachment bytes without UTF-8 replacement characters', async () => {
		const encoder = new TextEncoder();
		const prefix = encoder.encode('From: from@example.com\r\nTo: to@example.com\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="mail-test"\r\n\r\n--mail-test\r\nContent-Type: application/octet-stream\r\nContent-Disposition: attachment; filename="file.bin"\r\nContent-Transfer-Encoding: binary\r\n\r\n');
		const binary = new Uint8Array([0, 0xff, 0xfe, 0x80, 0xc3, 0x28, 1]);
		const suffix = encoder.encode('\r\n--mail-test--\r\n');
		const raw = new Uint8Array(prefix.length + binary.length + suffix.length);
		raw.set(prefix);
		raw.set(binary, prefix.length);
		raw.set(suffix, prefix.length + binary.length);
		const content = await readRawEmail(byteStream(raw, 2));
		expect(content).toEqual(raw);
		const parsed = await PostalMime.parse(content);
		expect(parsed.attachments).toHaveLength(1);
		// PostalMime normalizes a final MIME line break; the payload bytes must
		// remain identical to parsing the original bytes without chunking.
		const baseline = await PostalMime.parse(raw);
		expect(new Uint8Array(parsed.attachments[0].content)).toEqual(new Uint8Array(baseline.attachments[0].content));
		expect(new Uint8Array(parsed.attachments[0].content).subarray(0, binary.length)).toEqual(binary);
	});

	it('supports an empty stream', async () => {
		expect(await readRawEmail(byteStream(new Uint8Array()))).toEqual(new Uint8Array());
	});

	it('does not expose bytes outside a single chunk view in its underlying buffer', async () => {
		const bytes = new Uint8Array([99, 1, 2, 99]).subarray(1, 3);
		const content = await readRawEmail(byteStream(bytes, 10));
		expect(content).toEqual(new Uint8Array([1, 2]));
		expect(new Uint8Array(content.buffer)).toEqual(content);
	});

	it('propagates a read failure and releases the stream lock', async () => {
		const failure = new Error('stream interrupted');
		const stream = new ReadableStream({ start(controller) { controller.error(failure); } });
		await expect(readRawEmail(stream)).rejects.toBe(failure);
		expect(stream.locked).toBe(false);
	});
});

describe('parsed email metadata', () => {
	it('uses the SMTP envelope when From and To headers are absent', () => {
		const email = normalizeParsedEmail({}, 'sender@example.com', 'box+tag@example.com');
		expect(email.from).toEqual({ address: 'sender@example.com', name: '' });
		expect(email.to).toEqual([{ address: 'box+tag@example.com', name: 'box+tag' }]);
		expect(email.attachments).toEqual([]);
		expect(email.cc).toEqual([]);
		expect(email.subject).toBe('');
		expect(email.text).toBe('');
	});

	it('flattens grouped To recipients and finds a differently cased envelope address', () => {
		const parsed = { from: { address: ' author@example.com ', name: '作者' }, to: [{ name: 'Team', group: [{ address: ' BOX@EXAMPLE.COM ', name: '收件人' }] }] };
		const email = normalizeParsedEmail(parsed, 'envelope@example.com', 'box@example.com');
		expect(email.from).toEqual({ address: 'author@example.com', name: '作者' });
		expect(email.to).toEqual([{ address: 'BOX@EXAMPLE.COM', name: '收件人' }]);
		expect(recipientName(email.to, 'box@example.com')).toBe('收件人');
		// Normalization must not mutate the MIME parser's returned metadata.
		expect(parsed.to[0].group[0].address).toBe(' BOX@EXAMPLE.COM ');
	});

	it('handles an empty or malformed To list and optional headers', () => {
		const email = normalizeParsedEmail({ from: {}, to: [null, {}, { name: 'undisclosed', group: [] }], attachments: null, cc: [{ address: 'cc@example.com' }], bcc: null }, 'from@example.com', 'to@example.com');
		expect(email.to[0].address).toBe('to@example.com');
		expect(email.cc).toEqual([{ address: 'cc@example.com', name: '' }]);
		expect(email.bcc).toEqual([]);
		expect(email.references).toBe('');
	});

	it('retains other header recipients without pretending they match the envelope', () => {
		const email = normalizeParsedEmail({ to: [{ address: 'other@example.com', name: 'Other' }] }, '', 'bcc@example.com');
		expect(email.to).toEqual([{ address: 'other@example.com', name: 'Other' }]);
		expect(recipientName(email.to, 'bcc@example.com')).toBe('');
	});
});

describe('mail settings and blocklists', () => {
	it('ignores blank list entries and surrounding configuration whitespace', () => {
		expect(splitEmailSetting(' first@example.com, , second@example.com,')).toEqual(['first@example.com', 'second@example.com']);
		expect(splitEmailSetting(undefined)).toEqual([]);
		expect(checkBlock('spam,', ' , ', '', { subject: 'Legitimate', text: 'Normal' })).toBe(false);
	});

	it('blocks subject/content keywords and sender domains without casing errors', () => {
		expect(checkBlock('spam', '', '', { subject: 'spam offer' })).toBe(true);
		expect(checkBlock('', 'blocked', '', { html: '<p>blocked</p>' })).toBe(true);
		expect(checkBlock('', '', 'example.com', { from: { address: 'Sender@EXAMPLE.COM' } })).toBe(true);
		expect(checkBlock('', '', ' sender@example.com ', { from: { address: 'Sender@example.com' } })).toBe(true);
		expect(checkBlock('', '', 'other.com', { from: { address: 'Sender@example.com' } })).toBe(false);
		expect(checkBlock('', '', 'example.com', {})).toBe(false);
	});
});
